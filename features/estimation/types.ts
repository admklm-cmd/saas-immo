/**
 * Public estimation request (`/estimation`) — contract and validation.
 *
 * A visitor who is NOT signed in submits this. Every field is validated here
 * with zod before the server action goes anywhere near the database, and the
 * database (`supabase/migrations/20260922120000_public_estimation_request.sql`)
 * validates everything again on its own: this function is reachable directly
 * with the public key, bypassing this file entirely, so this schema is a
 * first line of defence, never the only one.
 *
 * The free-text `message` field is written verbatim to `inbound_leads.raw_text`
 * (UNTRUSTED DATA for the AI agents, never an instruction — see
 * `features/agents-ia/lea-acquisition/lea.ts`). Nothing here ever produces a
 * price or a price range: there is no such field, on purpose.
 */

import { z } from "zod";

import type { Database } from "@/types/database";

export type PropertyTypeChoice = "maison" | "appartement" | "terrain" | "autre";

export type EstimationConsentChoices = {
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  phone: boolean;
};

export type EstimationRequestInput = {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  propertyType: PropertyTypeChoice;
  city: string;
  postalCode: string;
  surfaceM2: number | null;
  rooms: number | null;
  /** Free text of the prospect: UNTRUSTED DATA, never an instruction. */
  message: string | null;
  /** One box per channel; none is pre-ticked by the form. */
  consents: EstimationConsentChoices;
  /** Invisible honeypot field. A real visitor's browser always sends "". */
  website: string;
};

export type EstimationRequestResult = { status: "received" };

/** Maps a French UI choice to the database's `property_type` enum. */
export const PROPERTY_TYPE_CHOICE_TO_ENUM: Readonly<
  Record<PropertyTypeChoice, Database["public"]["Enums"]["property_type"]>
> = {
  maison: "house",
  appartement: "apartment",
  terrain: "land",
  autre: "other",
};

// -----------------------------------------------------------------------------
// zod schema
// -----------------------------------------------------------------------------

/** French landline or mobile, optionally in `+33` form; spaces/dots/dashes allowed. */
const FRENCH_PHONE_PATTERN = /^(?:\+33|0)[1-9](?:[\s.-]?\d{2}){4}$/;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const POSTAL_CODE_PATTERN = /^[0-9]{5}$/;

/**
 * Control characters that may never appear in a visitor's text, mirroring
 * `CONTROL_CHARACTER_PATTERN` in `lib/claude/schemas.ts` (duplicated on
 * purpose: this module is bundled into the public page and must not pull the
 * AI vocabularies in). Tab, LF and CR are left out of the set because a
 * multi-line message legitimately contains them — a NAME does not, hence the
 * extra `singleLineText` below.
 *
 * Why this matters here: a first name is copied verbatim into
 * `inbound_leads.payload`, then by Léa into `contacts.first_name`, and CRM
 * values end up inside the messages the agents assemble. A `\r\n` in a name is
 * the classic way to smuggle an extra email header (a hidden `Bcc:`) the day a
 * real provider is connected, and an ESC/NUL byte turns a log line or a CSV
 * export into something the reader cannot trust. It is refused at the door
 * rather than silently stripped: the visitor typed something a real form
 * cannot produce.
 */
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const LINE_BREAKS_OR_TABS = /[\r\n\t]/;

const UNSAFE_CHARACTERS_MESSAGE = "Ce champ contient des caractères non autorisés.";

function noControlCharacters<T extends z.ZodType<string>>(schema: T) {
  return schema.refine((value) => !CONTROL_CHARACTERS.test(value), UNSAFE_CHARACTERS_MESSAGE);
}

function requiredText(max: number) {
  return noControlCharacters(
    z.string().trim().min(1, "Ce champ est obligatoire.").max(max, "Texte trop long."),
  ).refine((value) => !LINE_BREAKS_OR_TABS.test(value), UNSAFE_CHARACTERS_MESSAGE);
}

function optionalText(max: number) {
  return noControlCharacters(z.string().trim().max(max, "Texte trop long."))
    .nullable()
    .transform((value) => (value === null || value.length === 0 ? null : value));
}

