/**
 * Louis — rendez-vous: pure decision logic (no database, no AI call).
 *
 * Everything that has a legal or business consequence is decided here, by the
 * code, and is unit-tested:
 *
 *  A. ELIGIBILITY — who may be offered an estimation appointment at all.
 *  B. CHANNEL — through which channel the draft may be written. A channel is
 *     usable only if the contact can be reached on it AND the CURRENT consent
 *     for that channel is `granted`. No consent, no draft.
 *  C. MESSAGE — the unsubscribe notice is appended by the code, always, so that
 *     it cannot depend on what the model felt like writing.
 *
 * B and C are the same rule for every agent that prepares a message (Louis,
 * Emma), so they live in `lib/agents/consent.ts` and are re-exported here: one
 * implementation, one set of tests, no chance of the two agents drifting apart
 * on the one rule that has legal consequences.
 *
 * Nothing here can be influenced by the prospect's text: these functions only
 * see structured CRM values.
 */

import type { PipelineStage } from "@/lib/agents/types";

export {
  CHANNEL_LABELS,
  CHANNEL_PREFERENCE,
  chooseChannel,
  composeMessageBody,
  UNSUBSCRIBE_NOTICE,
  type ChannelInput,
  type ChannelRefusal,
  type ChannelResult,
  type MessageChannel,
} from "@/lib/agents/consent";

/**
 * Stages from which Louis may propose an estimation appointment.
 * `nouveau` is excluded on purpose: a contact must be qualified first (Hugo or
 * a human). Later stages already have an appointment or are closed.
 */
export const LOUIS_ELIGIBLE_STAGES: readonly PipelineStage[] = ["qualifie", "chaud"];

export type EligibilityInput = {
  stage: PipelineStage;
  /** True when a `proposed` or `confirmed` appointment already exists. */
  hasActiveAppointment: boolean;
};

export type EligibilityRefusal = "appointment_stage_not_ready" | "appointment_already_scheduled";

export type EligibilityResult = { eligible: true } | { eligible: false; code: EligibilityRefusal };

export function checkEligibility(input: EligibilityInput): EligibilityResult {
  // No double booking of the same contact, whatever the pipeline stage says.
  if (input.hasActiveAppointment) {
    return { eligible: false, code: "appointment_already_scheduled" };
  }
  if (!LOUIS_ELIGIBLE_STAGES.includes(input.stage)) {
    return { eligible: false, code: "appointment_stage_not_ready" };
  }
  return { eligible: true };
}

export const LOUIS_DECISION_TEXTS = {
  proposed:
    "Créneau d'estimation proposé et message préparé : le rendez-vous reste « proposé » et le message attend la validation d'un conseiller.",
  no_slot:
    "Aucun créneau libre sur les prochains jours ouvrés : rien n'a été réservé, une tâche a été créée pour un conseiller.",
  not_eligible:
    "Contact non éligible à une proposition de rendez-vous : aucune action.",
  consent_missing:
    "Aucun consentement valide pour joindre ce contact : aucun message préparé, une tâche a été créée pour un conseiller.",
  channel_missing:
    "Aucune coordonnée exploitable pour ce contact : aucun message préparé, une tâche a été créée pour un conseiller.",
  slot_taken:
    "Le créneau a été pris entre-temps : la base a refusé la double réservation, aucune action.",
  invalid_output:
    "Repli sûr : réponse IA invalide ou créneau hors liste, aucune action, tâche créée pour un humain.",
} as const;

export type LouisDecisionReason = keyof typeof LOUIS_DECISION_TEXTS;
