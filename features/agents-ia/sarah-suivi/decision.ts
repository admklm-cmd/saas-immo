/**
 * Sarah — suivi: pure decision logic (no database, no AI call).
 *
 * THE RULE THIS FILE EXISTS FOR: **Sarah can never reach `mandat_signe`.**
 * CLAUDE.md requires a signed mandate to be confirmed by a human, always. That
 * guarantee is structural, not a matter of prompting, and it is held in two
 * independent places:
 *
 *   1. Sarah's output schema has NO stage field at all — there is nothing to
 *      put a stage in, and the strict object refuses any extra key;
 *   2. the stage is chosen HERE, by the code, from an explicit WHITELIST
 *      (`SARAH_ALLOWED_TARGET_STAGES`). Anything outside it — `mandat_signe`,
 *      `perdu`, going backwards — is simply not expressible.
 *
 * `perdu` is excluded for the same reason in the other direction: declaring a
 * seller lost closes a file and stops every follow-up. A human does that.
 *
 * Eligibility is equally simple: without a report written by a human, Sarah has
 * nothing to work from, and inventing one is out of the question.
 */

import type { PipelineStage } from "@/lib/agents/types";
import { SELLER_DECISION_LABELS, type SellerDecisionValue } from "@/lib/claude/schemas";

import type { SarahFollowThrough } from "./schema";

export const SARAH_CONFIDENCE_THRESHOLD = 0.5;

/**
 * The ONLY stage Sarah may ever set. An estimation appointment took place and
 * its report is written: the file is at "estimation faite". Everything after
 * that (mandate, loss) belongs to a human.
 */
export const SARAH_ALLOWED_TARGET_STAGES: readonly PipelineStage[] = ["estimation_faite"];

/** Stages Sarah is allowed to leave: only those that come before the target. */
export const SARAH_MOVABLE_STAGES: readonly PipelineStage[] = ["qualifie", "chaud", "rdv_planifie"];

export type SarahDecisionReason =
  | "followed_through"
  | "stage_locked"
  | "low_confidence"
  | "report_missing"
  | "invalid_output";

export type SarahStageDecision = {
  stage: PipelineStage;
  changed: boolean;
  reason: Extract<SarahDecisionReason, "followed_through" | "stage_locked" | "low_confidence">;
};

/**
 * Decides the stage of the contact after an estimation appointment.
 *
 * Deliberately takes NOTHING from the AI output except a confidence number: the
 * seller's answer (`seller_decision`) is journaled and displayed, but it can
 * never move the pipeline on its own — `refus` does not close the file, and
 * `mandat_envisage` does not sign anything.
 */
export function decideFollowThroughStage(input: {
  currentStage: PipelineStage;
  confidence: number;
}): SarahStageDecision {
  if (input.confidence < SARAH_CONFIDENCE_THRESHOLD) {
    return { stage: input.currentStage, changed: false, reason: "low_confidence" };
  }

  const target = SARAH_ALLOWED_TARGET_STAGES[0]!;
  if (!SARAH_MOVABLE_STAGES.includes(input.currentStage)) {
    // `nouveau`, `estimation_faite`, `mandat_signe`, `perdu`: untouched.
    return { stage: input.currentStage, changed: false, reason: "stage_locked" };
  }
  return { stage: target, changed: true, reason: "followed_through" };
}

/**
 * Last line of defence, in the code this time: whatever happens upstream, the
 * stage Sarah writes must be in the whitelist. Used right before the update, so
 * a future refactoring cannot widen what she is allowed to do without failing
 * this check (and its test).
 */
export function isStageAllowedForSarah(stage: PipelineStage): boolean {
  return SARAH_ALLOWED_TARGET_STAGES.includes(stage);
}

// -----------------------------------------------------------------------------
// Tasks derived from the report — by the code, with stable types
// -----------------------------------------------------------------------------

/**
 * Which human tasks this report leads to. The task TYPE is chosen by the code
 * from a closed set (the unique index on open tasks is per contact and per
 * type), never from the model's wording.
 */
export type SarahTaskPlan = {
  nextSteps: string[];
  missingDocuments: string[];
};

export function planFollowThroughTasks(output: SarahFollowThrough): SarahTaskPlan {
  return {
    nextSteps: output.next_steps.map((step) =>
      step.details ? `${step.title} — ${step.details}` : step.title,
    ),
    missingDocuments: [...output.missing_documents],
  };
}

export function sellerDecisionLabel(decision: SellerDecisionValue): string {
  return SELLER_DECISION_LABELS[decision];
}

export const SARAH_DECISION_TEXTS: Readonly<Record<SarahDecisionReason, string>> = {
  followed_through:
    "Compte-rendu exploité : étape passée à « estimation faite » et prochaines actions ouvertes pour un conseiller. Aucun mandat n'est déclaré : seul un humain peut le confirmer.",
  stage_locked:
    "Étape inchangée : Sarah ne fait avancer un dossier que jusqu'à « estimation faite », jamais au-delà et jamais en arrière.",
  low_confidence:
    "Suivi peu fiable à partir de ce compte-rendu : étape inchangée, une tâche de vérification a été créée pour un conseiller.",
  report_missing:
    "Aucun compte-rendu de rendez-vous : rien n'a été déduit, une tâche de saisie a été créée pour le conseiller.",
  invalid_output:
    "Repli sûr : réponse IA invalide, aucune écriture, tâche créée pour un humain.",
};

/** Agent-specific step labels (the shared ones live in lib/agents/messages.ts). */
export const SARAH_STEP_LABELS = {
  report_loaded: "Rendez-vous et compte-rendu rédigé par un conseiller chargés.",
  persisted: "Suivi enregistré : étape, tâches de suivi et historique CRM mis à jour.",
  concurrent_stage_change:
    "Dossier modifié pendant l'analyse : la décision humaine est conservée et Sarah n'écrit rien.",
  persistence_failed:
    "Suivi interrompu : une écriture ou sa journalisation a échoué, l'exécution n'est pas déclarée réussie.",
} as const;
