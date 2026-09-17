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
 *
 * Two entry points, same guard rails:
 *   * `startGuardedRun` — the agent works on an existing contact (Hugo, Emma,
 *     Louis, Sarah): checks 2 and 5 above apply;
 *   * `startGuardedContactlessRun` — the agent runs BEFORE a contact exists
 *     (Léa, on a raw inbound lead): the run is journaled with `contact_id =
 *     null`, and checks 2 and 5 simply have no subject.
 *
 * Each attempt also opens a STEP JOURNAL (`ai_agent_run_steps`, see steps.ts):
 * `startGuardedRun` records the `guardrails` step itself — `ok` when the run is
 * allowed to start, `blocked` with the reason when it is not — and hands the
 * recorder back so the agent journals the rest of its sequence. A run that was
 * refused therefore still shows the user WHY it stopped.
 */

import type { AiProvider, AiUsage } from "@/lib/claude/provider";
import { ok, type Result } from "@/lib/utils/result";
import type { Json } from "@/types/database";

import { databaseErrorCode, failFromDatabase, failWith } from "./errors";
import {
  AGENT_ERROR_MESSAGES,
  AGENT_STEP_BLOCK_LABELS,
  AGENT_STEP_LABELS,
  type AgentErrorCode,
} from "./messages";
import { createStepRecorder, type AgentStepRecorder } from "./steps";
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

/** Same thing for an agent that runs BEFORE any contact exists (Léa). */
export type GuardedContactlessRunInput = Omit<GuardedRunInput, "contactId">;

type GuardedRunBase = {
  runId: string;
  agency: AgentAgency;
  /**
   * Step journal of this run. The `guardrails` step is already recorded; the
   * agent records `context_loaded`, `prompt_built`, `ai_call`,
   * `output_validated`, `decision` and `persisted` as it goes.
   */
  steps: AgentStepRecorder;
};

export type GuardedRun = GuardedRunBase & { contact: AgentContact };

/**
 * A run that is not attached to any contact. `ai_agent_runs.contact_id` is
 * nullable precisely for this case: Léa processes a raw inbound lead, and the
 * contact record is what she may (or may not) create at the end.
 */
export type GuardedContactlessRun = GuardedRunBase & { contact: null };

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

type AnyGuardedRun = GuardedRunBase & { contact: AgentContact | null };

/**
 * The guard rails themselves. `contactId` is `null` for an agent that works
 * before any contact exists (Léa): the ownership and human-takeover checks
 * simply do not apply, every other check does, unchanged.
 */
async function startRun(
  client: TypedClient,
  context: AgentContext,
  input: GuardedRunInput | (GuardedContactlessRunInput & { contactId: null }),
): Promise<Result<AnyGuardedRun>> {
  // Start of the `guardrails` step. Deliberately the real clock, never
  // `input.now` (which tests may move around to exercise the Paris day
  // boundary): a journaled duration must be a measurement, not a parameter.
  const guardStartedAt = new Date();

  // --- 2. the contact must belong to the caller's agency ---------------------
  let contact: AgentContact | null = null;
  if (input.contactId !== null) {
    const contactQuery = await client
      .from("contacts")
      .select(AGENT_CONTACT_COLUMNS)
      .eq("agency_id", context.agencyId)
      .eq("id", input.contactId)
      .maybeSingle();

    if (contactQuery.error) {
      return failFromDatabase<AnyGuardedRun>("startGuardedRun.contact", contactQuery.error);
    }
    if (!contactQuery.data) {
      // Same answer whether the contact does not exist or belongs to another
      // agency: no information leak.
      return failWith<AnyGuardedRun>("contact_not_found");
    }
    contact = contactQuery.data as AgentContact;
  }

  const agencyQuery = await client
    .from("agencies")
    .select("id, name, ai_paused, ai_daily_run_limit")
    .eq("id", context.agencyId)
    .maybeSingle();

  if (agencyQuery.error) {
    return failFromDatabase<AnyGuardedRun>("startGuardedRun.agency", agencyQuery.error);
  }
  if (!agencyQuery.data) {
    return failWith<AnyGuardedRun>("forbidden");
  }
  const agency: AgentAgency = agencyQuery.data;

  /**
   * Journals the refused attempt AND its explanatory step. The user must be
   * able to see why an execution stopped, not just that nothing happened.
   */
  const block = async (reason: BlockingCode): Promise<Result<AnyGuardedRun>> => {
    const blockedRunId = await journalBlockedRun(client, context, {
      agent: input.agent,
      contactId: contact?.id ?? null,
      provider: input.provider,
      reason,
      details: input.input,
    });
    if (blockedRunId) {
      const steps = createStepRecorder(client, {
        agencyId: context.agencyId,
        runId: blockedRunId,
        startedAt: guardStartedAt,
      });
      await steps.step({
        phase: "guardrails",
        label: AGENT_STEP_BLOCK_LABELS[reason],
        status: "blocked",
        detail: { agent: input.agent, reason, contact_id: contact?.id ?? null },
      });
    }
    return failWith<AnyGuardedRun>(reason);
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
    return failFromDatabase<AnyGuardedRun>("startGuardedRun.count", countQuery.error);
  }
  if ((countQuery.count ?? 0) >= agency.ai_daily_run_limit) {
    return block("ai_daily_run_limit_reached");
  }

  // --- 5. human takeover -----------------------------------------------------
  if (contact?.human_takeover) {
    return block("human_takeover");
  }

  // --- open the run ----------------------------------------------------------
  const runInsert = await client
    .from("ai_agent_runs")
    .insert({
      agency_id: context.agencyId,
      agent: input.agent,
      contact_id: contact?.id ?? null,
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
      return block(code as BlockingCode);
    }
    return failFromDatabase<AnyGuardedRun>("startGuardedRun.insert", runInsert.error);
  }

  const runId = runInsert.data.id;
  const steps = createStepRecorder(client, {
    agencyId: context.agencyId,
    runId,
    startedAt: guardStartedAt,
  });
  await steps.step({
    phase: "guardrails",
    label: AGENT_STEP_LABELS.guardrails_ok,
    detail: {
      agent: input.agent,
      contact_id: contact?.id ?? null,
      ai_paused: agency.ai_paused,
      human_takeover: contact?.human_takeover ?? false,
      runs_today: countQuery.count ?? 0,
      daily_limit: agency.ai_daily_run_limit,
      provider: input.provider.name,
      model: input.provider.model,
      is_simulation: input.provider.isSimulation,
    },
  });

  return ok({ runId, contact, agency, steps });
}

export async function startGuardedRun(
  client: TypedClient,
  context: AgentContext,
  input: GuardedRunInput,
): Promise<Result<GuardedRun>> {
  const started = await startRun(client, context, input);
  if (started.error) return { data: null, error: started.error };
  // `contactId` was given, so the contact was read and is non-null.
  return ok(started.data as GuardedRun);
}

/**
 * Guard rails for an agent that has no contact yet (Léa, on an inbound lead).
 * Everything that protects the agency still applies — kill switch, daily
 * volume, membership — and the attempt is journaled exactly the same way.
 */
export async function startGuardedContactlessRun(
  client: TypedClient,
  context: AgentContext,
  input: GuardedContactlessRunInput,
): Promise<Result<GuardedContactlessRun>> {
  const started = await startRun(client, context, { ...input, contactId: null });
  if (started.error) return { data: null, error: started.error };
  return ok(started.data as GuardedContactlessRun);
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
