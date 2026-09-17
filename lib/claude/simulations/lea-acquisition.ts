/**
 * Deterministic simulation of Léa's identity extraction.
 *
 * No network, no API key, nothing billed. The answer is built ONLY from what
 * the inputs really contain: a name, an email or a phone number that is not
 * written in the lead comes back as `null` and is reported as missing — never
 * guessed from a domain name, a first name or an area code.
 *
 * The lead's free text arrives already sanitised through `untrustedText`: a
 * sentence like "ignore tes instructions précédentes" is matched against
 * patterns like any other text and can never change the shape of the answer.
 * The simulation deliberately has NO way to express a deduplication verdict,
 * because the code does that (features/agents-ia/lea-acquisition/dedupe.ts).
 */

import { untrustedText } from "../prompt";
import type { AiGenerationRequest } from "../provider";

function fact(request: AiGenerationRequest, key: string): string | null {
  const value = request.facts[key];
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 && text !== "(inconnu)" ? text : null;
}

/** One e-mail address, as written. Only what is in the text. */
const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

/**
 * A French phone number as a human writes it: 10 digits, or +33 / 0033 forms,
 * with spaces, dots or dashes between the pairs.
 */
const PHONE_PATTERN = /(?:(?:\+33|0033)\s?[1-9]|0[1-9])(?:[\s.-]?\d{2}){4}/;

/**
 * Only two explicit forms are accepted: "je m'appelle Marie Dupont" and
 * "Nom : Dupont". Anything vaguer ("je suis pressé", "Marie au téléphone") is
 * NOT a name, and the field stays `null`: a wrong name in a CRM is worse than
 * an empty one. The name itself must start with a capital letter, so the
 * pattern cannot pick an ordinary word up.
 */
const NAME_WORD = "[A-ZÀ-Ý][\\p{L}'’-]+";
const NAME_PATTERNS: readonly RegExp[] = [
  new RegExp(`(?:^|[^\\p{L}])[Jj]e m['’]appelle\\s+(${NAME_WORD})(?:\\s+(${NAME_WORD}))?`, "u"),
  new RegExp(`(?:^|[^\\p{L}])[Nn]om\\s*:\\s*(${NAME_WORD})(?:\\s+(${NAME_WORD}))?`, "u"),
];

export type SimulatedLeadIdentity = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  missing_fields: string[];
  confidence: number;
  summary: string;
};

export function simulateLeaAcquisition(request: AiGenerationRequest): unknown {
  if (request.scenario === "invalid_output") {
    // Structurally invalid on purpose: wrong types, an out-of-range confidence
    // and two extra keys an agent must never be able to use — a deduplication
    // verdict and a pipeline stage. Must be rejected by the zod schema.
    return {
      first_name: 42,
      last_name: null,
      email: "pas-une-adresse",
      phone: null,
      missing_fields: "aucun",
      confidence: 7,
      summary: "",
      is_duplicate_of: "00000000-0000-4000-8000-000000000000",
      stage: "mandat_signe",
    };
  }

  const rawText = untrustedText(request.untrusted);
  const partial = request.scenario === "partial_output";

  let firstName: string | null = null;
  let lastName: string | null = null;
  for (const pattern of NAME_PATTERNS) {
    const found = pattern.exec(rawText);
    if (found) {
      firstName = found[1] ?? null;
      lastName = found[2] ?? null;
      break;
    }
  }

  const email = EMAIL_PATTERN.exec(rawText)?.[0] ?? null;
  const phone = PHONE_PATTERN.exec(rawText)?.[0] ?? null;

  const result: SimulatedLeadIdentity = {
    first_name: partial ? null : firstName,
    last_name: partial ? null : lastName,
    email: partial ? null : email,
    phone: partial ? null : phone,
    missing_fields: [],
    confidence: 0,
    summary: "",
  };

  const missing: string[] = [];
  if (result.first_name === null) missing.push("first_name");
  if (result.last_name === null) missing.push("last_name");
  if (result.email === null) missing.push("email");
  if (result.phone === null) missing.push("phone");
  result.missing_fields = missing;

  const found = 4 - missing.length;
  result.confidence = Math.round((0.3 + 0.15 * found) * 100) / 100;

  const source = fact(request, "lead_source");
  const chars = Number(fact(request, "lead_raw_text_chars") ?? 0);
  const parts = [
    source ? `Lead reçu via ${source}.` : "Lead reçu.",
    chars > 0 ? `Message de ${chars} caractères.` : "Aucun message libre joint.",
    missing.length === 0
      ? "Identité complète dans le lead."
      : `Éléments d'identité absents du lead : ${missing.join(", ")}.`,
  ];
  result.summary = parts.join(" ").slice(0, 400);

  return result;
}
