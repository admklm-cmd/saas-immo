/**
 * Hugo — qualification: pure decision logic (no database, no AI call).
 *
 * Two responsibilities, both kept out of the AI's hands:
 *
 *  A. MERGE — what may be written to the CRM. An existing value ALWAYS wins:
 *     Hugo only fills holes, and never writes `null` over an existing value.
 *
 *  B. PIPELINE STAGE — explicit, documented rules:
 *     1. The four required fields (type de bien, ville, motivation, délai) must
 *        be known, either already in the CRM or found in this run. Otherwise:
 *        stage unchanged + "information manquante" task. Nothing is invented.
 *     2. `confidence` must reach HUGO_CONFIDENCE_THRESHOLD (0.6). Below that:
 *        stage unchanged + "qualification à vérifier" task.
 *     3. Target stage: `chaud` when the project is immediate or under 3 months,
 *        `qualifie` otherwise.
 *     4. Hugo may only move a contact that is `nouveau` or `qualifie`, and only
 *        forward. He never reaches `rdv_planifie`, `estimation_faite`,
 *        `mandat_signe` (human-confirmed by product rule) nor `perdu`.
 */

import type { PipelineStage } from "@/lib/agents/types";

import {
  HOT_SALE_TIMELINES,
  HUGO_FIELDS,
  HUGO_REQUIRED_FIELDS,
  type HugoField,
  type HugoQualification,
  type HugoRequiredField,
  type PropertyTypeValue,
  type SaleMotivationValue,
  type SaleTimelineValue,
  SALE_MOTIVATION_LABELS,
  SALE_TIMELINE_LABELS,
} from "./schema";

export const HUGO_CONFIDENCE_THRESHOLD = 0.6;

/** Stages Hugo is allowed to leave. */
export const HUGO_MOVABLE_STAGES: readonly PipelineStage[] = ["nouveau", "qualifie"];

/** Forward-only ordering of the pipeline. `perdu` is outside the progression. */
const STAGE_RANK: Readonly<Record<PipelineStage, number>> = {
  nouveau: 0,
  qualifie: 1,
  chaud: 2,
  rdv_planifie: 3,
  estimation_faite: 4,
  mandat_signe: 5,
  perdu: -1,
};

export type StageDecisionReason =
  | "hot"
  | "qualified"
  | "missing_information"
  | "low_confidence"
  | "stage_locked";

export type StageDecision = {
  stage: PipelineStage;
  changed: boolean;
  reason: StageDecisionReason;
  missingFields: HugoRequiredField[];
};

export const HUGO_DECISION_TEXTS: Readonly<Record<StageDecisionReason, string>> = {
  hot: "Projet urgent et dossier complet : étape passée à « chaud ».",
  qualified: "Dossier complet : étape passée à « qualifié ».",
  missing_information:
    "Informations manquantes : étape inchangée, rien n'a été inventé, une tâche a été créée pour un conseiller.",
  low_confidence:
    "Qualification peu fiable : étape inchangée, une tâche de vérification a été créée pour un conseiller.",
  stage_locked:
    "Étape inchangée : Hugo ne modifie que les contacts « nouveau » ou « qualifié », et jamais en arrière.",
};

export function decideStage(input: {
  currentStage: PipelineStage;
  known: Readonly<Record<HugoRequiredField, boolean>>;
  timeline: SaleTimelineValue | null;
  confidence: number;
}): StageDecision {
  const missingFields = HUGO_REQUIRED_FIELDS.filter((field) => !input.known[field]);
  if (missingFields.length > 0) {
    return { stage: input.currentStage, changed: false, reason: "missing_information", missingFields };
  }

  if (input.confidence < HUGO_CONFIDENCE_THRESHOLD) {
    return { stage: input.currentStage, changed: false, reason: "low_confidence", missingFields: [] };
  }

  const isHot = input.timeline !== null && HOT_SALE_TIMELINES.includes(input.timeline);
  const target: PipelineStage = isHot ? "chaud" : "qualifie";
  const reason: StageDecisionReason = isHot ? "hot" : "qualified";

  if (!HUGO_MOVABLE_STAGES.includes(input.currentStage)) {
    return { stage: input.currentStage, changed: false, reason: "stage_locked", missingFields: [] };
  }
  if (STAGE_RANK[target] <= STAGE_RANK[input.currentStage]) {
    return { stage: input.currentStage, changed: false, reason, missingFields: [] };
  }

  return { stage: target, changed: true, reason, missingFields: [] };
}

// -----------------------------------------------------------------------------
// Merge
// -----------------------------------------------------------------------------
export type ExistingQualification = {
  saleMotivation: string | null;
  saleTimeline: string | null;
  propertyType: PropertyTypeValue | null;
  propertyCity: string | null;
  propertySector: string | null;
};

export type MergedQualification = {
  /** Whether each required field is known after the merge. */
  known: Record<HugoRequiredField, boolean>;
  /** Normalised timeline found by this run (null when only free CRM text exists). */
  timeline: SaleTimelineValue | null;
  /** Columns of `contacts` to write (only holes are filled). */
  contactUpdates: { sale_motivation?: string; sale_timeline?: string };
  /** Columns of `properties` to write (only holes are filled). */
  propertyUpdates: { property_type?: PropertyTypeValue; city?: string; sector?: string };
  /** Fields still unknown after the merge, for the human task and the UI. */
  missingFields: HugoField[];
};

export function mergeQualification(
  existing: ExistingQualification,
  output: HugoQualification,
): MergedQualification {
  const contactUpdates: MergedQualification["contactUpdates"] = {};
  const propertyUpdates: MergedQualification["propertyUpdates"] = {};

  const motivation: SaleMotivationValue | null = output.sale_motivation;
  if (existing.saleMotivation === null && motivation !== null) {
    contactUpdates.sale_motivation = SALE_MOTIVATION_LABELS[motivation];
  }
  if (existing.saleTimeline === null && output.sale_timeline !== null) {
    contactUpdates.sale_timeline = SALE_TIMELINE_LABELS[output.sale_timeline];
  }
  if (existing.propertyType === null && output.property_type !== null) {
    propertyUpdates.property_type = output.property_type;
  }
  if (existing.propertyCity === null && output.city !== null) {
    propertyUpdates.city = output.city;
  }
  if (existing.propertySector === null && output.sector !== null) {
    propertyUpdates.sector = output.sector;
  }

  const known: Record<HugoRequiredField, boolean> = {
    property_type: existing.propertyType !== null || output.property_type !== null,
    city: existing.propertyCity !== null || output.city !== null,
    sale_motivation: existing.saleMotivation !== null || output.sale_motivation !== null,
    sale_timeline: existing.saleTimeline !== null || output.sale_timeline !== null,
  };

  const sectorKnown = existing.propertySector !== null || output.sector !== null;
  const missingFields = HUGO_FIELDS.filter((field) =>
    field === "sector" ? !sectorKnown : !known[field as HugoRequiredField],
  );

  return {
    known,
    timeline: output.sale_timeline,
    contactUpdates,
    propertyUpdates,
    missingFields,
  };
}
