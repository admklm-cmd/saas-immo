/**
 * UI state of an agent action that did not succeed, with the retry decision.
 *
 * Kept apart from `outcome.ts` on purpose: that module is a browser-safe
 * bridge to the agents' classification and its imports are pinned by
 * `lib/agents/run-status.test.ts`. Here we only add a presentation choice.
 */
import { isRetryableErrorCode } from "@/components/ui/retryable";

import { refusalState } from "./outcome";

export type RefusalUiState =
  | { kind: "blocked"; message: string }
  /** `retryable`: a new attempt can really succeed (technical failure only). */
  | { kind: "error"; message: string; retryable: boolean };

/**
 * `blocked` (guard rail, shown as neutral information, never retried) or
 * `error` (shown as an error, « Réessayer » only for a technical failure).
 * The server's French message is kept as-is.
 */
export function refusalUiState(error: { code: string; message: string }): RefusalUiState {
  const state = refusalState(error);
  if (state.kind === "blocked") return { kind: "blocked", message: state.message };
  return { kind: "error", message: state.message, retryable: isRetryableErrorCode(error.code) };
}
