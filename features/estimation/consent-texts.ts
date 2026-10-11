/**
 * Canonical consent texts of the public estimation form (`/estimation`).
 *
 * These strings are for DISPLAY only: the database never trusts them from a
 * caller. `private.estimation_consent_text()` in
 * `supabase/migrations/20260922120000_public_estimation_request.sql`
 * hardcodes the SAME text (byte for byte) and is the one actually recorded in
 * `consents.presented_text` — this file must stay in sync with it by hand.
 *
 * That hand-sync is CHECKED, not trusted: `estimation.integration.test.ts`
 * ("preuve du consentement") submits one real request per channel of this
 * record and compares `consents.presented_text` to the string below with
 * strict equality, so any drift between the two sides fails the test suite.
 *
 * If you change any wording here: change it in that SQL function too (through
 * a NEW migration — an applied migration is never edited), and bump
 * `ESTIMATION_CONSENT_VERSION` (and the version literal in the SQL function)
 * so a version alone never gets silently reused for a different text.
 * `consent-texts.test.ts` locks the current strings so an edit here is always
 * a deliberate, visible change.
 */

import type { Database } from "@/types/database";

export type EstimationConsentChannel = Database["public"]["Enums"]["consent_channel"];

export const ESTIMATION_CONSENT_VERSION = "estimation-2026-09-v1";

export const ESTIMATION_CONSENT_TEXTS: Readonly<Record<EstimationConsentChannel, string>> = {
  email:
    "J'accepte d'être recontacté(e) par l'agence par email au sujet de ma demande d'estimation. " +
    "Je peux retirer mon consentement à tout moment via le lien de désinscription présent dans chaque message.",
  sms:
    "J'accepte d'être recontacté(e) par l'agence par SMS au sujet de ma demande d'estimation. " +
    "Je peux retirer mon consentement à tout moment en répondant STOP.",
  whatsapp:
    "J'accepte d'échanger avec l'agence via WhatsApp au sujet de ma demande d'estimation. " +
    "Je peux retirer mon consentement à tout moment en répondant STOP.",
  phone:
    "J'accepte d'être appelé(e) par l'agence au sujet de ma demande d'estimation, aux horaires " +
    "autorisés par la loi (du lundi au vendredi, hors jours fériés, de 10h à 13h et de 14h à 20h). " +
    "Je peux retirer mon consentement à tout moment.",
};
