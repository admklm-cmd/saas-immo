/**
 * Sarah — suivi: strict output schema.
 *
 * Sarah reads a meeting report WRITTEN BY A HUMAN and turns it into something
 * the agency can act on: a summary, a classification of where the seller
 * stands, the objections, the documents still missing, and the next actions.
 *
 * WHAT IS STRUCTURALLY IMPOSSIBLE HERE — and this is the whole point:
 *   * there is NO pipeline stage field. Sarah cannot express `mandat_signe`,
 *     nor any other stage: the stage is chosen by the code, from a whitelist
 *     that does not contain `mandat_signe` (CLAUDE.md: a mandate is always
 *     confirmed by a human, never auto-declared by an AI agent). Even a
 *     perfectly crafted malicious answer has no field to put it in, and the
 *     strict object refuses any extra key;
 *   * there is NO amount in euros, anywhere, and the free-text fields refuse
 *     one explicitly (`noMoney`): the figure that engages the agency in front
 *     of a seller is never produced by an AI;
 *   * there is no recipient, no channel, no send, no appointment date, and no
 *     way to write the report itself (`report_notes` belongs to the human who
 *     held the meeting, and the database stamps who wrote it and when).
 */

import { z } from "zod";

import {
  boundedText,
  confidenceSchema,
  noMoney,
  noUrl,
  SELLER_DECISIONS,
} from "@/lib/claude/schemas";

export const SARAH_SUMMARY_MAX = 800;
export const SARAH_ITEM_MAX = 160;
export const SARAH_STEP_TITLE_MAX = 120;
export const SARAH_STEP_DETAILS_MAX = 400;
export const SARAH_MAX_ITEMS = 5;
export const SARAH_MAX_NEXT_STEPS = 3;

/** Elements Sarah may find in a report; a missing one is reported, not guessed. */
export const SARAH_FIELDS = [
  "seller_decision",
  "objections",
  "missing_documents",
  "next_steps",
] as const;
export type SarahField = (typeof SARAH_FIELDS)[number];

const itemText = noMoney(noUrl(boundedText(SARAH_ITEM_MAX)));

/** One action a human will have to perform. Sarah proposes; nothing is executed. */
export const sarahNextStepSchema = z
  .strictObject({
    title: noMoney(noUrl(boundedText(SARAH_STEP_TITLE_MAX))),
    details: noMoney(noUrl(boundedText(SARAH_STEP_DETAILS_MAX))).nullable(),
  })
  .readonly();

export type SarahNextStep = z.infer<typeof sarahNextStepSchema>;

export const sarahFollowThroughSchema = z
  .strictObject({
    /** Factual summary of the report, in French, with nothing added to it. */
    summary: noMoney(noUrl(boundedText(SARAH_SUMMARY_MAX))),
    /** Classification, from a closed vocabulary. Never a decision. */
    seller_decision: z.enum(SELLER_DECISIONS),
    objections: z.array(itemText).max(SARAH_MAX_ITEMS),
    missing_documents: z.array(itemText).max(SARAH_MAX_ITEMS),
    next_steps: z.array(sarahNextStepSchema).max(SARAH_MAX_NEXT_STEPS),
    /**
     * Whether an estimation figure was presented during the meeting. A boolean,
     * deliberately: the amount itself is never written by an agent.
     */
    estimation_presented: z.boolean().nullable(),
    /** Self-reported; the code recomputes what it needs. */
    missing_fields: z.array(z.enum(SARAH_FIELDS)).max(SARAH_FIELDS.length),
    confidence: confidenceSchema,
  })
  .readonly();

export type SarahFollowThrough = z.infer<typeof sarahFollowThroughSchema>;
