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

/** Identifier of a row, as sent by the UI (contact, lead, appointment, run). */
export const uuidSchema = z.uuid();

/** Identifier of a contact, as sent by the UI. */
export const contactIdSchema = uuidSchema;

/** Returns the validated identifier, or `null` when the input is not usable. */
export function parseUuid(value: unknown): string | null {
  const parsed = uuidSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Returns the validated contact id, or `null` when the input is not usable. */
export function parseContactId(value: unknown): string | null {
  return parseUuid(value);
}
