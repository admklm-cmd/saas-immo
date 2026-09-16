/**
 * CRM journalling for the AI agents: history entries and human tasks.
 *
 * - `activities` is the append-only CRM history: what happened, who did it
 *   (`actor_type = 'ai_agent'`, `actor_agent = '<agent>'`) and whether it was
 *   simulated (`is_simulation`), so a simulated action can never be mistaken
 *   for a real one.
 * - `tasks` is the human to-do list: an agent that lacks information, or whose
 *   output could not be validated, opens a task instead of guessing or acting.
 *   The unique index on (agency, contact, type) for open tasks means rerunning
 *   an agent never piles up duplicates: the existing task is reused.
 */

import { ok, type Result } from "@/lib/utils/result";

import { failFromDatabase } from "./errors";
import type { Json } from "@/types/database";
import type { AgentContext, AiAgentName, TypedClient } from "./types";

export type ActivityInput = {
  contactId: string | null;
  type: string;
  summary: string;
  payload?: Json;
  agent: AiAgentName;
  isSimulation: boolean;
};

export async function logAgentActivity(
  client: TypedClient,
  context: AgentContext,
  input: ActivityInput,
): Promise<Result<{ id: string }>> {
  const { data, error } = await client
    .from("activities")
    .insert({
      agency_id: context.agencyId,
      contact_id: input.contactId,
      type: input.type,
      summary: input.summary.slice(0, 1000),
      payload: input.payload ?? {},
      actor_type: "ai_agent",
      actor_agent: input.agent,
      is_simulation: input.isSimulation,
    })
    .select("id")
    .single();

  if (error) return failFromDatabase<{ id: string }>("logAgentActivity", error);
  return ok({ id: data.id });
}

export type HumanTaskInput = {
  contactId: string | null;
  type: string;
  title: string;
  details?: string | null;
  agent: AiAgentName;
  assignedUserId?: string | null;
};

export type HumanTaskResult = {
  id: string | null;
  type: string;
  /** False when an identical open task already existed (no duplicate created). */
  created: boolean;
};

/**
 * Opens a task for a human, tolerating the "already open" case: two runs of the
 * same agent on the same contact must not flood the agency's inbox.
 */
export async function openHumanTask(
  client: TypedClient,
  context: AgentContext,
  input: HumanTaskInput,
): Promise<Result<HumanTaskResult>> {
  const { data, error } = await client
    .from("tasks")
    .insert({
      agency_id: context.agencyId,
      contact_id: input.contactId,
      type: input.type,
      title: input.title.slice(0, 200),
      details: input.details ? input.details.slice(0, 5000) : null,
      status: "open",
      created_by_agent: input.agent,
      assigned_user_id: input.assignedUserId ?? null,
    })
    .select("id")
    .single();

  if (!error) {
    return ok({ id: data.id, type: input.type, created: true });
  }

  // 23505: an identical open task already exists (unique index
  // tasks_open_contact_type_key). Reuse it instead of failing the run.
  if (error.code === "23505" && input.contactId) {
    const existing = await client
      .from("tasks")
      .select("id")
      .eq("agency_id", context.agencyId)
      .eq("contact_id", input.contactId)
      .eq("type", input.type)
      .eq("status", "open")
      .maybeSingle();

    if (!existing.error && existing.data) {
      return ok({ id: existing.data.id, type: input.type, created: false });
    }
  }

  return failFromDatabase<HumanTaskResult>("openHumanTask", error);
}
