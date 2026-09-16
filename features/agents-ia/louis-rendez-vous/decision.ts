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
 * Nothing here can be influenced by the prospect's text: these functions only
 * see structured CRM values.
 */

import type { Database } from "@/types/database";

import type { PipelineStage } from "@/lib/agents/types";

type ConsentChannel = Database["public"]["Enums"]["consent_channel"];
type ConsentStatus = Database["public"]["Enums"]["consent_status"];

/** Channels a message can actually be drafted for (`phone` is not a message). */
export type MessageChannel = Exclude<ConsentChannel, "phone">;

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

// -----------------------------------------------------------------------------
// Channel
// -----------------------------------------------------------------------------

/** Preference order: the least intrusive channel first. */
export const CHANNEL_PREFERENCE: readonly MessageChannel[] = ["email", "sms", "whatsapp"];

export type ChannelInput = {
  hasEmail: boolean;
  hasPhone: boolean;
  /** Current consent per channel (most recent row per channel), if any. */
  consents: Partial<Record<ConsentChannel, ConsentStatus>>;
};

export type ChannelRefusal = "appointment_no_reachable_channel" | "consent_not_granted";

export type ChannelResult = { channel: MessageChannel } | { channel: null; code: ChannelRefusal };

/**
 * Picks the channel of the draft. Refuses — with a distinct reason — when the
 * contact has no usable address at all, and when an address exists but no valid
 * consent covers it.
 */
export function chooseChannel(input: ChannelInput): ChannelResult {
  const reachable = CHANNEL_PREFERENCE.filter((channel) =>
    channel === "email" ? input.hasEmail : input.hasPhone,
  );

  if (reachable.length === 0) {
    return { channel: null, code: "appointment_no_reachable_channel" };
  }

  const granted = reachable.find((channel) => input.consents[channel] === "granted");
  if (!granted) {
    return { channel: null, code: "consent_not_granted" };
  }
  return { channel: granted };
}

// -----------------------------------------------------------------------------
// Message
// -----------------------------------------------------------------------------

/**
 * Opt-out notice required in every message sent to a private individual.
 * Added by the code, never left to the model.
 */
export const UNSUBSCRIBE_NOTICE = "Pour ne plus recevoir de messages de notre part, répondez STOP.";

/** Detects an opt-out keyword already present in the body (avoids duplicates). */
const STOP_PATTERN = /\bSTOP\b/;

export function composeMessageBody(body: string, signature?: string | null): string {
  const parts = [body.trim()];
  if (signature && signature.trim().length > 0) parts.push(signature.trim());
  if (!STOP_PATTERN.test(body)) parts.push(UNSUBSCRIBE_NOTICE);
  return parts.join("\n\n");
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
