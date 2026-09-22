/**
 * Client-side helpers of the public estimation form (`/estimation`).
 *
 * These helpers never invent a validation rule: `buildEstimationInput` only
 * reshapes raw form strings into `EstimationRequestInput`, and error mapping
 * reuses `estimationRequestSchema` (see `types.ts`) — the SAME schema the
 * server (re-)validates with. This file's only real decision is which zod
 * issues are safe to show verbatim (their `message` is already French) and
 * which two are not (`surfaceM2`, `rooms` have no custom `.message()` in the
 * schema, so a failure there would otherwise surface zod's default English
 * text) — those two get a fixed French fallback instead.
 */

import { APP_TEXTS } from "@/components/texts";

import type { EstimationConsentChoices, EstimationRequestInput, PropertyTypeChoice } from "../types";

const TEXTS = APP_TEXTS.estimation;

export type EstimationFormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  propertyType: PropertyTypeChoice;
  city: string;
  postalCode: string;
  surfaceM2: string;
  rooms: string;
  message: string;
  consents: EstimationConsentChoices;
  /** Honeypot: a real visitor's browser never changes this. */
  website: string;
};

export const INITIAL_ESTIMATION_FORM_STATE: EstimationFormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  propertyType: "appartement",
  city: "",
  postalCode: "",
  surfaceM2: "",
  rooms: "",
  message: "",
  consents: { email: false, sms: false, whatsapp: false, phone: false },
  website: "",
};

/** `""` and blank become `null`, matching what the schema expects. */
function optional(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

/** `""` becomes `null`; a non-numeric value is passed through so zod can reject it. */
function optionalNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : Number.NaN;
}

export function buildEstimationInput(state: EstimationFormState): EstimationRequestInput {
  return {
    firstName: state.firstName.trim(),
    lastName: state.lastName.trim(),
    email: optional(state.email),
    phone: optional(state.phone),
    propertyType: state.propertyType,
    city: state.city.trim(),
    postalCode: state.postalCode.trim(),
    surfaceM2: optionalNumber(state.surfaceM2),
    rooms: optionalNumber(state.rooms),
    message: optional(state.message),
    consents: state.consents,
    website: state.website,
  };
}

/**
 * Every field this screen actually renders a message under.
 *
 * `propertyType` is absent on purpose: it is a native `<select>` limited to the
 * four valid options and `Select` has no error slot, so a message mapped there
 * would never be displayed — it falls back to the form-level summary instead.
 * Same for `website`, the invisible honeypot.
 */
export const ESTIMATION_FIELD_KEYS = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "city",
  "postalCode",
  "surfaceM2",
  "rooms",
  "message",
] as const;

export type EstimationFieldKey = (typeof ESTIMATION_FIELD_KEYS)[number];

export type EstimationFieldErrors = Partial<Record<EstimationFieldKey, string>>;

export type EstimationConsentErrors = Partial<Record<keyof EstimationConsentChoices, string>>;

export type MappedEstimationErrors = {
  fields: EstimationFieldErrors;
  consents: EstimationConsentErrors;
  /** "Cochez au moins un moyen de contact autorisé." — attached to the whole group. */
  consentGroup: string | null;
};

/**
 * Paths whose zod `message` is trusted verbatim (all custom, all French —
 * checked against `features/estimation/types.ts`). Everything else falls
 * back to a fixed French text, so a schema change upstream can never leak an
 * untranslated message into this screen.
 */
const TRUSTED_MESSAGE_PATHS = new Set([
  "firstName",
  "lastName",
  "email",
  "phone",
  "city",
  "postalCode",
  "message",
  "consents",
  "consents.email",
  "consents.phone",
]);

const FALLBACK_FIELD_MESSAGES: Record<string, string> = {
  surfaceM2: TEXTS.surfaceInvalid,
  rooms: TEXTS.roomsInvalid,
};

export type EstimationIssueLike = { path: readonly PropertyKey[]; message: string };

export function mapEstimationIssues(issues: readonly EstimationIssueLike[]): MappedEstimationErrors {
  const fields: EstimationFieldErrors = {};
  const consents: EstimationConsentErrors = {};
  let consentGroup: string | null = null;

  for (const issue of issues) {
    const path = issue.path.map(String);
    const key = path.join(".");
    const trusted = TRUSTED_MESSAGE_PATHS.has(key);
    const message = trusted ? issue.message : (FALLBACK_FIELD_MESSAGES[path[0] ?? ""] ?? issue.message);

    if (key === "consents") {
      consentGroup = TEXTS.consentGroupError;
      continue;
    }
    if (key === "consents.email") {
      consents.email = message;
      continue;
    }
    if (key === "consents.phone") {
      // The schema reports a single "phone required" issue at this path for
      // every phone-based channel: apply it to all three.
      consents.sms = message;
      consents.whatsapp = message;
      consents.phone = message;
      continue;
    }
    const fieldKey = ESTIMATION_FIELD_KEYS.find((candidate) => candidate === key);
    if (fieldKey) {
      fields[fieldKey] = message;
    }
  }

  return { fields, consents, consentGroup };
}
