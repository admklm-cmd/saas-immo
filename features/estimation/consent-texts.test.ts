import { describe, expect, it } from "vitest";

import { ESTIMATION_CONSENT_TEXTS, ESTIMATION_CONSENT_VERSION } from "./consent-texts";

/**
 * Locks the exact strings recorded as legal evidence (`consents.presented_text`).
 * These MUST stay byte-identical to `private.estimation_consent_text()` in
 * `supabase/migrations/20260922120000_public_estimation_request.sql` — see
 * that function and this file's header comment before editing either one.
 */
describe("ESTIMATION_CONSENT_TEXTS", () => {
  it("a un texte non vide pour chacun des quatre canaux", () => {
    expect(Object.keys(ESTIMATION_CONSENT_TEXTS).sort()).toEqual(["email", "phone", "sms", "whatsapp"]);
    for (const text of Object.values(ESTIMATION_CONSENT_TEXTS)) {
      expect(text.length).toBeGreaterThan(0);
      expect(text.length).toBeLessThanOrEqual(5000);
    }
  });

  it("mentionne le moyen de retrait attendu par canal (STOP pour SMS/WhatsApp, lien pour email)", () => {
    expect(ESTIMATION_CONSENT_TEXTS.email).toContain("désinscription");
    expect(ESTIMATION_CONSENT_TEXTS.sms).toContain("STOP");
    expect(ESTIMATION_CONSENT_TEXTS.whatsapp).toContain("STOP");
    expect(ESTIMATION_CONSENT_TEXTS.phone).toContain("10h");
  });

  it("garde exactement la version attendue", () => {
    expect(ESTIMATION_CONSENT_VERSION).toBe("estimation-2026-09-v1");
  });

  it("verrouille le texte exact présenté (toute modification doit être délibérée)", () => {
    expect(ESTIMATION_CONSENT_TEXTS.email).toBe(
      "J'accepte d'être recontacté(e) par l'agence par email au sujet de ma demande d'estimation. " +
        "Je peux retirer mon consentement à tout moment via le lien de désinscription présent dans chaque message.",
    );
    expect(ESTIMATION_CONSENT_TEXTS.sms).toBe(
      "J'accepte d'être recontacté(e) par l'agence par SMS au sujet de ma demande d'estimation. " +
        "Je peux retirer mon consentement à tout moment en répondant STOP.",
    );
    expect(ESTIMATION_CONSENT_TEXTS.whatsapp).toBe(
      "J'accepte d'échanger avec l'agence via WhatsApp au sujet de ma demande d'estimation. " +
        "Je peux retirer mon consentement à tout moment en répondant STOP.",
    );
    expect(ESTIMATION_CONSENT_TEXTS.phone).toBe(
      "J'accepte d'être appelé(e) par l'agence au sujet de ma demande d'estimation, aux horaires " +
        "autorisés par la loi (du lundi au vendredi, hors jours fériés, de 10h à 13h et de 14h à 20h). " +
        "Je peux retirer mon consentement à tout moment.",
    );
  });
});
