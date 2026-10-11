/**
 * Which failures deserve a « Réessayer » button.
 *
 * Only TECHNICAL failures: a provider that did not answer, a read or write
 * that failed, an unexpected error, or an exception thrown before any answer
 * (network). A guard-rail refusal (kill switch, consent, human takeover…) or
 * a business refusal (already done, not found, invalid input) would fail the
 * same way again: offering to retry it would be a lie.
 *
 * Presentation only: the server re-checks everything on the new attempt.
 */
const RETRYABLE_CODES: ReadonlySet<string> = new Set([
  "unexpected_error",
  "ai_provider_unavailable",
  "ai_response_invalid",
]);

/**
 * A storage operation that failed (`contacts_read_failed`,
 * `property_write_failed`…). Deliberately NOT every `*_failed`:
 * `validation_failed` is an invalid input and would fail again.
 */
const RETRYABLE_SUFFIXES = ["_read_failed", "_write_failed", "_insert_failed", "_update_failed"] as const;

export function isRetryableErrorCode(code: string | null | undefined): boolean {
  if (!code) return false;
  return RETRYABLE_CODES.has(code) || RETRYABLE_SUFFIXES.some((suffix) => code.endsWith(suffix));
}
