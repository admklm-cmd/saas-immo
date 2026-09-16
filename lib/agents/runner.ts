/**
 * Guard rails + run journal, shared by every product AI agent.
 *
 * ALL of these checks are performed BY THE CODE, before any AI call, and are
 * re-checked by the database triggers (defence in depth). The AI is never
 * asked, and never allowed, to decide whether an action is permitted:
 *
 *   1. session and agency re-resolved server-side (`resolveAgentContext`);
 *   2. the contact must belong to the caller's agency (otherwise: generic
 *      "Contact introuvable.", which leaks nothing about another agency);
 *   3. agency kill switch (`agencies.ai_paused`);
 *   4. daily volume limit (`agencies.ai_daily_run_limit`, Europe/Paris day);
 *   5. human takeover (`contacts.human_takeover`) — no automatic action.
 *
 * Every attempt is journaled in `ai_agent_runs`: refused attempts as `blocked`
 * with the reason, accepted ones as `running` then `succeeded` / `failed`.
 */

import type { AiProvider, AiUsage } from "@/lib/claude/provider";
import { ok, type Result } from "@/lib/utils/result";
import type { Json } from "@/types/database";

import { databaseErrorCode, failFromDatabase, failWith } from "./errors";
import { AGENT_ERROR_MESSAGES, type AgentErrorCode } from "./messages";
import { parisDayStart } from "./time";
import {
  AGENT_CONTACT_COLUMNS,
  type AgentAgency,
  type AgentContact,
  type AgentContext,
  type AiAgentName,
  type Tables,
  type TypedClient,
} from "./types";

export type GuardedRunInput = {
  agent: AiAgentName;
  contactId: string;
  /** Metadata journaled with the run — never the prospect's raw text. */
  input: Json;
  provider: AiProvider;
  now?: Date;
};

export type GuardedRun = {
  runId: string;
  contact: AgentContact;
  agency: AgentAgency;
};

/** Codes that are journaled as a `blocked` run rather than a plain failure. */
const BLOCKING_CODES = ["ai_paused", "ai_daily_run_limit_reached", "human_takeover"] as const;
type BlockingCode = (typeof BLOCKING_CODES)[number];

/**
 * Journals a refused attempt. A `blocked` run is accepted by the database even
 * when the kill switch is on (that is exactly what it is for) and never counts
 * against the daily volume limit.
 */
export async function journalBlockedRun(
  client: TypedClient,
  context: AgentContext,
  input: { agent: AiAgentName; contactId: string | null; provider: AiProvider; reason: BlockingCode; details: Json },
): Promise<string | null> {
  const { data, error } = await client
    .from("ai_agent_runs")
    .insert({
      agency_id: context.agencyId,
      agent: input.agent,
      contact_id: input.contactId,
      triggered_by_user_id: context.userId,
      status: "blocked",
      input: input.details,
      decision: AGENT_ERROR_MESSAGES[input.reason],
      error: input.reason,
      provider: input.provider.name,
      model: input.provider.model,
      is_simulation: input.provider.isSimulation,
    })
    .select("id")
    .single();

  if (error) {
    console.error(`[agents] journalBlockedRun failed (${error.code ?? "?"}): ${error.message}`);
    return null;
  }
  return data.id;
}

