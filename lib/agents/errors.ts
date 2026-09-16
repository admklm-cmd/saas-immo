/**
 * Translation of database errors into safe French messages.
 *
 * The schema raises stable, machine-readable exceptions (`ai_paused`,
 * `consent_not_granted`, `first_contact_requires_human_validation`, …). They are
 * the source of truth for the guard rails, but they must never reach the user
 * as raw Postgres text: the technical detail is logged server-side and only a
 * clear French sentence is returned.
 */

import { fail, type Result, type ResultError } from "@/lib/utils/result";

import { AGENT_ERROR_MESSAGES, type AgentErrorCode } from "./messages";

export type DatabaseErrorLike = {
  message?: string | null;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
};

/** Exceptions raised by the triggers and RPCs of the schema. */
const DATABASE_MESSAGE_TO_CODE: Readonly<Record<string, AgentErrorCode>> = {
  ai_paused: "ai_paused",
  ai_daily_run_limit_reached: "ai_daily_run_limit_reached",
  consent_not_granted: "consent_not_granted",
  first_contact_requires_human_validation: "first_contact_requires_human_validation",
  automatic_follow_up_not_allowed: "automatic_follow_up_not_allowed",
  only_director_can_resume_ai: "only_director_can_resume_ai",
  forbidden: "forbidden",
  agency_id_immutable: "forbidden",
  activity_actor_forged: "forbidden",
  validated_by_must_be_caller: "forbidden",
  completed_by_must_be_caller: "forbidden",
  task_completion_immutable: "forbidden",
  outbound_message_already_sent: "forbidden",
  outbound_message_edit_requires_revalidation: "forbidden",
  ai_agent_run_already_finished: "forbidden",
  ai_agent_run_immutable_fields: "forbidden",
  ai_agent_run_invalid_transition: "forbidden",
};

/** Postgres SQLSTATE fallbacks when the message is not one of ours. */
const SQLSTATE_TO_CODE: Readonly<Record<string, AgentErrorCode>> = {
  "42501": "forbidden", // insufficient privilege / RLS violation
  "23505": "duplicate", // unique violation
  // Exclusion violation. The schema has exactly one exclusion constraint
  // (appointments_no_overlap), so this always means "that slot is taken".
  "23P01": "appointment_slot_taken",
};

export function databaseErrorCode(error: DatabaseErrorLike): AgentErrorCode {
  const message = (error.message ?? "").trim();
  const direct = DATABASE_MESSAGE_TO_CODE[message];
  if (direct) return direct;

  // PostgREST wraps the message, e.g. `new row violates row-level security…`.
  for (const [needle, code] of Object.entries(DATABASE_MESSAGE_TO_CODE)) {
    if (message.includes(needle)) return code;
  }

  const bySqlState = SQLSTATE_TO_CODE[(error.code ?? "").trim()];
  if (bySqlState) return bySqlState;

  return "unexpected_error";
}

/**
 * Builds the `{ data: null, error }` result for a database failure, logging the
 * technical detail server-side.
 */
export function failFromDatabase<T = never>(context: string, error: DatabaseErrorLike): Result<T> {
  const code = databaseErrorCode(error);
  console.error(`[agents] ${context} failed (${error.code ?? "?"}): ${error.message ?? "unknown error"}`);
  return fail<T>(code, AGENT_ERROR_MESSAGES[code]);
}

export function agentError(code: AgentErrorCode): ResultError {
  return { code, message: AGENT_ERROR_MESSAGES[code] };
}

export function failWith<T = never>(code: AgentErrorCode): Result<T> {
  return fail<T>(code, AGENT_ERROR_MESSAGES[code]);
}

/** Last-resort wrapper: an unexpected exception never leaks to the UI. */
export function failFromUnexpected<T = never>(context: string, cause: unknown): Result<T> {
  console.error(`[agents] ${context} threw:`, cause);
  return failWith<T>("unexpected_error");
}
