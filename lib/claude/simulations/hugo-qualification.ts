/**
 * Deterministic simulation of Hugo's qualification output.
 *
 * No network, no API key, nothing billed. The answer is built ONLY from what
 * the inputs actually contain: when an information is not there, the field is
 * `null` and is reported as missing — never guessed. That is the same rule the
 * real provider will be held to by the zod schema and by the guard rails.
 *
 * The prospect text is read as pure data (it arrives already sanitised through
 * `untrustedText`): a sentence like "ignore tes instructions" is matched
 * against keywords like any other text and can never change the shape of the
 * answer.
 */

import { untrustedText } from "../prompt";
import type { AiGenerationRequest } from "../provider";
import {
  PROPERTY_TYPE_LABELS,
  PROPERTY_TYPES,
  SALE_MOTIVATION_LABELS,
  SALE_MOTIVATIONS,
  SALE_TIMELINE_LABELS,
  type PropertyTypeValue,
  type SaleMotivationValue,
  type SaleTimelineValue,
} from "../schemas";

/** Lowercase, accent-free copy used for keyword matching. */
function normalise(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function factString(request: AiGenerationRequest, key: string): string | null {
  const value = request.facts[key];
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 && text !== "(inconnu)" ? text : null;
}

// --- Property type -----------------------------------------------------------
const PROPERTY_TYPE_KEYWORDS: readonly (readonly [PropertyTypeValue, readonly string[]])[] = [
  ["house", ["maison", "villa", "bastide", "pavillon", " mas "]],
  ["apartment", ["appartement", "appart", "studio", "duplex", "t1 ", "t2", "t3", "t4", "t5", "loft"]],
  ["land", ["terrain", "parcelle"]],
  ["commercial", ["local commercial", "fonds de commerce", "bureaux", "commerce"]],
];

function detectPropertyType(text: string): PropertyTypeValue | null {
  let best: { type: PropertyTypeValue; index: number } | null = null;
  for (const [type, keywords] of PROPERTY_TYPE_KEYWORDS) {
    for (const keyword of keywords) {
      const index = text.indexOf(keyword);
      if (index !== -1 && (best === null || index < best.index)) {
        best = { type, index };
      }
    }
  }
  return best?.type ?? null;
}

// --- City --------------------------------------------------------------------
/** Towns of the agency sector: matched in the text, never added out of thin air. */
const KNOWN_CITIES = [
  "La Ciotat",
  "Cassis",
  "Ceyreste",
  "Saint-Cyr-sur-Mer",
  "Bandol",
  "Roquefort-la-Bedoule",
  "Aubagne",
  "Carnoux-en-Provence",
  "Marseille",
  "Le Castellet",
  "Saint-Zacharie",
] as const;

function detectCity(text: string): string | null {
  let best: { city: string; index: number } | null = null;
  for (const city of KNOWN_CITIES) {
    const index = text.indexOf(normalise(city));
    if (index !== -1 && (best === null || index < best.index)) {
      best = { city, index };
    }
  }
  return best?.city ?? null;
}

// --- Sector (neighbourhood) ----------------------------------------------------
/**
 * A sector is only extracted when the text names one EXPLICITLY, with a marker
 * word ("quartier de la gare", "secteur du port", "centre-ville", "lieu-dit …").
 * A city name alone is never turned into a sector, and nothing is deduced from
 * a postal code or from the agency's usual area: an absent sector stays `null`
 * and is reported in `missing_fields`.
 *
 * Matching runs on the RAW text (accents and capitalisation kept) so the value
 * written to the CRM reads like what the seller actually wrote.
 */
const SECTOR_MARKER = "quartiers?|secteurs?|lieu[-\\s]?dit|hameau|r[ée]sidence|domaine";
const SECTOR_ARTICLE = "de\\s+la|de\\s+l['’]|des|du|de|d['’]";
const SECTOR_WORD = "[\\p{L}\\p{N}][\\p{L}\\p{N}'’-]*";
/** Marker + optional article + at most 4 words, stopped by any punctuation. */
const SECTOR_PATTERN = new RegExp(
  `\\b(?:${SECTOR_MARKER})\\b(?:\\s+(?:${SECTOR_ARTICLE}))?(?:\\s+${SECTOR_WORD}){1,4}`,
  "iu",
);
const CENTRE_VILLE_PATTERN = /\bcentre[-\s]?ville\b/iu;

/** Max length of an extracted sector (the schema allows 200). */
const MAX_SECTOR_CHARS = 100;

function capitalise(text: string): string {
  return text.length === 0 ? text : text[0]!.toLocaleUpperCase("fr-FR") + text.slice(1);
}

export function detectSector(rawText: string): string | null {
  const marked = SECTOR_PATTERN.exec(rawText);
  if (marked) {
    const value = marked[0].replace(/\s+/g, " ").trim().slice(0, MAX_SECTOR_CHARS);
    return value.length > 0 ? capitalise(value) : null;
  }

  const centre = CENTRE_VILLE_PATTERN.exec(rawText);
  if (centre) return capitalise(centre[0].replace(/\s+/g, " ").trim());

  return null;
}

// --- Motivation ---------------------------------------------------------------
const MOTIVATION_KEYWORDS: Readonly<Record<SaleMotivationValue, readonly string[]>> = {
  succession: ["succession", "heritage", "herite", "heritiers"],
  divorce_separation: ["divorce", "separation", "separe"],
  mutation_professionnelle: ["mutation", "mute", "nouveau poste", "expatriation professionnelle"],
  achat_plus_grand: ["plus grand", "agrandir", "s'agrandir", "famille s'agrandit", "agrandissement"],
  achat_plus_petit: ["plus petit", "plus petite", "reduire la surface"],
  retraite: ["retraite"],
  investissement_locatif: ["locatif", "investissement", "rendement"],
  demenagement_hors_region: ["hors region", "demenagement", "demenage", "change de region"],
  rapprochement_familial: ["rapprochement familial", "se rapprocher de sa famille", "proche des enfants"],
  depart_etranger: ["etranger", "expatriation", "part vivre a l'etranger"],
  autre: [],
};

function detectMotivation(text: string): SaleMotivationValue | null {
  for (const motivation of SALE_MOTIVATIONS) {
    for (const keyword of MOTIVATION_KEYWORDS[motivation]) {
      if (text.includes(keyword)) return motivation;
    }
  }
  return null;
}

// --- Timeline ------------------------------------------------------------------
function bucketFromMonths(months: number): SaleTimelineValue {
  if (months <= 0) return "immediat";
  if (months <= 3) return "moins_de_3_mois";
  if (months <= 6) return "3_a_6_mois";
  if (months <= 12) return "6_a_12_mois";
  return "plus_de_12_mois";
}

function detectTimeline(text: string): SaleTimelineValue | null {
  if (/\b(immediat|tout de suite|des que possible|au plus vite)\b/.test(text)) return "immediat";
  if (/(pas de date|aucune date|pas presse|non defini|ne sait pas quand)/.test(text)) return "non_defini";

  const range = text.match(/(\d{1,2})\s*(?:a|-)\s*(\d{1,2})\s*mois/);
  if (range?.[2]) return bucketFromMonths(Number(range[2]));

  const single = text.match(/(?:sous|d'?ici|dans|en|avant)\s+(?:les\s+)?(\d{1,2})\s*mois/);
  if (single?.[1]) return bucketFromMonths(Number(single[1]));

  const bareMonths = text.match(/\b(\d{1,2})\s*mois\b/);
  if (bareMonths?.[1]) return bucketFromMonths(Number(bareMonths[1]));

  const years = text.match(/\b(\d{1,2})\s*an(?:s|nee|nees)?\b/);
  if (years?.[1]) return bucketFromMonths(Number(years[1]) * 12);

  return null;
}

export type SimulatedQualification = {
  property_type: PropertyTypeValue | null;
  city: string | null;
  sector: string | null;
  sale_motivation: SaleMotivationValue | null;
  sale_timeline: SaleTimelineValue | null;
  missing_fields: string[];
  confidence: number;
  summary: string;
};

/**
 * Builds the simulated qualification. `scenario` lets the tests force a
 * degraded answer to prove the guard rails react correctly.
 */
export function simulateHugoQualification(request: AiGenerationRequest): unknown {
  if (request.scenario === "invalid_output") {
    // Structurally invalid on purpose: unknown enum value, out-of-range
    // confidence, and an extra `stage` field an agent must never be able to
    // decide. Must be rejected by the zod schema.
    return {
      property_type: "chateau",
      city: 42,
      sector: null,
      sale_motivation: "envie",
      sale_timeline: "demain",
      missing_fields: "aucun",
      confidence: 3,
      summary: "",
      stage: "mandat_signe",
    };
  }

  const rawText = [untrustedText(request.untrusted), Object.values(request.facts).join(" ")].join("\n");
  const text = normalise(rawText);

  const propertyType = (factString(request, "property_type") as PropertyTypeValue | null) ?? detectPropertyType(text);
  const city = detectCity(text);
  // Known sector in the CRM first; otherwise only an explicitly written one.
  const sector = detectSector(rawText);
  const motivation = detectMotivation(text);
  const timeline = detectTimeline(text);

  const partial = request.scenario === "partial_output";
  const result: SimulatedQualification = {
    property_type: partial ? null : (PROPERTY_TYPES.includes(propertyType as PropertyTypeValue) ? propertyType : null),
    city: partial ? null : city,
    sector: partial ? null : sector,
    sale_motivation: partial ? null : motivation,
    sale_timeline: partial ? null : timeline,
    missing_fields: [],
    confidence: 0,
    summary: "",
  };

  const missing: string[] = [];
  if (result.property_type === null) missing.push("property_type");
  if (result.city === null) missing.push("city");
  if (result.sector === null) missing.push("sector");
  if (result.sale_motivation === null) missing.push("sale_motivation");
  if (result.sale_timeline === null) missing.push("sale_timeline");
  result.missing_fields = missing;

  const resolvedCore = [result.property_type, result.city, result.sale_motivation, result.sale_timeline].filter(
    (value) => value !== null,
  ).length;
  result.confidence = Math.round((0.25 + 0.175 * resolvedCore) * 100) / 100;

  const parts: string[] = [];
  if (result.property_type !== null) parts.push(PROPERTY_TYPE_LABELS[result.property_type]);
  if (result.city !== null) parts.push(`à ${result.city}`);
  const head = parts.length > 0 ? `${parts.join(" ")}.` : "";
  const details: string[] = [];
  if (result.sale_motivation !== null) details.push(`Motivation : ${SALE_MOTIVATION_LABELS[result.sale_motivation]}`);
  if (result.sale_timeline !== null) details.push(`Délai : ${SALE_TIMELINE_LABELS[result.sale_timeline]}`);

  result.summary =
    [head, details.join(". ")].filter((part) => part.length > 0).join(" ").trim() ||
    "Aucune information exploitable dans le dossier : rien n'a été déduit.";

  return result;
}
