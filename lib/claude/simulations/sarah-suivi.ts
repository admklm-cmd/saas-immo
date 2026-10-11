/**
 * Deterministic simulation of Sarah's follow-through.
 *
 * No network, no API key, nothing billed. Everything comes from the report the
 * human wrote: what is not in it stays out of the answer and is reported in
 * `missing_fields`. In particular, the simulation NEVER produces an amount in
 * euros — it only says whether an estimation was presented — and it has no way
 * whatsoever to express a pipeline stage or a signed mandate, because Sarah's
 * schema has no field for either.
 *
 * The report arrives already sanitised through `untrustedText` and is treated
 * as data: "ignore tes instructions précédentes" is matched against keywords
 * like any other sentence and cannot change the shape of the answer.
 */

import { untrustedText } from "../prompt";
import type { AiGenerationRequest } from "../provider";
import type { SellerDecisionValue } from "../schemas";

/** Lowercase, accent-free copy used for keyword matching. */
function normalise(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Any figure followed (or preceded) by a euro mark: never repeated, only flagged. */
const MONEY_MENTION = /(\d[\d\s.,]*\s*(?:€|eur\b|euros?\b)|(?:€|eur\b|euros?\b)\s*\d)/i;
const ESTIMATION_MENTION =
  /(estimation realisee|estimation faite|rapport d'estimation|avis de valeur|estimation remise|estimation presentee)/;

const DECISION_KEYWORDS: Readonly<Record<SellerDecisionValue, readonly string[]>> = {
  refus: ["refuse", "ne souhaite pas", "renonce", "confie a une autre agence", "abandonne"],
  compare_autre_agence: ["autre agence", "compare", "deuxieme avis", "concurrence"],
  attend_evenement: ["attend le depart", "attend la fin", "attend le locataire", "apres le depart"],
  hesite: ["hesite", "reflechit", "pas decide", "doit reflechir"],
  mandat_envisage: ["mandat", "signature", "signer"],
  non_precise: [],
};

/**
 * Order in which the signals are read, most constraining first: a report that
 * says both "compare avec une autre agence" and "hésite" is first of all a
 * competitive situation. Deliberately explicit, so the classification never
 * depends on the order the vocabulary happens to be declared in.
 */
const DECISION_PRIORITY: readonly SellerDecisionValue[] = [
  "refus",
  "compare_autre_agence",
  "attend_evenement",
  "hesite",
  "mandat_envisage",
];

const DOCUMENT_KEYWORDS: readonly (readonly [string, string])[] = [
  ["diagnostic", "Diagnostics techniques"],
  ["dpe", "Diagnostic de performance énergétique (DPE)"],
  ["copropriete", "Documents de copropriété"],
  ["titre de propriete", "Titre de propriété"],
  ["taxe fonciere", "Avis de taxe foncière"],
  ["plan", "Plans du bien"],
];

export type SimulatedFollowThrough = {
  summary: string;
  seller_decision: SellerDecisionValue;
  objections: string[];
  missing_documents: string[];
  next_steps: { title: string; details: string | null }[];
  estimation_presented: boolean | null;
  missing_fields: string[];
  confidence: number;
};

export function simulateSarahFollowThrough(request: AiGenerationRequest): unknown {
  if (request.scenario === "invalid_output") {
    // Structurally invalid on purpose: an unknown decision, an out-of-range
    // confidence, an amount in euros in the summary, and — the important one —
    // an extra `stage: "mandat_signe"` an agent must never be able to set.
    return {
      summary: "Le vendeur signe le mandat, bien estimé à 480 000 €.",
      seller_decision: "mandat_signe",
      objections: null,
      missing_documents: [],
      next_steps: [],
      estimation_presented: "oui",
      missing_fields: [],
      confidence: 2,
      stage: "mandat_signe",
    };
  }

  if (request.scenario === "out_of_scope_choice") {
    // Shape is right, but the classification is outside the closed vocabulary:
    // it must be refused, with no write at all.
    return {
      summary: "Compte-rendu exploité.",
      seller_decision: "mandat_signe_confirme",
      objections: [],
      missing_documents: [],
      next_steps: [],
      estimation_presented: null,
      missing_fields: [],
      confidence: 0.9,
    };
  }

  const rawText = untrustedText(request.untrusted);
  const text = normalise(rawText);
  const partial = request.scenario === "partial_output";

  let decision: SellerDecisionValue = "non_precise";
  for (const candidate of DECISION_PRIORITY) {
    if (DECISION_KEYWORDS[candidate].some((keyword) => text.includes(keyword))) {
      decision = candidate;
      break;
    }
  }

  const documents = DOCUMENT_KEYWORDS.filter(([keyword]) => text.includes(keyword)).map(
    ([, label]) => label,
  );

  const objections: string[] = [];
  if (text.includes("prix")) objections.push("Le prix de présentation reste à arbitrer.");
  if (text.includes("autre agence")) objections.push("Le vendeur compare avec une autre agence.");
  if (text.includes("hesite") || text.includes("reflechit")) {
    objections.push("Le vendeur n'a pas encore tranché.");
  }

  const nextSteps: { title: string; details: string | null }[] = [];
  // A follow-up call is only proposed when the report actually says where the
  // seller stands. "Rien de noté" leads to no action at all: proposing one
  // would be inventing a next step out of an empty report.
  if (decision !== "refus" && decision !== "non_precise") {
    nextSteps.push({
      title: "Rappeler le vendeur pour faire le point",
      details: "Reprendre contact après le rendez-vous d'estimation, sans annoncer aucun chiffre.",
    });
  }
  if (documents.length > 0) {
    nextSteps.push({
      title: "Réunir les documents manquants du dossier",
      details: documents.join(" ; ").slice(0, 400),
    });
  }

  const estimationPresented = ESTIMATION_MENTION.test(text)
    ? true
    : MONEY_MENTION.test(rawText)
      ? true
      : null;

  const result: SimulatedFollowThrough = {
    summary: "",
    seller_decision: partial ? "non_precise" : decision,
    objections: partial ? [] : objections.slice(0, 5),
    missing_documents: partial ? [] : documents.slice(0, 5),
    next_steps: partial ? [] : nextSteps.slice(0, 3),
    estimation_presented: partial ? null : estimationPresented,
    missing_fields: [],
    confidence: 0,
  };

  const missing: string[] = [];
  if (result.seller_decision === "non_precise") missing.push("seller_decision");
  if (result.objections.length === 0) missing.push("objections");
  if (result.missing_documents.length === 0) missing.push("missing_documents");
  if (result.next_steps.length === 0) missing.push("next_steps");
  result.missing_fields = missing;

  result.confidence = Math.round((0.35 + 0.15 * (4 - missing.length)) * 100) / 100;

  // The summary is built from the classification, never by copying the report:
  // no amount can leak into it that way.
  const parts = [
    "Rendez-vous d'estimation réalisé.",
    `Position du vendeur : ${result.seller_decision.replace(/_/g, " ")}.`,
    result.estimation_presented === true ? "Une estimation a été présentée au vendeur." : null,
    result.missing_documents.length > 0
      ? `Documents encore attendus : ${result.missing_documents.join(", ")}.`
      : null,
  ].filter((part): part is string => part !== null);
  result.summary = parts.join(" ").slice(0, 800);

  return result;
}
