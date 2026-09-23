/**
 * How the interface presents the refusal of an agent action.
 *
 * No rule is decided here: which codes are guard-rail refusals (journaled as
 * `blocked` runs) is owned by the agents' pure classification module
 * (`lib/agents/run-status.ts`, `runStatusForRefusal`), shared with the runner.
 * This file only reads that classification, so a refusal and a technical error
 * can never be confused on screen. It is imported by client components: never
 * import the server-side runner (`lib/agents/runner.ts`) from here.
 */

import { AGENT_ERROR_CODES, type AgentErrorCode } from "@/lib/agents/messages";
import { runStatusForRefusal } from "@/lib/agents/run-status";

export type ActionFailureKind = "blocked" | "failed";

function isAgentErrorCode(code: string): code is AgentErrorCode {
  return (AGENT_ERROR_CODES as readonly string[]).includes(code);
}

/**
 * `blocked` when a guard rail or an eligibility rule refused the action (kill
 * switch, daily limit, human takeover, consent, signed mandate…); `failed` for
 * anything else, including an unknown code — never the other way round.
 */
export function actionFailureKind(code: string | null | undefined): ActionFailureKind {
  if (!code || !isAgentErrorCode(code)) return "failed";
  return runStatusForRefusal(code);
}

/**
 * UI state of a refused action: `blocked` (guard rail, shown as information)
 * or `error` (shown as an error). The server's French message is kept as-is.
 */
export function refusalState(error: { code: string; message: string }): {
  kind: "blocked" | "error";
  message: string;
} {
  return { kind: actionFailureKind(error.code) === "blocked" ? "blocked" : "error", message: error.message };
}
