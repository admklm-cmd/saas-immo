import { describe, expect, it } from "vitest";

import type { PipelineStage } from "@/lib/agents/types";

import {
  checkEligibility,
  chooseChannel,
  composeMessageBody,
  LOUIS_ELIGIBLE_STAGES,
  UNSUBSCRIBE_NOTICE,
} from "./decision";

/**
 * These rules are applied by the CODE, never by the AI: who may be offered an
 * appointment, through which channel, and what every message must contain.
 */

const ALL_STAGES: readonly PipelineStage[] = [
  "nouveau",
  "qualifie",
  "chaud",
  "rdv_planifie",
  "estimation_faite",
  "mandat_signe",
  "perdu",
];

describe("checkEligibility", () => {
  it("n'accepte que les contacts qualifiés ou chauds", () => {
    for (const stage of ALL_STAGES) {
      const result = checkEligibility({ stage, hasActiveAppointment: false });
      expect(result.eligible, stage).toBe(LOUIS_ELIGIBLE_STAGES.includes(stage));
    }
  });

  it("refuse un contact encore « nouveau » avec une raison explicite", () => {
    const result = checkEligibility({ stage: "nouveau", hasActiveAppointment: false });
    expect(result).toEqual({ eligible: false, code: "appointment_stage_not_ready" });
  });

  it("refuse une deuxième réservation pour un contact qui a déjà un rendez-vous actif", () => {
    for (const stage of ALL_STAGES) {
      expect(checkEligibility({ stage, hasActiveAppointment: true })).toEqual({
        eligible: false,
        code: "appointment_already_scheduled",
      });
    }
  });
});

describe("chooseChannel", () => {
  it("choisit l'email quand il existe et que le consentement est valide", () => {
    expect(
      chooseChannel({ hasEmail: true, hasPhone: true, consents: { email: "granted", sms: "granted" } }),
    ).toEqual({ channel: "email" });
  });

  it("bascule sur le SMS quand l'email n'est pas consenti", () => {
    expect(
      chooseChannel({ hasEmail: true, hasPhone: true, consents: { email: "withdrawn", sms: "granted" } }),
    ).toEqual({ channel: "sms" });
  });

  it("refuse tout envoi sans consentement valide", () => {
    expect(chooseChannel({ hasEmail: true, hasPhone: true, consents: {} })).toEqual({
      channel: null,
      code: "consent_not_granted",
    });
    expect(
      chooseChannel({ hasEmail: true, hasPhone: true, consents: { email: "withdrawn", sms: "withdrawn" } }),
    ).toEqual({ channel: null, code: "consent_not_granted" });
  });

  it("ne se rabat jamais sur un canal dont le contact n'a pas les coordonnées", () => {
    // Consentement SMS accordé mais aucun numéro : rien n'est utilisable.
    expect(chooseChannel({ hasEmail: false, hasPhone: false, consents: { sms: "granted" } })).toEqual({
      channel: null,
      code: "appointment_no_reachable_channel",
    });
    // Email consenti mais absent, téléphone présent et consenti : SMS.
    expect(chooseChannel({ hasEmail: false, hasPhone: true, consents: { email: "granted", sms: "granted" } })).toEqual({
      channel: "sms",
    });
  });

  it("distingue « aucune coordonnée » de « pas de consentement »", () => {
    expect(chooseChannel({ hasEmail: false, hasPhone: false, consents: {} })).toEqual({
      channel: null,
      code: "appointment_no_reachable_channel",
    });
  });

  it("ne propose jamais le canal téléphone (ce n'est pas un message)", () => {
    const result = chooseChannel({ hasEmail: false, hasPhone: true, consents: { phone: "granted" } });
    expect(result).toEqual({ channel: null, code: "consent_not_granted" });
  });
});

describe("composeMessageBody", () => {
  it("ajoute toujours la mention de désinscription", () => {
    const body = composeMessageBody("Bonjour, je vous propose un rendez-vous mardi à 10:00.");
    expect(body).toContain(UNSUBSCRIBE_NOTICE);
    expect(body).toContain("STOP");
  });

  it("ne duplique pas la mention quand l'IA l'a déjà écrite", () => {
    const body = composeMessageBody("Bonjour. Répondez STOP pour ne plus être contacté.");
    expect(body.match(/STOP/g)).toHaveLength(1);
  });

  it("ajoute la signature de l'agence avant la mention légale", () => {
    const body = composeMessageBody("Bonjour.", "Calanques Immobilier");
    expect(body.indexOf("Calanques Immobilier")).toBeLessThan(body.indexOf(UNSUBSCRIBE_NOTICE));
  });

  it("nettoie les espaces superflus du texte de l'IA", () => {
    expect(composeMessageBody("   Bonjour.   ").startsWith("Bonjour.")).toBe(true);
  });
});
