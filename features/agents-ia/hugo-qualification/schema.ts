/**
 * Hugo — qualification: strict output schema.
 *
 * Every field is bounded: closed enums where a vocabulary exists, maximum
 * lengths elsewhere. The object is STRICT: any extra key (for example a
 * `stage` smuggled in by a prompt injection) makes the whole answer invalid,
 * and an invalid answer means "no action at all + a task for a human".
 *
 * There is deliberately NO field through which the agent could decide a
 * pipeline stage, a recipient, a channel or a send: those belong to the code.
 */

import { z } from "zod";

import {
  boundedText,
  confidenceSchema,
  nullableText,
  PROPERTY_TYPES,
  SALE_MOTIVATIONS,
  SALE_TIMELINES,
} from "@/lib/claude/schemas";

export {
  HOT_SALE_TIMELINES,
  PROPERTY_TYPE_LABELS,
  PROPERTY_TYPES,
  SALE_MOTIVATION_LABELS,
  SALE_MOTIVATIONS,
  SALE_TIMELINE_LABELS,
  SALE_TIMELINES,
  type PropertyTypeValue,
  type SaleMotivationValue,
  type SaleTimelineValue,
} from "@/lib/claude/schemas";

/** Fields Hugo can fill; a field left at `null` is reported as missing. */
export const HUGO_FIELDS = ["property_type", "city", "sector", "sale_motivation", "sale_timeline"] as const;
export type HugoField = (typeof HUGO_FIELDS)[number];

/** Fields required before a contact can be considered qualified. */
export const HUGO_REQUIRED_FIELDS = ["property_type", "city", "sale_motivation", "sale_timeline"] as const;
export type HugoRequiredField = (typeof HUGO_REQUIRED_FIELDS)[number];

export const hugoQualificationSchema = z
  .strictObject({
    property_type: z.enum(PROPERTY_TYPES).nullable(),
    city: nullableText(120),
    sector: nullableText(200),
    sale_motivation: z.enum(SALE_MOTIVATIONS).nullable(),
    sale_timeline: z.enum(SALE_TIMELINES).nullable(),
    /** Self-reported by the agent; the code recomputes the canonical list. */
    missing_fields: z.array(z.enum(HUGO_FIELDS)).max(HUGO_FIELDS.length),
    confidence: confidenceSchema,
    summary: boundedText(500),
  })
  .readonly();

export type HugoQualification = z.infer<typeof hugoQualificationSchema>;
