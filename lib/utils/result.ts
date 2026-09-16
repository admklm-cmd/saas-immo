/**
 * Explicit result type returned by server functions (actions, queries), as
 * required by CLAUDE.md: `{ data, error }` instead of throwing raw exceptions
 * up to the UI.
 *
 * `error.message` must be a clear, user-facing French message. Technical
 * details are logged server-side and never put in the result.
 */
export type ResultError = {
  /** Stable machine-readable code (English, snake_case). */
  code: string;
  /** User-facing message (French). */
  message: string;
};

export type Result<T> = { data: T; error: null } | { data: null; error: ResultError };

export function ok<T>(data: T): Result<T> {
  return { data, error: null };
}

export function fail<T = never>(code: string, message: string): Result<T> {
  return { data: null, error: { code, message } };
}

export function isOk<T>(result: Result<T>): result is { data: T; error: null } {
  return result.error === null;
}
