import "server-only";

/**
 * The Privacy Gateway proper: turns a raw `AiGenerationRequest` (trusted facts,
 * prospect free text, dossier knowledge) into a `SanitizedAiRequest`, or refuses.
 *
 * Pipeline (audit §3), every step failing CLOSED:
 *   1. a policy must exist for the task, and the request must carry its
 *      `privacy` context;
 *   2. facts: every key must be in the policy, every value must fit its spec
 *      (enum, boolean, bounded number, masked postal code) — no free string;
 *   3. untrusted blocks: label must be in the policy; content is scanned
 *      (emails, phones, links, addresses, IBAN, ids, known and introduced
 *      names…) and each hit is replaced by an ephemeral pseudonym;
 *   4. the prompt is rendered with the usual untrusted-data isolation
 *      (`lib/claude/prompt.ts`);
 *   5. LAST GATE: the final system + user text is scanned again, and the known
 *      literals of the dossier are looked for. Any hit means nothing is sent.
 *
 * The only producer of `SanitizedAiRequest` is `finalise` below, and the
 * transports check `isSanitizedRequest` at runtime in addition to the type.
 */

import { buildPromptInput } from "@/lib/claude/prompt";
import type {
  AiChoice,
  AiFactValue,
  AiGenerationRequest,
  AiPrivacyAudit,
  AiUntrustedField,
} from "@/lib/claude/provider";

import {
  detectIdentifiers,
  MAX_SCANNED_CHARS,
  NO_KNOWN_ENTITIES,
  phoneDigits,
  type KnownEntities,
} from "./detectors";
import type { PseudonymSession } from "./pseudonyms";
import { policyFor, type FactSpec } from "./policies";
import type { SanitizedAiRequest } from "./types";

/** Reasons a request can be refused; stable codes, safe to journal. */
export const PRIVACY_REFUSALS = [
  "no_policy_for_task",
  "privacy_context_missing",
  "unknown_fact",
  "invalid_fact_value",
  "unknown_untrusted_label",
  "unknown_or_invalid_choice",
  "identity_unknown_for_free_text",
  "system_prompt_contains_identifier",
  "identifier_survived_sanitisation",
  "known_value_survived_sanitisation",
] as const;
export type PrivacyRefusal = (typeof PRIVACY_REFUSALS)[number];

export type SanitizeOutcome =
  | { ok: true; request: SanitizedAiRequest; audit: AiPrivacyAudit }
  | { ok: false; reason: PrivacyRefusal; audit: AiPrivacyAudit };

/**
 * Fixed text appended to every system prompt that goes out. It is code, not
 * data: it explains the tokens so the model copies them verbatim.
 */
export const PSEUDONYM_NOTICE = [
  "",
  "PSEUDONYMES : pour protéger les personnes, les identités et coordonnées (noms, prénoms, emails,",
  "téléphones, adresses, liens, nom de l'agence) sont remplacées par des jetons entre crochets, par",
  "exemple [PERSONNE_1_xxxxxxxx]. Recopie un jeton tel quel (crochets compris) chaque fois que tu dois",
  "citer cette information. N'invente jamais un jeton, ne le modifie pas et ne cherche pas à deviner la",
  "valeur qu'il remplace.",
].join("\n");

const sanitizedRegistry = new WeakSet<object>();

/** Runtime proof that a request was produced by the gateway. */
export function isSanitizedRequest(value: unknown): value is SanitizedAiRequest {
  return typeof value === "object" && value !== null && sanitizedRegistry.has(value);
}

function finalise(input: {
  task: SanitizedAiRequest["task"];
  promptVersion: string;
  attempt: number;
  system: string;
  user: string;
}): SanitizedAiRequest {
  const frozen = Object.freeze({ ...input }) as unknown as SanitizedAiRequest;
  sanitizedRegistry.add(frozen);
  return frozen;
}

function emptyAudit(task: AiGenerationRequest["task"]): AiPrivacyAudit {
  return {
    task,
    outcome: "refused",
    reason: null,
    replaced: {},
    facts_sent: [],
    untrusted_fields_sent: [],
    untrusted_chars: 0,
  };
}

