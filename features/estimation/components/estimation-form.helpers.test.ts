import { describe, expect, it } from "vitest";

import { APP_TEXTS } from "@/components/texts";
import { ESTIMATION_CONSENT_TEXTS } from "@/features/estimation/consent-texts";

import {
  buildEstimationInput,
  ESTIMATION_FIELD_KEYS,
  INITIAL_ESTIMATION_FORM_STATE,
  mapEstimationIssues,
} from "./estimation-form.helpers";

const TEXTS = APP_TEXTS.estimation;

describe("INITIAL_ESTIMATION_FORM_STATE", () => {
  /**
   * The legal guarantee of the whole screen: consent is a positive act
   * (CLAUDE.md). This asserts it on the state the form mounts with, so
   * pre-ticking a box can never pass as "just a default value" — and it walks
   * the canonical channel list, so a channel added later is covered too.
   */
  it("ne pré-coche aucun canal de consentement", () => {
    const channels = Object.keys(ESTIMATION_CONSENT_TEXTS);
    expect(Object.keys(INITIAL_ESTIMATION_FORM_STATE.consents).sort()).toEqual(channels.sort());

    for (const [channel, value] of Object.entries(INITIAL_ESTIMATION_FORM_STATE.consents)) {
      expect(value, `${channel} doit être décoché au départ`).toBe(false);
    }
    expect(Object.values(INITIAL_ESTIMATION_FORM_STATE.consents).some(Boolean)).toBe(false);
  });

  it("part d'un formulaire vide et d'un champ piège vide", () => {
    expect(INITIAL_ESTIMATION_FORM_STATE.firstName).toBe("");
    expect(INITIAL_ESTIMATION_FORM_STATE.website).toBe("");
  });
});

describe("buildEstimationInput", () => {
  it("transmet les consentements tels que le visiteur les a laissés", () => {
    const input = buildEstimationInput({
      ...INITIAL_ESTIMATION_FORM_STATE,
      firstName: "  Camille ",
      city: " La Ciotat ",
      email: " camille@example.test ",
      surfaceM2: "",
      consents: { ...INITIAL_ESTIMATION_FORM_STATE.consents, email: true },
    });

    expect(input.firstName).toBe("Camille");
    expect(input.city).toBe("La Ciotat");
    expect(input.email).toBe("camille@example.test");
    expect(input.surfaceM2).toBeNull();
    expect(input.consents).toEqual({ email: true, sms: false, whatsapp: false, phone: false });
  });
});

describe("mapEstimationIssues", () => {
  it("ne laisse remonter aucun message non traduit sur la surface et les pièces", () => {
    const mapped = mapEstimationIssues([
      { path: ["surfaceM2"], message: "Too small: expected number to be >0" },
      { path: ["rooms"], message: "Invalid input: expected int" },
    ]);

    expect(mapped.fields.surfaceM2).toBe(TEXTS.surfaceInvalid);
    expect(mapped.fields.rooms).toBe(TEXTS.roomsInvalid);
  });

  it("attache l'absence de consentement au groupe entier", () => {
    const mapped = mapEstimationIssues([{ path: ["consents"], message: "ignoré" }]);

    expect(mapped.consentGroup).toBe(TEXTS.consentGroupError);
    expect(mapped.consents).toEqual({});
  });

  it("applique le besoin de téléphone aux trois canaux téléphoniques", () => {
    const mapped = mapEstimationIssues([
      { path: ["consents", "phone"], message: "Un numéro de téléphone est nécessaire pour autoriser ce canal." },
    ]);

    expect(mapped.consents.sms).toBe("Un numéro de téléphone est nécessaire pour autoriser ce canal.");
    expect(mapped.consents.whatsapp).toBe(mapped.consents.sms);
    expect(mapped.consents.phone).toBe(mapped.consents.sms);
  });

  // The honeypot and the property type have no message slot on screen: a
  // message mapped there would be invisible, which is worse than none.
  it("ignore les chemins que l'écran n'affiche pas", () => {
    const mapped = mapEstimationIssues([
      { path: ["website"], message: "Texte trop long." },
      { path: ["propertyType"], message: "Invalid option" },
    ]);

    expect(mapped.fields).toEqual({});
    expect(mapped.consents).toEqual({});
    expect(mapped.consentGroup).toBeNull();
    expect(ESTIMATION_FIELD_KEYS).not.toContain("website");
  });
});