export async function startGuardedRun(
  client: TypedClient,
  context: AgentContext,
  input: GuardedRunInput,
): Promise<Result<GuardedRun>> {
  // --- 2. the contact must belong to the caller's agency ---------------------
  const contactQuery = await client
    .from("contacts")
    .select(AGENT_CONTACT_COLUMNS)
    .eq("agency_id", context.agencyId)
    .eq("id", input.contactId)
    .maybeSingle();

  if (contactQuery.error) {
    return failFromDatabase<GuardedRun>("startGuardedRun.contact", contactQuery.error);
  }
  if (!contactQuery.data) {
    // Same answer whether the contact does not exist or belongs to another
    // agency: no information leak.
    return failWith<GuardedRun>("contact_not_found");
  }
  const contact = contactQuery.data as AgentContact;

  const agencyQuery = await client
    .from("agencies")
    .select("id, name, ai_paused, ai_daily_run_limit")
    .eq("id", context.agencyId)
    .maybeSingle();

  if (agencyQuery.error) {
    return failFromDatabase<GuardedRun>("startGuardedRun.agency", agencyQuery.error);
  }
  if (!agencyQuery.data) {
    return failWith<GuardedRun>("forbidden");
  }
  const agency: AgentAgency = agencyQuery.data;

  const block = async (reason: BlockingCode): Promise<Result<GuardedRun>> => {
    await journalBlockedRun(client, context, {
      agent: input.agent,
      contactId: contact.id,
      provider: input.provider,
      reason,
      details: input.input,
    });
    return failWith<GuardedRun>(reason);
  };

  // --- 3. kill switch --------------------------------------------------------
  if (agency.ai_paused) {
    return block("ai_paused");
  }

  // --- 4. daily volume limit (Europe/Paris calendar day) ---------------------
  const dayStart = parisDayStart(input.now ?? new Date());
  const countQuery = await client
    .from("ai_agent_runs")
    .select("id", { count: "exact", head: true })
    .eq("agency_id", context.agencyId)
    .neq("status", "blocked")
    .gte("started_at", dayStart.toISOString());

  if (countQuery.error) {
    return failFromDatabase<GuardedRun>("startGuardedRun.count", countQuery.error);
  }
  if ((countQuery.count ?? 0) >= agency.ai_daily_run_limit) {
    return block("ai_daily_run_limit_reached");
  }

  // --- 5. human takeover -----------------------------------------------------
  if (contact.human_takeover) {
    return block("human_takeover");
  }

  // --- open the run ----------------------------------------------------------
  const runInsert = await client
    .from("ai_agent_runs")
    .insert({
      agency_id: context.agencyId,
      agent: input.agent,
      contact_id: contact.id,
      triggered_by_user_id: context.userId,
      status: "running",
      input: input.input,
      provider: input.provider.name,
      model: input.provider.model,
      is_simulation: input.provider.isSimulation,
    })
    .select("id")
    .single();

  if (runInsert.error) {
    // Race with a concurrent pause or a concurrent run: the database refused
    // the start. Journal it as blocked so the agency sees the attempt.
    const code: AgentErrorCode = databaseErrorCode(runInsert.error);
    if ((BLOCKING_CODES as readonly string[]).includes(code)) {
      await journalBlockedRun(client, context, {
        agent: input.agent,
        contactId: contact.id,
        provider: input.provider,
        reason: code as BlockingCode,
        details: input.input,
      });
      return failWith<GuardedRun>(code);
    }
    return failFromDatabase<GuardedRun>("startGuardedRun.insert", runInsert.error);
  }

  return ok({ runId: runInsert.data.id, contact, agency });
}

export type FinishRunInput = {
  status: "succeeded" | "failed";
  output?: Json;
  decision?: string | null;
  error?: string | null;
  usage?: AiUsage | null;
};

/** Closes a run. Never throws: a journalling failure must not hide the result. */
export async function finishRun(
  client: TypedClient,
  runId: string,
  input: FinishRunInput,
): Promise<void> {
  const update: Tables["ai_agent_runs"]["Update"] = {
    status: input.status,
    output: input.output ?? null,
    decision: input.decision ? input.decision.slice(0, 2000) : null,
    error: input.error ? input.error.slice(0, 2000) : null,
  };
  if (input.usage) {
    // Token accounting, per agency, to follow the cost of the AI agents.
    update.model = input.usage.model;
    update.input_tokens = input.usage.inputTokens;
    update.output_tokens = input.usage.outputTokens;
  }

  const { error } = await client.from("ai_agent_runs").update(update).eq("id", runId);

  if (error) {
    console.error(`[agents] finishRun failed (${error.code ?? "?"}): ${error.message}`);
  }
}