const emailSchema = noControlCharacters(
  z
    .string()
    .trim()
    .toLowerCase()
    .max(320, "Adresse email trop longue.")
    // `\s` in the pattern already rules out spaces, tabs and line breaks.
    .refine((value) => EMAIL_PATTERN.test(value), "Adresse email invalide."),
).nullable();

/**
 * Postal code. "Not filled in" and "filled in wrong" are two different user
 * mistakes and deserve two different messages.
 *
 * `abort: true` on the emptiness check matters: without it an empty value
 * fails BOTH checks and produces two issues for the same path, and the form's
 * per-field mapping (`features/estimation/components/estimation-form.helpers.ts`)
 * keeps the LAST one — so the visitor would still be told the code is
 * "invalid" instead of "required". Aborting keeps exactly one issue.
 */
const postalCodeSchema = z
  .string()
  .trim()
  .min(1, { error: "Le code postal est obligatoire.", abort: true })
  .regex(POSTAL_CODE_PATTERN, "Code postal invalide (5 chiffres attendus).");

const phoneSchema = z
  .string()
  .trim()
  .max(30, "Numéro de téléphone trop long.")
  .refine((value) => FRENCH_PHONE_PATTERN.test(value), "Numéro de téléphone invalide (format français attendu).")
  .nullable();

export const estimationRequestSchema = z
  .object({
    firstName: requiredText(100),
    lastName: requiredText(100),
    email: emailSchema,
    phone: phoneSchema,
    propertyType: z.enum(["maison", "appartement", "terrain", "autre"]),
    city: requiredText(120),
    postalCode: postalCodeSchema,
    surfaceM2: z.number().positive().max(100_000).nullable(),
    rooms: z.number().int().positive().max(50).nullable(),
    message: optionalText(2000),
    consents: z.object({
      email: z.boolean(),
      sms: z.boolean(),
      whatsapp: z.boolean(),
      phone: z.boolean(),
    }),
    // Honeypot: a real visitor's browser always submits an empty string here.
    website: z.string().max(200),
  })
  .superRefine((data, ctx) => {
    if (data.email === null && data.phone === null) {
      ctx.addIssue({
        code: "custom",
        path: ["email"],
        message: "Indiquez au moins une adresse email ou un numéro de téléphone.",
      });
    }
    const anyConsentGiven = data.consents.email || data.consents.sms || data.consents.whatsapp || data.consents.phone;
    if (!anyConsentGiven) {
      ctx.addIssue({
        code: "custom",
        path: ["consents"],
        message: "Cochez au moins un moyen de contact autorisé.",
      });
    }
    if (data.consents.email && data.email === null) {
      ctx.addIssue({
        code: "custom",
        path: ["consents", "email"],
        message: "Une adresse email est nécessaire pour autoriser ce canal.",
      });
    }
    if ((data.consents.sms || data.consents.whatsapp || data.consents.phone) && data.phone === null) {
      ctx.addIssue({
        code: "custom",
        path: ["consents", "phone"],
        message: "Un numéro de téléphone est nécessaire pour autoriser ce canal.",
      });
    }
  });

export type EstimationRequestParsed = z.infer<typeof estimationRequestSchema>;

// -----------------------------------------------------------------------------
// Errors — French, generic enough not to help an attacker probe the honeypot
// or the rate limiter, matching `{ data, error }` (see lib/utils/result.ts).
// -----------------------------------------------------------------------------
export type EstimationErrorCode = "validation_failed" | "rate_limited" | "unavailable";

export const ESTIMATION_ERROR_MESSAGES: Readonly<Record<EstimationErrorCode, string>> = {
  validation_failed:
    "Votre demande n'a pas pu être envoyée : certaines informations sont invalides ou incomplètes.",
  rate_limited: "Trop de demandes ont été envoyées récemment. Merci de réessayer un peu plus tard.",
  unavailable: "Votre demande n'a pas pu être envoyée pour le moment. Merci de réessayer plus tard.",
};
