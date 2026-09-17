/**
 * Emma — relation: strict output schema.
 *
 * Emma writes WORDS. Everything else is decided by the code before she is even
 * called: who is relanced, through which channel, with which consent, when, and
 * with which unsubscribe notice. There is therefore NO field here for a
 * recipient, a channel, a date, a send, a pipeline stage or a consent — an
 * agent cannot express a decision it has no field for.
 *
 * The object is STRICT: any extra key (`send_now`, `channel`, `stage`…)
 * smuggled in by a prompt injection invalidates the whole answer, and an
 * invalid answer means "no draft at all + a task for a human".
 *
 * Two refinements protect the draft itself:
 *   * no link (a link in a message a human will approve is a phishing vector);
 *   * no amount in euros (an estimation figure is what engages the agency in
 *     front of a seller; an AI never produces one — the database refuses it on
 *     `properties.estimated_value_eur`, and this refusal closes the free-text
 *     way round).
 */

import { z } from "zod";

import { boundedText, confidenceSchema, noMoney, noUrl } from "@/lib/claude/schemas";

export const EMMA_SUBJECT_MAX = 150;
export const EMMA_BODY_MAX = 900;
export const EMMA_REASON_MAX = 300;

/** Closed vocabulary of what a follow-up may be about. Classification only. */
export const FOLLOW_UP_ANGLES = [
  "relance_sans_reponse",
  "reprise_apres_estimation",
  "information_marche",
  "demande_precision",
] as const;
export type FollowUpAngle = (typeof FOLLOW_UP_ANGLES)[number];

export const FOLLOW_UP_ANGLE_LABELS: Readonly<Record<FollowUpAngle, string>> = {
  relance_sans_reponse: "Relance après un message resté sans réponse",
  reprise_apres_estimation: "Reprise de contact après l'estimation",
  information_marche: "Information sur le marché du secteur",
  demande_precision: "Demande de précision sur le projet",
};

export const emmaFollowUpSchema = z
  .strictObject({
    /**
     * `null` for a channel that has no subject (SMS, WhatsApp). The CODE
     * decides whether the subject is kept, from the channel it chose itself.
     */
    message_subject: noMoney(noUrl(boundedText(EMMA_SUBJECT_MAX))).nullable(),
    message_body: noMoney(noUrl(boundedText(EMMA_BODY_MAX))),
    /** How Emma framed the message. Journaled, never used to decide anything. */
    angle: z.enum(FOLLOW_UP_ANGLES),
    /** Short, factual justification, journaled with the run. */
    reason: boundedText(EMMA_REASON_MAX),
    confidence: confidenceSchema,
  })
  .readonly();

export type EmmaFollowUp = z.infer<typeof emmaFollowUpSchema>;
