/**
 * Shared zod building blocks and vocabularies for AI outputs.
 *
 * Everything an AI agent can output is strictly bounded: enums whenever a
 * closed vocabulary exists, maximum lengths everywhere else. An agent never
 * outputs a pipeline stage, a recipient, a channel or anything that could look
 * like an action: those are decided by the code (see CLAUDE.md, guard rails).
 *
 * Vocabularies live here (and not in a feature folder) because both the
 * simulator (lib/claude/simulations/) and the agents (features/agents-ia/)
 * need them, and `lib/` must never depend on `features/`.
 */

import { z } from "zod";

/** Mirrors the `public.property_type` database enum. */
export const PROPERTY_TYPES = ["apartment", "house", "land", "commercial", "other"] as const;
export type PropertyTypeValue = (typeof PROPERTY_TYPES)[number];

/** Closed vocabulary of selling motivations an agent may return. */
export const SALE_MOTIVATIONS = [
  "succession",
  "divorce_separation",
  "mutation_professionnelle",
  "achat_plus_grand",
  "achat_plus_petit",
  "retraite",
  "investissement_locatif",
  "demenagement_hors_region",
  "rapprochement_familial",
  "depart_etranger",
  "autre",
] as const;
export type SaleMotivationValue = (typeof SALE_MOTIVATIONS)[number];

/** Closed vocabulary of project timelines an agent may return. */
export const SALE_TIMELINES = [
  "immediat",
  "moins_de_3_mois",
  "3_a_6_mois",
  "6_a_12_mois",
  "plus_de_12_mois",
  "non_defini",
] as const;
export type SaleTimelineValue = (typeof SALE_TIMELINES)[number];

/**
 * French labels of the vocabularies. Centralised here (CLAUDE.md: no French
 * strings scattered in business logic) and reused by the CRM columns, the
 * summaries and the UI.
 */
export const PROPERTY_TYPE_LABELS: Readonly<Record<PropertyTypeValue, string>> = {
  apartment: "Appartement",
  house: "Maison",
  land: "Terrain",
  commercial: "Local commercial",
  other: "Autre bien",
};

export const SALE_MOTIVATION_LABELS: Readonly<Record<SaleMotivationValue, string>> = {
  succession: "Succession",
  divorce_separation: "Divorce ou séparation",
  mutation_professionnelle: "Mutation professionnelle",
  achat_plus_grand: "Achat d'un bien plus grand",
  achat_plus_petit: "Achat d'un bien plus petit",
  retraite: "Départ à la retraite",
  investissement_locatif: "Revente d'un investissement locatif",
  demenagement_hors_region: "Déménagement hors région",
  rapprochement_familial: "Rapprochement familial",
  depart_etranger: "Départ à l'étranger",
  autre: "Autre motivation",
};

export const SALE_TIMELINE_LABELS: Readonly<Record<SaleTimelineValue, string>> = {
  immediat: "Immédiat",
  moins_de_3_mois: "Moins de 3 mois",
  "3_a_6_mois": "3 à 6 mois",
  "6_a_12_mois": "6 à 12 mois",
  plus_de_12_mois: "Plus de 12 mois",
  non_defini: "Délai non défini",
};

/** Timelines that make a project urgent enough to be treated as "chaud". */
export const HOT_SALE_TIMELINES: readonly SaleTimelineValue[] = ["immediat", "moins_de_3_mois"];

/**
 * Closed vocabulary of what a seller decided at the end of an estimation
 * appointment. Used by Sarah to CLASSIFY a human-written report — never to
 * decide anything: the pipeline stage is chosen by the code from a whitelist,
 * and `mandat_signe` is not in it (a mandate is confirmed by a human).
 */
export const SELLER_DECISIONS = [
  "mandat_envisage",
  "hesite",
  "compare_autre_agence",
  "attend_evenement",
  "refus",
  "non_precise",
] as const;
export type SellerDecisionValue = (typeof SELLER_DECISIONS)[number];

export const SELLER_DECISION_LABELS: Readonly<Record<SellerDecisionValue, string>> = {
  mandat_envisage: "Mandat envisagé",
  hesite: "Le vendeur hésite encore",
  compare_autre_agence: "Comparaison avec une autre agence",
  attend_evenement: "Décision suspendue à un événement",
  refus: "Refus du vendeur",
  non_precise: "Décision non précisée dans le compte-rendu",
};

/** Non-empty, trimmed, length-bounded free text. */
export function boundedText(max: number) {
  return z.string().trim().min(1).max(max);
}

/** Free text that may be explicitly unknown. NULL means "not found", never "guessed". */
export function nullableText(max: number) {
  return boundedText(max).nullable();
}

/** Self-reported reliability of the answer, between 0 and 1. */
export const confidenceSchema = z.number().min(0).max(1);

/**
 * No URL may come out of a model. A link is the easiest way to turn a
 * human-validated message into a phishing vector; the links the product needs
 * (unsubscribe page) are added by the code.
 */
export const URL_PATTERN = /(https?:\/\/|www\.)/i;

/**
 * No amount in euros may come out of a model either. `estimated_value_eur` is
 * the figure that engages the agency in front of a seller: the database refuses
 * to let an agent write it, and this refinement makes sure one cannot slip into
 * a free-text field instead (a summary, a message, a task title).
 */
export const MONEY_PATTERN = /(\d[\d\s.,]*\s*(?:€|eur\b|euros?\b)|(?:€|eur\b|euros?\b)\s*\d)/i;

export function noUrl<T extends z.ZodType<string>>(schema: T) {
  return schema.refine((value) => !URL_PATTERN.test(value), {
    message: "aucun lien n'est autorisé dans un texte rédigé par l'IA",
  });
}

export function noMoney<T extends z.ZodType<string>>(schema: T) {
  return schema.refine((value) => !MONEY_PATTERN.test(value), {
    message: "aucun montant en euros n'est autorisé dans un texte rédigé par l'IA",
  });
}

/**
 * Raw control characters an AI output may legitimately need for formatting: a
 * tab and a line break (LF or CR). Same allowed set as `cleanDraftText`
 * (features/agents-ia/types.ts, the human-rewrite path): whatever a human may
 * safely read and correct. Everything else in the C0 range, plus DEL, is
 * refused outright rather than silently stripped — a refused answer means "no
 * draft at all + a task for a human" (CLAUDE.md), which is the right outcome
 * for a value a model was never supposed to produce.
 */
export const CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export function noControlCharacters<T extends z.ZodType<string>>(schema: T) {
  return schema.refine((value) => !CONTROL_CHARACTER_PATTERN.test(value), {
    message: "aucun caractère de contrôle n'est autorisé dans un texte rédigé par l'IA",
  });
}

/**
 * A subject becomes an email header the day a real provider is connected: a
 * `\r\n` inside it is the classic way to smuggle in a second header (a hidden
 * `Bcc:`, most notably). The body the message is built from can come from
 * CRM values a prospect controls (their own name, their message), so this
 * path exists even before any real send. Combine with `noControlCharacters`
 * for a subject: the two are deliberately layered rather than merged, so a
 * lone newline (not a full control character) is still caught by this one.
 */
export const LINE_BREAK_PATTERN = /[\r\n]/;

export function singleLine<T extends z.ZodType<string>>(schema: T) {
  return schema.refine((value) => !LINE_BREAK_PATTERN.test(value), {
    message: "une seule ligne est autorisée : aucun retour à la ligne dans ce texte",
  });
}
