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
