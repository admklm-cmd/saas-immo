/**
 * Léa — acquisition: pure decision logic (no database, no AI call).
 *
 * Three responsibilities, all kept out of the AI's hands:
 *
 *  A. MERGE — the STRUCTURED payload of the lead (form fields, partner API
 *     body) always wins over what the model read in the free text. The model
 *     only fills holes, and never overwrites a value the agency already has.
 *  B. SANITISE — an email or a phone number is only kept if it is usable as
 *     written in the CRM (the `contacts` table has CHECK constraints on both).
 *     A value the code cannot use becomes "missing", never "approximated".
 *  C. OUTCOME — what happens to the lead: a contact record is created, an exact
 *     duplicate was found, or the lead is too thin to act on. This is decided
 *     by the code from facts, never by the model.
 *
 * A lead is NEVER a consent: whatever the outcome, nothing may be sent to this
 * person until a consent is recorded (CLAUDE.md, socle légal).
 */

import { LEA_FIELDS, type LeaAcquisition, type LeaField } from "./schema";
import { normalisePhone, type DuplicateMatch } from "./dedupe";

/**
 * Mirrors the CHECK constraints of `public.contacts`, so the code never sends
 * the database a value it is going to refuse.
 */
const CONTACT_EMAIL_PATTERN = /^[^@\s]+@[^@\s]+$/;
const CONTACT_EMAIL_MAX = 320;
const CONTACT_PHONE_PATTERN = /^\+?[0-9 .()-]{6,25}$/;
const CONTACT_NAME_MAX = 100;

/** Identity fields of the lead's structured payload (trusted, not free text). */
export type LeadPayloadIdentity = {
  first_name?: unknown;
  last_name?: unknown;
  email?: unknown;
  phone?: unknown;
};

function payloadText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= max ? trimmed : null;
}

/** Keeps an email only if the `contacts` table will accept it. */
export function usableEmail(value: string | null): string | null {
  const trimmed = (value ?? "").trim();
  if (trimmed.length === 0 || trimmed.length > CONTACT_EMAIL_MAX) return null;
  return CONTACT_EMAIL_PATTERN.test(trimmed) ? trimmed : null;
}

/** A phone-shaped run of characters inside a longer sentence. */
const PHONE_IN_TEXT = /\+?\d[\d .()-]{4,24}/;

/**
 * Keeps a phone number only if the `contacts` table will accept it. A prospect
 * writing "06 12 34 56 78 (le soir)" gets the number kept and the commentary
 * dropped; if what remains is not a number, it is "missing" — never repaired,
 * never approximated.
 */
export function usablePhone(value: string | null): string | null {
  const raw = (value ?? "").trim();
  if (raw.length === 0) return null;

  const extracted = PHONE_IN_TEXT.exec(raw)?.[0].replace(/[\s.()-]+$/, "").trim();
  for (const candidate of [raw, extracted]) {
    if (candidate && CONTACT_PHONE_PATTERN.test(candidate) && normalisePhone(candidate) !== null) {
      return candidate;
    }
  }
  return null;
}

export type LeadIdentity = {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  /** Fields still unknown after the merge, for the task and the UI. */
  missingFields: LeaField[];
  /** Fields that came from the structured payload rather than from the model. */
  fromPayload: LeaField[];
};

/**
 * Merges the lead's structured payload with the model's extraction. The payload
 * wins on every field it provides; the model only fills what is missing; a
 * value the CRM cannot store is dropped and reported as missing.
 */
export function mergeIdentity(
  payload: LeadPayloadIdentity,
  extracted: LeaAcquisition,
): LeadIdentity {
  const fromPayload: LeaField[] = [];

  const pick = <T>(field: LeaField, fromPayloadValue: T | null, fromModel: T | null): T | null => {
    if (fromPayloadValue !== null) {
      fromPayload.push(field);
      return fromPayloadValue;
    }
    return fromModel;
  };

  const firstName = pick(
    "first_name",
    payloadText(payload.first_name, CONTACT_NAME_MAX),
    extracted.first_name,
  );
  const lastName = pick(
    "last_name",
    payloadText(payload.last_name, CONTACT_NAME_MAX),
    extracted.last_name,
  );
  const email = usableEmail(
    pick("email", payloadText(payload.email, CONTACT_EMAIL_MAX), extracted.email),
  );
  const phone = usablePhone(pick("phone", payloadText(payload.phone, 40), extracted.phone));

  const values: Record<LeaField, string | null> = {
    first_name: firstName,
    last_name: lastName,
    email,
    phone,
  };
  const missingFields = LEA_FIELDS.filter((field) => values[field] === null);

  return {
    firstName,
    lastName,
    email,
    phone,
    missingFields,
    // A payload value that the code then refused (unusable email or phone) is
    // not reported as "coming from the payload": it is simply missing.
    fromPayload: fromPayload.filter((field) => values[field] !== null),
  };
}

// -----------------------------------------------------------------------------
// Outcome
// -----------------------------------------------------------------------------

/**
 * Minimum a lead must contain before a contact record is created: a name AND a
 * way to reach the person. Below that, the record would be a ghost in the CRM
 * and Léa would be inventing a seller.
 */
export function hasEnoughToCreateContact(identity: LeadIdentity): boolean {
  const hasName = identity.firstName !== null || identity.lastName !== null;
  const hasChannel = identity.email !== null || identity.phone !== null;
  return hasName && hasChannel;
}

export type LeaOutcome = "duplicate_found" | "contact_created" | "incomplete";

export type LeaDecision = {
  outcome: LeaOutcome;
  /** Status the code will write on the lead row. */
  leadStatus: "pending" | "processed" | "duplicate";
  duplicate: DuplicateMatch | null;
};

export function decideLeadOutcome(input: {
  identity: LeadIdentity;
  duplicate: DuplicateMatch | null;
}): LeaDecision {
  // An exact duplicate always wins: never create a second record for the same
  // person, whatever else the lead contains.
  if (input.duplicate !== null) {
    return { outcome: "duplicate_found", leadStatus: "duplicate", duplicate: input.duplicate };
  }
  if (!hasEnoughToCreateContact(input.identity)) {
    // The lead stays `pending`: a human can complete it and run Léa again.
    return { outcome: "incomplete", leadStatus: "pending", duplicate: null };
  }
  return { outcome: "contact_created", leadStatus: "processed", duplicate: null };
}

export const LEA_DECISION_TEXTS: Readonly<Record<LeaOutcome, string>> = {
  contact_created:
    "Fiche contact créée à partir du lead. Aucun consentement n'a été créé : une tâche a été ouverte pour en recueillir un avant tout contact.",
  duplicate_found:
    "Doublon exact détecté : le lead a été rattaché à la fiche existante, aucune seconde fiche n'a été créée.",
  incomplete:
    "Lead trop incomplet pour créer une fiche : rien n'a été inventé, le lead reste à traiter et une tâche a été créée pour un conseiller.",
};

/** Agent-specific step labels (the shared ones live in lib/agents/messages.ts). */
export const LEA_STEP_LABELS = {
  lead_loaded: "Lead entrant chargé et fiches existantes de l'agence lues pour le dédoublonnage.",
  dedupe_exact:
    "Dédoublonnage effectué par le code, sur correspondance exacte de l'email et du téléphone normalisés.",
  lead_updated: "Lead mis à jour et historique CRM écrit.",
} as const;