function knownEntities(request: AiGenerationRequest): KnownEntities {
  const privacy = request.privacy;
  if (!privacy) return NO_KNOWN_ENTITIES;
  return {
    persons: (privacy.persons ?? []).map((person) => ({
      firstName: person.firstName?.trim() || null,
      lastName: person.lastName?.trim() || null,
    })),
    agencyName: privacy.agencyName?.trim() || null,
    emails: (privacy.emails ?? []).filter((value): value is string => typeof value === "string" && value.trim().length > 0),
    phones: (privacy.phones ?? []).filter((value): value is string => typeof value === "string" && value.trim().length > 0),
  };
}

function checkFact(spec: FactSpec, value: AiFactValue): AiFactValue | undefined {
  if (value === null) return null;
  switch (spec.kind) {
    case "boolean":
      return typeof value === "boolean" ? value : undefined;
    case "enum":
      return typeof value === "string" && spec.values.includes(value) ? value : undefined;
    case "number":
      return typeof value === "number" &&
        Number.isFinite(value) &&
        value >= spec.min &&
        value <= spec.max &&
        (!spec.integer || Number.isInteger(value))
        ? value
        : undefined;
    case "postal_code": {
      if (typeof value !== "string") return undefined;
      const digits = /^\d{5}$/.exec(value.trim());
      return digits ? `${digits[0].slice(0, 2)}***` : undefined;
    }
  }
}

/**
 * Text beyond the policy limit is never sent, so it is not scanned either: the
 * raw content is cut (at a word boundary, so no half identifier remains) well
 * above the final limit, then the pseudonymised result is cut to the limit.
 */
function boundRaw(text: string, maxChars: number): string {
  const limit = maxChars * 3;
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const boundary = Math.max(cut.lastIndexOf(" "), cut.lastIndexOf("\n"));
  return boundary > 0 ? cut.slice(0, boundary) : cut;
}

/**
 * Brings look-alike characters back to plain ones BEFORE detection, so that
 * full-width digits, ideographic dots or zero-width characters hidden inside an
 * address or a number cannot slip through ("０６ ３９…", "jean＠example。test",
 * "Berth​ier"). The normalised text is what is scanned AND what is sent.
 */
export function normaliseForDetection(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[​-‏⁠﻿­‪-‮⁦-⁩]/gu, "")
    .replace(/[。｡﹒․]/gu, ".");
}

/** Replaces every identifier of `text` by a pseudonym. */
export function pseudonymiseText(text: string, known: KnownEntities, session: PseudonymSession): string {
  // Normalise first: a full-width bracket must not turn into a forged token
  // after the neutralisation below.
  // A prospect cannot plant something that looks like one of our tokens: this
  // runs BEFORE the detection, so the tokens we then insert are left alone.
  const neutralised = session.neutralise(normaliseForDetection(text));
  const scanned = neutralised.length > MAX_SCANNED_CHARS ? neutralised.slice(0, MAX_SCANNED_CHARS) : neutralised;
  const spans = detectIdentifiers(scanned, known);
  let out = "";
  let cursor = 0;
  for (const span of spans) {
    out += scanned.slice(cursor, span.start);
    out += session.pseudonymize(span.type, span.value, span.canonical);
    cursor = span.end;
  }
  out += scanned.slice(cursor);
  return out;
}

function digitsOnly(text: string): string {
  return text.replace(/\D/g, "");
}

/** Splits long text on line breaks so that every chunk is fully scanned. */
function chunks(text: string): string[] {
  const out: string[] = [];
  let current = "";
  for (const line of text.split("\n")) {
    if (current.length + line.length + 1 > MAX_SCANNED_CHARS / 2 && current.length > 0) {
      out.push(current);
      current = "";
    }
    current += `${line}\n`;
  }
  if (current.length > 0) out.push(current);
  return out;
}

/**
 * Last gate: anything still recognisable as an identifier blocks the call.
 * Names are NOT looked for here (the agents are called Léa, Hugo, Emma… and a
 * contact may share a name with a word of the fixed prompts): they were
 * replaced in the free text by the first pass, and facts hold no free string.
 */
function survivors(text: string, known: KnownEntities): PrivacyRefusal | null {
  for (const part of chunks(text)) {
    if (detectIdentifiers(part, NO_KNOWN_ENTITIES).length > 0) return "identifier_survived_sanitisation";
  }

  const lowered = text.toLowerCase();
  for (const email of known.emails) {
    if (lowered.includes(email.trim().toLowerCase())) return "known_value_survived_sanitisation";
  }
  const digits = digitsOnly(text);
  for (const phone of known.phones) {
    const wanted = phoneDigits(phone);
    if (wanted.length >= 9 && digits.includes(wanted)) return "known_value_survived_sanitisation";
  }
  return null;
}

