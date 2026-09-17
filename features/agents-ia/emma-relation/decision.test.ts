import { describe, expect, it } from "vitest";

import type { PipelineStage } from "@/lib/agents/types";

import {
  checkFollowUpEligibility,
  chooseChannel,
  composeMessageBody,
  EMMA_ELIGIBLE_STAGES,
  followUpIdempotencyKey,
  UNSUBSCRIBE_NOTICE,
} from "./decision";

/**
 * These rules are applied by the CODE, never by the AI: who may be relanced,
 * through which channel, with which consent, and with which key — so that a
 * second draft is impossible even if two runs race.
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

const CONTACT_ID = "11111111-1111-4111-8111-111111111111";

describe("éligibilité à une relance", () => {
  it("n'autorise que les étapes prévues, jamais un dossier clos ou un mandat signé", () => {
    for (const stage of ALL_STAGES) {
      const result = checkFollowUpEligibility({ stage, hasPendingFollowUp: false });
      expect(result.eligible, stage).toBe(EMMA_ELIGIBLE_STAGES.includes(stage));
    }
    expect(EMMA_ELIGIBLE_STAGES).not.toContain("mandat_signe");
    expect(EMMA_ELIGIBLE_STAGES).not.toContain("perdu");
  });

  it("refuse explicitement un dossier perdu et un mandat signé", () => {
    for (const stage of ["perdu", "mandat_signe"] as const) {
      const result = checkFollowUpEligibility({ stage, hasPendingFollowUp: false });
      expect(result.eligible).toBe(false);
      expect(result.eligible === false && result.code).toBe("follow_up_stage_not_eligible");
    }
  });

  it("refuse une seconde relance quand un brouillon attend déjà une validation", () => {
    const result = checkFollowUpEligibility({ stage: "chaud", hasPendingFollowUp: true });
    expect(result.eligible).toBe(false);
    expect(result.eligible === false && result.code).toBe("follow_up_already_drafted");
  });

  it("le brouillon en attente l'emporte même sur une étape éligible", () => {
    for (const stage of EMMA_ELIGIBLE_STAGES) {
      expect(checkFollowUpEligibility({ stage, hasPendingFollowUp: true }).eligible).toBe(false);
    }
  });
});

describe("canal et consentement (règle partagée avec Louis)", () => {
  it("refuse tout brouillon sans consentement accordé", () => {
    expect(chooseChannel({ hasEmail: true, hasPhone: true, consents: {} })).toEqual({
      channel: null,
      code: "consent_not_granted",
    });
  });

  it("un consentement retiré n'est pas un consentement", () => {
    expect(
      chooseChannel({ hasEmail: true, hasPhone: false, consents: { email: "withdrawn" } }),
    ).toEqual({ channel: null, code: "consent_not_granted" });
  });

  it("retombe sur un autre canal consenti, dans l'ordre le moins intrusif", () => {
    expect(
      chooseChannel({
        hasEmail: true,
        hasPhone: true,
        consents: { email: "withdrawn", sms: "granted" },
      }),
    ).toEqual({ channel: "sms" });
    expect(
      chooseChannel({ hasEmail: true, hasPhone: true, consents: { email: "granted", sms: "granted" } }),
    ).toEqual({ channel: "email" });
  });

  it("distingue « pas joignable » de « pas de consentement »", () => {
    expect(
      chooseChannel({ hasEmail: false, hasPhone: false, consents: { email: "granted" } }),
    ).toEqual({ channel: null, code: "appointment_no_reachable_channel" });
  });

  it("un consentement téléphonique n'autorise jamais un message", () => {
    expect(
      chooseChannel({ hasEmail: true, hasPhone: true, consents: { phone: "granted" } }),
    ).toEqual({ channel: null, code: "consent_not_granted" });
  });
});

describe("mention de désinscription", () => {
  it("est ajoutée par le code à tout message qui n'en contient pas", () => {
    expect(composeMessageBody("Bonjour, où en êtes-vous ?")).toContain(UNSUBSCRIBE_NOTICE);
  });

  it("n'est pas dupliquée quand le message contient déjà STOP", () => {
    const body = composeMessageBody("Bonjour. Répondez STOP pour ne plus être contacté.");
    expect(body).not.toContain(UNSUBSCRIBE_NOTICE);
  });
});

describe("clé d'idempotence d'une relance", () => {
  it("est stable pour un même contact sur une même journée parisienne", () => {
    const morning = new Date("2026-09-16T07:00:00Z");
    const evening = new Date("2026-09-16T20:30:00Z");
    expect(followUpIdempotencyKey(CONTACT_ID, morning)).toBe(
      followUpIdempotencyKey(CONTACT_ID, evening),
    );
  });

  it("change de jour parisien, pas de jour UTC", () => {
    // 22:30 UTC le 16 = 00:30 le 17 à Paris (heure d'été) : jour suivant.
    const parisNextDay = new Date("2026-09-16T22:30:00Z");
    const parisSameDay = new Date("2026-09-16T21:30:00Z");
    expect(followUpIdempotencyKey(CONTACT_ID, parisNextDay)).not.toBe(
      followUpIdempotencyKey(CONTACT_ID, parisSameDay),
    );
  });

  it("diffère d'un contact à l'autre et respecte les bornes de la base (8 à 200)", () => {
    const key = followUpIdempotencyKey(CONTACT_ID, new Date("2026-09-16T09:00:00Z"));
    expect(key).not.toBe(
      followUpIdempotencyKey("22222222-2222-4222-8222-222222222222", new Date("2026-09-16T09:00:00Z")),
    );
    expect(key.length).toBeGreaterThanOrEqual(8);
    expect(key.length).toBeLessThanOrEqual(200);
  });
});
