/**
 * Allow-lists of the Privacy Gateway: one policy per AI task (= per agent).
 *
 * Closed by design (audit §3, rule 1): a fact key, a text label or a value the
 * policy does not know is not "passed through" — the whole call is refused and
 * nothing leaves the server. Adding a field to an agent therefore requires a
 * deliberate change HERE, reviewed like any other privacy decision.
 *
 *  - `facts` are trusted structured values; each key has a value spec (enum,
 *    boolean, bounded number, masked postal code). Free strings are NOT
 *    allowed as facts.
 *  - `untrusted` are the free-text blocks written by (or quoting) a prospect.
 *    They are always scanned and pseudonymised; some labels are replaced as a
 *    whole by a single pseudonym (`replace`).
 *  - `choices` are options computed by the code (time slots); ids are checked
 *    against a strict pattern, labels are scanned like everything else.
 */

import { Constants } from "@/types/database";
import type { AiTaskName } from "@/lib/claude/provider";

import type { PseudonymType } from "./types";

export type FactSpec =
  | { kind: "enum"; values: readonly string[] }
  | { kind: "boolean" }
  | { kind: "number"; min: number; max: number; integer: boolean }
  /** "13600" becomes "13***": the département is enough to locate a property. */
  | { kind: "postal_code" };

export type UntrustedSpec =
  | { mode: "scan"; maxChars: number }
  /** The whole content is one identity, replaced by a single pseudonym. */
  | { mode: "replace"; as: PseudonymType; maxChars: number };

export type TaskPolicy = {
  facts: Readonly<Record<string, FactSpec>>;
  untrusted: Readonly<Record<string, UntrustedSpec>>;
  choices: { idPattern: RegExp; maxCount: number } | null;
  /**
   * The task reads an identity written in free text (Léa). The call is refused
   * unless the dossier already gives a first AND last name, which the detector
   * can then recognise anywhere in the text: an unknown name cannot be masked.
   */
  requiresKnownIdentity?: boolean;
};

const enums = Constants.public.Enums;

const STAGE: FactSpec = { kind: "enum", values: enums.pipeline_stage };
const SOURCE: FactSpec = { kind: "enum", values: enums.contact_source };
const PROPERTY_TYPE: FactSpec = { kind: "enum", values: enums.property_type };
const BOOLEAN: FactSpec = { kind: "boolean" };
const MESSAGE_CHANNEL: FactSpec = { kind: "enum", values: ["email", "sms", "whatsapp"] };
const APPOINTMENT_STATUS: FactSpec = { kind: "enum", values: enums.appointment_status };

const count = (max: number): FactSpec => ({ kind: "number", min: 0, max, integer: true });
const days: FactSpec = { kind: "number", min: -366, max: 100_000, integer: true };

/** The property facts shared by Hugo, Emma, Louis and Sarah. */
const PROPERTY_FACTS = {
  property_known: BOOLEAN,
  property_type: PROPERTY_TYPE,
  property_postal_code: { kind: "postal_code" },
  property_surface_m2: { kind: "number", min: 0, max: 1_000_000, integer: false },
  property_rooms: count(500),
} as const satisfies Record<string, FactSpec>;

const SHORT_TEXT: UntrustedSpec = { mode: "scan", maxChars: 500 };
const LONG_TEXT: UntrustedSpec = { mode: "scan", maxChars: 4000 };

/** The text blocks every contact-based agent receives. */
const CONTACT_TEXT = {
  contact_sale_motivation: SHORT_TEXT,
  contact_sale_timeline: SHORT_TEXT,
  property_city: SHORT_TEXT,
  property_sector: SHORT_TEXT,
  contact_notes: LONG_TEXT,
  historique_recent: LONG_TEXT,
} as const satisfies Record<string, UntrustedSpec>;

const MESSAGE_TEXT = {
  ...CONTACT_TEXT,
  agency_name: { mode: "replace", as: "AGENCE", maxChars: 200 },
  contact_first_name: { mode: "replace", as: "PRENOM", maxChars: 100 },
} as const satisfies Record<string, UntrustedSpec>;

export const TASK_POLICIES: Readonly<Record<AiTaskName, TaskPolicy>> = {
  lea_acquisition: {
    facts: {
      lead_source: SOURCE,
      lead_raw_text_chars: count(1_000_000),
      payload_has_first_name: BOOLEAN,
      payload_has_last_name: BOOLEAN,
      payload_has_email: BOOLEAN,
      payload_has_phone: BOOLEAN,
    },
    untrusted: { lead_texte_brut: LONG_TEXT },
    choices: null,
    requiresKnownIdentity: true,
  },

  hugo_qualification: {
    facts: {
      contact_stage: STAGE,
      contact_source: SOURCE,
      contact_has_email: BOOLEAN,
      contact_has_phone: BOOLEAN,
      ...PROPERTY_FACTS,
    },
    untrusted: CONTACT_TEXT,
    choices: null,
  },

  emma_follow_up: {
    facts: {
      contact_stage: STAGE,
      contact_source: SOURCE,
      ...PROPERTY_FACTS,
      message_channel: MESSAGE_CHANNEL,
      days_since_last_message: days,
      has_pending_appointment: BOOLEAN,
    },
    untrusted: MESSAGE_TEXT,
    choices: null,
  },

  louis_appointment: {
    facts: {
      contact_stage: STAGE,
      contact_source: SOURCE,
      ...PROPERTY_FACTS,
      message_channel: MESSAGE_CHANNEL,
      appointment_duration_minutes: { kind: "number", min: 1, max: 480, integer: true },
    },
    untrusted: MESSAGE_TEXT,
    choices: { idPattern: /^creneau-\d{1,2}$/, maxCount: 20 },
  },

  sarah_follow_through: {
    facts: {
      contact_stage: STAGE,
      appointment_status: APPOINTMENT_STATUS,
      days_since_appointment: days,
      report_chars: count(1_000_000),
      ...PROPERTY_FACTS,
    },
    untrusted: {
      compte_rendu_rendez_vous: LONG_TEXT,
      property_city: SHORT_TEXT,
      property_sector: SHORT_TEXT,
      contact_notes: LONG_TEXT,
      historique_recent: LONG_TEXT,
    },
    choices: null,
  },
};

export function policyFor(task: string): TaskPolicy | null {
  return Object.prototype.hasOwnProperty.call(TASK_POLICIES, task) ? TASK_POLICIES[task as AiTaskName] : null;
}