export function sanitizeAiRequest(request: AiGenerationRequest, session: PseudonymSession): SanitizeOutcome {
  const audit = emptyAudit(request.task);
  const refuse = (reason: PrivacyRefusal): SanitizeOutcome => ({
    ok: false,
    reason,
    audit: { ...audit, outcome: "refused", reason },
  });

  // 1. policy + dossier knowledge ------------------------------------------
  const policy = policyFor(request.task);
  if (!policy) return refuse("no_policy_for_task");
  if (!request.privacy) return refuse("privacy_context_missing");
  const known = knownEntities(request);
  if (policy.requiresKnownIdentity && !known.persons.some((p) => (p.firstName?.length ?? 0) >= 2 && (p.lastName?.length ?? 0) >= 2)) {
    // The free text may carry a name nobody told us about: it cannot be
    // recognised, so it does not leave (see docs/activation-ia.md, Léa).
    return refuse("identity_unknown_for_free_text");
  }

  // 2. facts ---------------------------------------------------------------
  const facts: Record<string, AiFactValue> = {};
  for (const [key, value] of Object.entries(request.facts)) {
    if (!Object.prototype.hasOwnProperty.call(policy.facts, key)) return refuse("unknown_fact");
    const checked = checkFact(policy.facts[key] as FactSpec, value);
    if (checked === undefined) return refuse("invalid_fact_value");
    facts[key] = checked;
  }

  // 3. untrusted free text -------------------------------------------------
  const untrusted: AiUntrustedField[] = [];
  let untrustedChars = 0;
  for (const field of request.untrusted ?? []) {
    if (!Object.prototype.hasOwnProperty.call(policy.untrusted, field.label)) {
      return refuse("unknown_untrusted_label");
    }
    const spec = policy.untrusted[field.label];
    if (!spec) return refuse("unknown_untrusted_label");
    if (field.content.trim().length === 0) continue;

    let content: string;
    if (spec.mode === "replace") {
      // The whole block is one identity: register it as known so that the same
      // name elsewhere in the dossier gets the same token.
      content = session.pseudonymize(spec.as, field.content.trim().slice(0, spec.maxChars));
    } else {
      content = pseudonymiseText(boundRaw(field.content, spec.maxChars), known, session);
      if (content.length > spec.maxChars) content = content.slice(0, spec.maxChars);
    }
    untrustedChars += content.length;
    untrusted.push({ label: field.label, content });
  }

  // 4. choices -------------------------------------------------------------
  const choices: AiChoice[] = [];
  if ((request.choices?.length ?? 0) > 0) {
    if (!policy.choices || (request.choices?.length ?? 0) > policy.choices.maxCount) {
      return refuse("unknown_or_invalid_choice");
    }
    for (const choice of request.choices ?? []) {
      if (!policy.choices.idPattern.test(choice.id)) return refuse("unknown_or_invalid_choice");
      choices.push({ id: choice.id, label: pseudonymiseText(choice.label, known, session) });
    }
  }

  // 5. system prompt: static code, but verified, never trusted blindly -------
  if (chunks(request.systemPrompt).some((part) => detectIdentifiers(part, NO_KNOWN_ENTITIES).length > 0)) return refuse("system_prompt_contains_identifier");

  const system = `${request.systemPrompt}\n${PSEUDONYM_NOTICE}`;
  const user = buildPromptInput({ facts, choices, untrusted });

  // 6. last gate -------------------------------------------------------------
  const survivor = survivors(user, known) ?? survivors(system, known);
  if (survivor) return refuse(survivor);

  const sent: AiPrivacyAudit = {
    task: request.task,
    outcome: "sent",
    reason: null,
    replaced: session.counts(),
    facts_sent: Object.keys(facts),
    untrusted_fields_sent: untrusted.map((field) => field.label),
    untrusted_chars: untrustedChars,
  };

  return {
    ok: true,
    audit: sent,
    request: finalise({
      task: request.task,
      promptVersion: request.promptVersion,
      attempt: request.attempt ?? 1,
      system,
      user,
    }),
  };
}
