/**
 * Validation of the arguments a server action receives from the browser.
 *
 * A server action is a public HTTP endpoint: its TypeScript signature is a
 * compile-time promise, not a runtime guarantee. Anything can be posted to it,
 * including a number, an object or a crafted string. CLAUDE.md therefore
 * requires every client input to be validated with a zod schema before any
 * processing — this is that boundary for the AI agents' actions.
 *
 * On failure the caller answers exactly like "this contact does not exist":
 * an error message must never tell an attacker whether an identifier is
 * well-formed, known, or belongs to another agency.
 */

import { z } from "zod";

/** Identifier of a contact, as sent by the UI. */
export const contactIdSchema = z.uuid();

/** Returns the validated contact id, or `null` when the input is not usable. */
export function parseContactId(value: unknown): string | null {
  const parsed = contactIdSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
