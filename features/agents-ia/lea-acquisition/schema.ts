/**
 * Léa — acquisition: strict output schema.
 *
 * Léa's whole job, on the AI side, is to read a raw lead and pull out the
 * IDENTITY of the person who wrote it — nothing more. There is deliberately no
 * field for:
 *   * a deduplication verdict (the code matches on normalised email and phone,
 *     see `dedupe.ts`) — a model must never decide that two sellers are the
 *     same person;
 *   * a pipeline stage, a consent, a channel, a message or a send;
 *   * a lead status (`processed` / `duplicate` / `rejected`), which is written
 *     by the code from the outcome it computed itself.
 *
 * The object is STRICT: any extra key — a `stage`, a `send_now`, a
 * `is_duplicate` smuggled in by a prompt injection — invalidates the whole
 * answer, and an invalid answer means "no business write at all + a task for a
 * human".
 *
 * `null` means "not written in the lead", and every `null` is reported in
 * `missing_fields`. Nothing is ever guessed from a first name, a domain name or
 * an area code.
 */

import { z } from "zod";

import { boundedText, confidenceSchema, nullableText } from "@/lib/claude/schemas";

/** Identity fields Léa may extract. A field left at `null` is reported missing. */
export const LEA_FIELDS = ["first_name", "last_name", "email", "phone"] as const;
export type LeaField = (typeof LEA_FIELDS)[number];

/**
 * Bounds mirror the `contacts` columns (100 / 320 / 25 characters). The phone
 * is given a little slack because a prospect writes "06 12 34 56 78 (le soir)";
 * the CODE then normalises it and drops it if it is not a usable number, rather
 * than invalidating the whole answer over a formatting habit.
 */
export const LEA_NAME_MAX = 100;
export const LEA_EMAIL_MAX = 320;
export const LEA_PHONE_MAX = 40;
export const LEA_SUMMARY_MAX = 400;

export const leaAcquisitionSchema = z
  .strictObject({
    first_name: nullableText(LEA_NAME_MAX),
    last_name: nullableText(LEA_NAME_MAX),
    /** Raw candidate: validated and normalised by the code before any write. */
    email: nullableText(LEA_EMAIL_MAX),
    /** Raw candidate: normalised by the code, dropped if unusable. */
    phone: nullableText(LEA_PHONE_MAX),
    /** Self-reported; the code recomputes the canonical list. */
    missing_fields: z.array(z.enum(LEA_FIELDS)).max(LEA_FIELDS.length),
    confidence: confidenceSchema,
    summary: boundedText(LEA_SUMMARY_MAX),
  })
  .readonly();

export type LeaAcquisition = z.infer<typeof leaAcquisitionSchema>;
