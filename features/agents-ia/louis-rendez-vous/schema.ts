/**
 * Louis — rendez-vous: strict output schema.
 *
 * What Louis is allowed to produce is deliberately tiny:
 *   * `slot_id`: the identifier of ONE slot, taken from the closed list the
 *     code computed (`slots.ts`). Louis never writes a date, an hour or a time
 *     zone: he cannot invent a slot, only choose one that is already known to
 *     be legal and free.
 *   * the wording of the message.
 *
 * There is NO field for a recipient, a channel, a send, a pipeline stage or a
 * confirmation: all of those belong to the code and to the humans of the agency.
 * The object is STRICT, so any extra key smuggled in by a prompt injection
 * invalidates the whole answer — and an invalid answer means "no action at all
 * plus a task for a human".
 */

import { z } from "zod";

import { boundedText, confidenceSchema } from "@/lib/claude/schemas";

export const LOUIS_SLOT_ID_MAX = 60;
export const LOUIS_SUBJECT_MAX = 150;
export const LOUIS_BODY_MAX = 1200;
export const LOUIS_REASON_MAX = 300;

/**
 * No URL may come out of the model: a link is the easiest way to turn a
 * human-validated message into a phishing vector. Links, when the product needs
 * them (unsubscribe page), are added by the code.
 */
const URL_PATTERN = /(https?:\/\/|www\.)/i;

function noUrl<T extends z.ZodType<string>>(schema: T) {
  return schema.refine((value) => !URL_PATTERN.test(value), {
    message: "aucun lien n'est autorisé dans un message rédigé par l'IA",
  });
}

const baseShape = {
  slot_id: z.string().trim().min(1).max(LOUIS_SLOT_ID_MAX),
  message_subject: noUrl(boundedText(LOUIS_SUBJECT_MAX)),
  message_body: noUrl(boundedText(LOUIS_BODY_MAX)),
  /** Short, factual justification of the chosen slot, journaled with the run. */
  reason: boundedText(LOUIS_REASON_MAX),
  confidence: confidenceSchema,
};

/** Shape without the "must be in the offered list" rule (documentation, tests). */
export const louisAppointmentSchema = z.strictObject(baseShape).readonly();

export type LouisAppointment = z.infer<typeof louisAppointmentSchema>;

/**
 * Schema actually used at run time: `slot_id` must be one of the identifiers
 * the code offered for THIS run. Anything else — a hallucinated slot, a date
 * written by hand, an identifier from another run — fails validation, so no
 * appointment is ever created outside the computed list.
 */
export function createLouisAppointmentSchema(allowedSlotIds: readonly string[]) {
  const allowed = new Set(allowedSlotIds);
  return z
    .strictObject({
      ...baseShape,
      slot_id: baseShape.slot_id.refine((id) => allowed.has(id), {
        message: "créneau hors de la liste calculée par le code",
      }),
    })
    .readonly();
}

export type LouisAppointmentSchema = ReturnType<typeof createLouisAppointmentSchema>;
