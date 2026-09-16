/**
 * Minimal class-name joiner (no dependency needed for this).
 * Falsy values are dropped so conditional classes read cleanly.
 */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}
