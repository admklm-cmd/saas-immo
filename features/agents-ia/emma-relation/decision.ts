/**
 * Emma — relation: pure decision logic (no database, no AI call).
 *
 * Everything that has a legal or business consequence is decided here, by the
 * code, and is unit-tested:
 *
 *  A. ELIGIBILITY — who may be relanced at all. A closed file (`perdu`) and a
 *     signed mandate (`mandat_signe`) are not relanced; a file taken over by a
 *     human is stopped even earlier, by the shared guard rails.
 *  B. NO SECOND DRAFT — a follow-up already waiting for validation is not
 *     replaced by another one. The agency must never discover two messages for
 *     the same person, and a member must never validate a stale duplicate.
 *  C. IDEMPOTENCY KEY — deterministic, so the database itself refuses a double
 *     draft (`outbound_messages_idempotency_key`, unique per agency) even if two
 *     runs race.
 *
 * The channel and the consent are decided by the shared rule in
 * `lib/agents/consent.ts`: the same code path as Louis, so the two agents can
 * never drift apart on the one rule that has legal consequences.
 *
 * Nothing here can be influenced by the prospect's text: these functions only
 * see structured CRM values.
 */

import { parisDayKey } from "@/lib/agents/time";
import type { PipelineStage } from "@/lib/agents/types";

export {
  CHANNEL_LABELS,
  CHANNEL_PREFERENCE,
  chooseChannel,
  composeMessageBody,
  UNSUBSCRIBE_NOTICE,
  type ChannelInput,
  type ChannelResult,
  type MessageChannel,
} from "@/lib/agents/consent";

/**
 * Stages Emma may prepare a follow-up for.
 * `mandat_signe` is excluded: the mandate is signed, there is nothing to relance
 * and a "follow-up" there would be a commercial message of another nature.
 * `perdu` is excluded: the seller said no, or went elsewhere. Relancing a closed
 * file is exactly what the product promises never to do.
 */
export const EMMA_ELIGIBLE_STAGES: readonly PipelineStage[] = [
  "nouveau",
  "qualifie",
  "chaud",
  "rdv_planifie",
  "estimation_faite",
];

/** Channels that carry a subject line. SMS and WhatsApp do not. */
export const CHANNELS_WITH_SUBJECT = ["email"] as const;

export type EmmaEligibilityInput = {
  stage: PipelineStage;
  /** True when a draft written by Emma is already waiting for validation. */
  hasPendingFollowUp: boolean;
};

export type EmmaEligibilityRefusal = "follow_up_stage_not_eligible" | "follow_up_already_drafted";

export type EmmaEligibilityResult =
  | { eligible: true }
  | { eligible: false; code: EmmaEligibilityRefusal };

export function checkFollowUpEligibility(input: EmmaEligibilityInput): EmmaEligibilityResult {
  // Checked first: even for an eligible stage, a pending draft wins.
  if (input.hasPendingFollowUp) {
    return { eligible: false, code: "follow_up_already_drafted" };
  }
  if (!EMMA_ELIGIBLE_STAGES.includes(input.stage)) {
    return { eligible: false, code: "follow_up_stage_not_eligible" };
  }
  return { eligible: true };
}

/**
 * Deterministic idempotency key of a follow-up: one per contact and per Paris
 * calendar day. Two runs on the same contact the same day produce the same key,
 * and the unique index refuses the second insert — the anti-double-send rule is
 * held by the database, not only by the code above.
 */
export function followUpIdempotencyKey(contactId: string, now: Date = new Date()): string {
  return `emma-${contactId}-${parisDayKey(now)}`;
}

export const EMMA_DECISION_TEXTS = {
  drafted:
    "Brouillon de relance préparé et mis en attente de validation : rien n'a été envoyé, le consentement du canal a été vérifié avant rédaction.",
  not_eligible:
    "Contact non éligible à une relance automatique : aucun brouillon n'a été préparé.",
  already_drafted:
    "Une relance est déjà en attente de validation pour ce contact : aucun second brouillon n'a été créé.",
  consent_missing:
    "Aucun consentement valide pour joindre ce contact : aucun brouillon préparé, une tâche a été créée pour un conseiller.",
  channel_missing:
    "Aucune coordonnée exploitable pour ce contact : aucun brouillon préparé, une tâche a été créée pour un conseiller.",
  invalid_output:
    "Repli sûr : réponse IA invalide, aucun brouillon préparé, tâche créée pour un humain.",
} as const;

export type EmmaDecisionReason = keyof typeof EMMA_DECISION_TEXTS;

/** Agent-specific step labels (the shared ones live in lib/agents/messages.ts). */
export const EMMA_STEP_LABELS = {
  rules_applied:
    "Règles du code appliquées : éligibilité, canal et consentement courant vérifiés, clé d'idempotence calculée.",
  drafted: "Brouillon créé en « à valider », marqué simulation : rien n'est envoyé.",
} as const;
