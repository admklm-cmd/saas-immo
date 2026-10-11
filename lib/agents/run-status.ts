/**
 * Classification of agent refusals: `blocked` (a guard rail or an eligibility
 * rule did its job) versus `failed` (a real error).
 *
 * Deliberately a PURE module with a single dependency (`./messages`, codes and
 * French texts only): it is imported by client components (via
 * `features/agents-ia/components/outcome.ts`) as well as by the server-side
 * runner. It must never import the runner, a Supabase client, the AI provider
 * or anything marked `server-only` — `run-status.test.ts` enforces it, so no
 * server logic can be pulled into the browser bundle through this path.
 */

import type { AgentErrorCode } from "./messages";

/** Shared guard rails refusing an attempt before any work (see runner.ts). */
export const GUARD_BLOCKING_CODES = ["ai_paused", "ai_daily_run_limit_reached", "human_takeover"] as const;
export type GuardBlockingCode = (typeof GUARD_BLOCKING_CODES)[number];

/**
 * Eligibility refusals of the agents, also journaled as `blocked`. The single
 * list of what counts as "refused by a rule" rather than "error"; unit-tested.
 */
export const ELIGIBILITY_BLOCKING_CODES = [
  "follow_up_stage_not_eligible",
  "follow_up_mandate_signed",
  "follow_up_contact_lost",
  "follow_up_already_drafted",
  "follow_up_already_prepared_today",
  "consent_not_granted",
  "follow_up_no_reachable_channel",
  "appointment_stage_not_ready",
  "appointment_already_scheduled",
  "appointment_no_reachable_channel",
  "appointment_no_available_slot",
  "appointment_report_missing",
] as const satisfies readonly AgentErrorCode[];
export type EligibilityBlockingCode = (typeof ELIGIBILITY_BLOCKING_CODES)[number];

/** Run status a refusal is journaled with when decided before the run opens. */
export function runStatusForRefusal(code: AgentErrorCode): "blocked" | "failed" {
  return (GUARD_BLOCKING_CODES as readonly string[]).includes(code) ||
    (ELIGIBILITY_BLOCKING_CODES as readonly string[]).includes(code)
    ? "blocked"
    : "failed";
}
