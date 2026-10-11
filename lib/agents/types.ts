/**
 * Shared types of the product AI agents layer.
 *
 * Why `lib/agents/` and not a feature folder: these guard rails (kill switch,
 * volume limit, human takeover, run journal, safe fallback) are the same for
 * Lea, Hugo, Emma, Louis and Sarah. They are cross-domain infrastructure, like
 * `lib/supabase/` or `lib/claude/`, so they live in `lib/`. Each agent keeps
 * its own prompt, schema and decision logic under `features/agents-ia/<agent>/`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

export type TypedClient = SupabaseClient<Database>;

export type Tables = Database["public"]["Tables"];
export type Enums = Database["public"]["Enums"];

export type AiAgentName = Enums["ai_agent_name"];
export type PipelineStage = Enums["pipeline_stage"];
export type MembershipRole = Enums["membership_role"];

/** Who is running the agent, and for which agency. Always resolved server-side. */
export type AgentContext = {
  userId: string;
  agencyId: string;
  role: MembershipRole;
};

/** Columns of the contact an agent works on. */
export const AGENT_CONTACT_COLUMNS =
  "id, agency_id, first_name, last_name, email, phone, source, stage, notes, sale_motivation, sale_timeline, human_takeover, assigned_user_id, created_at";

export type AgentContact = Pick<
  Tables["contacts"]["Row"],
  | "id"
  | "agency_id"
  | "first_name"
  | "last_name"
  | "email"
  | "phone"
  | "source"
  | "stage"
  | "notes"
  | "sale_motivation"
  | "sale_timeline"
  | "human_takeover"
  | "assigned_user_id"
  | "created_at"
>;

export type AgentAgency = Pick<Tables["agencies"]["Row"], "id" | "name" | "ai_paused" | "ai_daily_run_limit">;
