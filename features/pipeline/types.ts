/**
 * Pipeline domain — input schema, result types and French messages of the
 * human stage change (`changeContactStage`).
 *
 * The rules themselves (mandate confirmation, director-only exit with a
 * motive, append-only trace) are enforced by the database function
 * `public.change_contact_stage` (migration 20260923120000). This schema only
 * refuses what is malformed before it reaches the database; it never decides
 * who may do what.
 */

import { z } from "zod";

import type { MembershipRole, PipelineStage } from "@/lib/agents/types";
import { CONTROL_CHARACTER_PATTERN } from "@/lib/claude/schemas";

/** Every stage of the pipeline, `perdu` included (same order as the enum). */
export const PIPELINE_STAGES = [
  "nouveau",
  "qualifie",
  "chaud",
  "rdv_planifie",
  "estimation_faite",
  "mandat_signe",
  "perdu",
] as const satisfies readonly PipelineStage[];

/** Bounds of the motive, identical to the database check. */
export const STAGE_CHANGE_REASON_MIN_LENGTH = 3;
export const STAGE_CHANGE_REASON_MAX_LENGTH = 500;

/**
 * What the pipeline UI sends.
 *
 * - `mandateConfirmed` must be a real boolean coming from a checkbox the user
 *   ticked. It is required to enter `mandat_signe` and to leave it.
 * - `reason` is optional here (it is required by the database only to leave
 *   `mandat_signe`). It is trimmed; an empty text becomes `null`; a text with a
 *   control character (other than tab / line break) is REFUSED, not cleaned:
 *   it is written in the append-only history, what is stored must be exactly
 *   what the director typed.
 */
export const changeContactStageSchema = z
  .object({
    contactId: z.uuid(),
    stage: z.enum(PIPELINE_STAGES),
    mandateConfirmed: z.boolean(),
    reason: z
      .string()
      .nullish()
      .transform((value) => {
        if (typeof value !== "string") return null;
        const trimmed = value.trim();
        return trimmed.length === 0 ? null : trimmed;
      })
      .refine((value) => value === null || !CONTROL_CHARACTER_PATTERN.test(value), {
        message: "Le motif contient des caractères non autorisés.",
      })
      .refine(
        (value) =>
          value === null ||
          (value.length >= STAGE_CHANGE_REASON_MIN_LENGTH && value.length <= STAGE_CHANGE_REASON_MAX_LENGTH),
        { message: "Le motif doit contenir entre 3 et 500 caractères." },
      ),
  })
  .strict();

export type ChangeContactStageInput = z.input<typeof changeContactStageSchema>;
export type ChangeContactStage = z.output<typeof changeContactStageSchema>;

/** What a successful change returns. */
export type ContactStageChange = {
  contactId: string;
  previousStage: PipelineStage;
  stage: PipelineStage;
  /** The append-only `activities` row written in the same transaction. */
  activityId: string;
  changedAt: string;
};

/**
 * Who is looking at the pipeline — so the UI can EXPLAIN a restriction
 * (e.g. why « Sortir du mandat » is disabled). The database stays the
 * authority: hiding a button is never the protection.
 */
export type PipelineViewer = {
  userId: string;
  role: MembershipRole;
  /** Only a director may move a contact out of `mandat_signe`. */
  canExitSignedMandate: boolean;
};

// -----------------------------------------------------------------------------
// Error codes and French messages (centralised, never scattered in the logic)
// -----------------------------------------------------------------------------

export const STAGE_CHANGE_ERROR_CODES = [
  "not_authenticated",
  "no_agency",
  "forbidden",
  "contact_not_found",
  "stage_invalid_input",
  "stage_unchanged",
  "stage_reason_invalid",
  "stage_reason_required",
  "stage_mandate_confirmation_required",
  "stage_mandate_exit_director_only",
  "stage_mandate_exit_confirmation_required",
  "stage_mandate_change_requires_rpc",
  "unexpected_error",
] as const;

export type StageChangeErrorCode = (typeof STAGE_CHANGE_ERROR_CODES)[number];

export const STAGE_CHANGE_ERROR_MESSAGES: Readonly<Record<StageChangeErrorCode, string>> = {
  not_authenticated: "Votre session a expiré. Reconnectez-vous pour continuer.",
  no_agency: "Votre compte n'est rattaché à aucune agence.",
  forbidden: "Action refusée : vous n'avez pas accès à cet élément.",
  // Identical for "does not exist" and "belongs to another agency".
  contact_not_found: "Contact introuvable.",
  stage_invalid_input: "Demande invalide : l'étape n'a pas été modifiée.",
  stage_unchanged: "Ce contact est déjà à cette étape : rien n'a été modifié.",
  stage_reason_invalid:
    "Le motif doit contenir entre 3 et 500 caractères, sans caractères spéciaux invisibles. L'étape n'a pas été modifiée.",
  stage_reason_required:
    "Un motif est obligatoire pour sortir un dossier de « Mandat signé ». L'étape n'a pas été modifiée.",
  stage_mandate_confirmation_required:
    "Confirmez explicitement la signature du mandat pour passer ce contact en « Mandat signé ».",
  stage_mandate_exit_director_only:
    "Seul un directeur de l'agence peut sortir un dossier de « Mandat signé ».",
  stage_mandate_exit_confirmation_required:
    "Confirmez explicitement la sortie de « Mandat signé » pour modifier l'étape de ce dossier.",
  stage_mandate_change_requires_rpc:
    "Le mandat signé ne peut être modifié que depuis le pipeline, avec confirmation.",
  unexpected_error: "Une erreur technique est survenue. L'étape n'a pas été modifiée.",
};

/** Database exceptions of `change_contact_stage` and of its guard triggers. */
const DATABASE_MESSAGE_TO_STAGE_CODE: Readonly<Record<string, StageChangeErrorCode>> = {
  forbidden: "forbidden",
  contact_not_found: "contact_not_found",
  stage_invalid_input: "stage_invalid_input",
  stage_unchanged: "stage_unchanged",
  stage_reason_invalid: "stage_reason_invalid",
  stage_reason_required: "stage_reason_required",
  stage_mandate_confirmation_required: "stage_mandate_confirmation_required",
  stage_mandate_exit_director_only: "stage_mandate_exit_director_only",
  stage_mandate_exit_confirmation_required: "stage_mandate_exit_confirmation_required",
  stage_mandate_change_requires_rpc: "stage_mandate_change_requires_rpc",
  activity_type_reserved: "forbidden",
};

/**
 * Maps a Postgres / PostgREST error to a stage-change code. Unknown errors are
 * `unexpected_error`: a raw database message never reaches the UI.
 */
export function stageChangeErrorCode(error: { message?: string | null; code?: string | null }): StageChangeErrorCode {
  const message = (error.message ?? "").trim();
  const direct = DATABASE_MESSAGE_TO_STAGE_CODE[message];
  if (direct) return direct;
  // Longest keys first, so `stage_mandate_exit_confirmation_required` is never
  // mistaken for a shorter key it happens to contain.
  const entries = Object.entries(DATABASE_MESSAGE_TO_STAGE_CODE).sort(([a], [b]) => b.length - a.length);
  for (const [key, code] of entries) {
    if (message.includes(key)) return code;
  }
  // A function whose EXECUTE was revoked (anonymous caller): insufficient privilege.
  if ((error.code ?? "").trim() === "42501") return "forbidden";
  return "unexpected_error";
}
