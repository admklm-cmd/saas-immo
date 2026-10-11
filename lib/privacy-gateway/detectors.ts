/**
 * Detection of personal identifiers in free text (pure functions, no state).
 *
 * Best effort and deliberately over-cautious: a false positive costs a little
 * context for the model, a false negative leaks a person. What this module
 * cannot see (an unknown person named without any clue, a nickname, a date of
 * birth, a plate number…) is listed in docs/activation-ia.md ("Limites").
 *
 * Detectors return SPANS on the original string; `detectIdentifiers` resolves
 * overlaps (longest span wins) so the caller can replace them in one pass.
 */

import type { PseudonymType } from "./types";

export type DetectedSpan = {
  start: number;
  end: number;
  type: PseudonymType;
  /** Text as written in the source. */
  value: string;
  /** Canonical form for known entities (so the same person gets one token). */
  canonical?: string;
};

/** What the dossier tells us about the people and values to recognise. */
export type KnownEntities = {
  persons: readonly { firstName: string | null; lastName: string | null }[];
  agencyName: string | null;
  emails: readonly string[];
  phones: readonly string[];
};

export const NO_KNOWN_ENTITIES: KnownEntities = { persons: [], agencyName: null, emails: [], phones: [] };

/** Hard cap on scanned text: keeps every pattern linear on hostile input. */
export const MAX_SCANNED_CHARS = 20_000;

const SEP = "[ \\t.\\-\\u00a0\\u202f]";
const UNICODE_LETTER = "\\p{L}";

// ---------------------------------------------------------------------------
// Text folding (accent- and case-insensitive matching, same length)
// ---------------------------------------------------------------------------

/**
 * Lower-cases and strips accents WITHOUT changing the string length, so indexes
 * found on the folded text are valid on the original one.
 */
export function foldForMatching(text: string): string {
  let out = "";
  for (const ch of text) {
    if (ch.length !== 1) {
      out += ch;
      continue;
    }
    if (ch === "’" || ch === "‘") {
      out += "'";
      continue;
    }
    const first = ch.normalize("NFD").charAt(0) || ch;
    const lower = first.toLowerCase();
    out += lower.length === 1 ? lower : first;
  }
  return out;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------------------------------------------------------------------------
// Pattern based detectors
// ---------------------------------------------------------------------------

const EMAIL_PATTERNS: readonly RegExp[] = [
  // The lookbehind makes a match start at the beginning of a run only, which
  // keeps the scan linear on hostile input.
  new RegExp("(?<![\\p{L}\\p{N}._%+\\-])[\\p{L}\\p{N}._%+\\-]+@[\\p{L}\\p{N}.\\-]+\\.\\p{L}{2,}", "gu"),
  // Obfuscated forms: "jean [at] example.test", "jean (arobase) example.test".
  new RegExp(
    "(?<![\\p{L}\\p{N}._%+\\-])[\\p{L}\\p{N}._%+\\-]+\\s*(?:\\[\\s*(?:at|arobase)\\s*\\]|\\(\\s*(?:at|arobase)\\s*\\)|\\s+arobase\\s+)\\s*[\\p{L}\\p{N}.\\-]+\\.\\p{L}{2,}",
    "giu",
  ),
  // Spaced and bracketed forms: "jean . dupont @ example . test", "jean{at}example.test",
  // "jean [@] example [dot] test".
  new RegExp(
    "(?<![\\p{L}\\p{N}._%+\\-])(?:[\\p{L}\\p{N}_%+\\-]+[ \\t]*\\.[ \\t]*){0,4}[\\p{L}\\p{N}_%+\\-]+[ \\t]*(?:@|[\\[({<][ \\t]*(?:at|arobase|@)[ \\t]*[\\])}>]|\\barobase\\b)[ \\t]*(?:[\\p{L}\\p{N}\\-]+[ \\t]*(?:\\.|[\\[({<][ \\t]*(?:dot|point)[ \\t]*[\\])}>]|\\b(?:dot|point)\\b)[ \\t]*){1,4}\\p{L}{2,}",
    "giu",
  ),
  // Spelled out: "jean.dupont at gmail dot com" (the domain needs a dot or a "dot" word).
  new RegExp(
    "(?<![\\p{L}\\p{N}._%+\\-])[\\p{L}\\p{N}._%+\\-]+[ \\t]+at[ \\t]+[\\p{L}\\p{N}\\-]+(?:(?:\\.|[ \\t]+(?:dot|point)[ \\t]+)[\\p{L}\\p{N}\\-]+){1,3}(?<=\\p{L}{2})(?![\\p{L}\\p{N}])",
    "giu",
  ),
];

const FR_PHONE_BODY = `[1-9](${SEP}?)\\d{2}\\1\\d{2}\\1\\d{2}\\1\\d{2}`;
const PHONE_PATTERNS: readonly RegExp[] = [
  // +33 6 12 34 56 78, +33 (0)6…, 0033 6…
  new RegExp(`(?<![\\d+])\\(?(?:\\+|00)33\\)?${SEP}?(?:\\(0\\))?${SEP}?${FR_PHONE_BODY}(?!\\d)`, "g"),
  // 06 12 34 56 78, 06.12.34.56.78, 0612345678 (one separator style only, so a
  // date such as "05 11 2026 10 00" is not mistaken for a number).
  new RegExp(`(?<![\\d+])0[1-9](${SEP}?)\\d{2}\\1\\d{2}\\1\\d{2}\\1\\d{2}(?!\\d)`, "g"),
  // Mixed separators and odd groupings ("06 3998 1001", "0 6 39 98 10 01"). A leading
  // date ("01.02.2026 10h") is excluded so a date and an hour are not read as a number.
  new RegExp(
    `(?<![\\d+])(?!\\d{2}[ .\\-/]\\d{2}[ .\\-/](?:19|20)\\d{2})0${SEP}?[1-9](?:${SEP}?\\d{2}){4}(?!${SEP}?\\d)`,
    "g",
  ),
  // 33 6 12 34 56 78 written without the plus sign.
  new RegExp("(?<![\\d+])33[1-9]\\d{8}(?!\\d)", "g"),
  // 04 91 123 456
  new RegExp(`(?<![\\d+])0[1-9]${SEP}?\\d{2}${SEP}?\\d{3}${SEP}?\\d{3}(?!\\d)`, "g"),
  // Any other international number: +32 475 12 34 56, +1 202 555 0100…
  new RegExp(`(?<![\\d+])\\+\\d{1,3}(?:${SEP}?\\d){7,12}(?!\\d)`, "g"),
];

const URL_PATTERNS: readonly RegExp[] = [
  new RegExp("(?:https?:\\/\\/|www\\.)[^\\s<>\"')\\]]+", "giu"),
  // Bare domain ("monsite.fr/annonce"), limited to common endings to avoid
  // treating "fin.Merci" as a link.
  new RegExp(
    "(?<![\\p{L}\\p{N}@._\\-])(?:[\\p{L}\\p{N}\\-]+\\.)+(?:fr|com|net|org|eu|io|co|info|biz|immo|app|dev|me|tv|xyz|online|site|tech|cloud|test|local|example|invalid)(?![\\p{L}\\p{N}\\-])(?:[\\/?#][^\\s<>\"')\\]]*)?",
    "giu",
  ),
];

const IBAN_PATTERN = new RegExp("(?<![A-Za-z0-9])[A-Z]{2}\\d{2}(?:[ .\\-]?[A-Z0-9]{4}){3,7}(?:[ .\\-]?[A-Z0-9]{1,4})?(?![A-Za-z0-9])", "gi");
const NIR_PATTERN = new RegExp(
  "(?<!\\d)[12][ .]?\\d{2}[ .]?(?:0[1-9]|1[0-2]|[2-9]\\d)[ .]?(?:\\d{2}|2[AB])[ .]?\\d{3}[ .]?\\d{3}(?:[ .]?\\d{2})?(?!\\d)",
  "gi",
);
const CARD_PATTERN = new RegExp("(?<!\\d)(?:\\d[ -]?){15}\\d(?!\\d)", "g");
const UUID_PATTERN = new RegExp(
  "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|(?<![0-9a-f])[0-9a-f]{32}(?![0-9a-f])",
  "gi",
);
/** Social handles ("@camille_b"): an identifier even without a name. */
const HANDLE_PATTERN = new RegExp("(?<![\\p{L}\\p{N}._%+\\-@])@[\\p{L}\\p{N}_]{3,30}(?:\\.[\\p{L}\\p{N}_]+)*", "giu");

function collect(text: string, patterns: readonly RegExp[], type: PseudonymType, into: DetectedSpan[]): void {
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const index = match.index ?? 0;
      let value = match[0];
      // A trailing sentence mark is not part of an address or a link.
      const trimmed = value.replace(/[.,;:!?]+$/u, "");
      if (type === "URL" || type === "EMAIL") value = trimmed;
      if (value.length === 0) continue;
      into.push({ start: index, end: index + value.length, type, value });
    }
  }
}

// ---------------------------------------------------------------------------
// Postal addresses
// ---------------------------------------------------------------------------

const STREET_TYPES = [
  "rue",
  "avenue",
  "av",
  "boulevard",
  "bd",
  "chemin",
  "impasse",
  "allée",
  "allee",
  "place",
  "cours",
  "route",
  "quai",
  "square",
  "traverse",
  "montée",
  "montee",
  "passage",
  "résidence",
  "residence",
  "lotissement",
  "domaine",
  "villa",
  "cité",
  "cite",
  "hameau",
  "esplanade",
  "promenade",
  "corniche",
  "clos",
  "parc",
  "rond-point",
  "zac",
  // Common abbreviations (a trailing dot is accepted: "all.", "rte.").
  "all",
  "imp",
  "chem",
  "rte",
  "bld",
  "bvd",
  "pl",
];

const STREET_PATTERN = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:(\\d{1,4})(?:${SEP}?(?:bis|ter|quater|[a-d])(?![\\p{L}]))?[ \\t]*,?[ \\t]*)?(${STREET_TYPES.map(escapeRegExp).join("|")})\\.?(?![\\p{L}\\p{N}])`,
  "giu",
);

const PARTICLES = new Set(["de", "du", "des", "la", "le", "les", "et", "aux", "au", "en", "sur", "sous", "d", "l", "von", "van", "della", "di"]);
const WORD = new RegExp(`^${UNICODE_LETTER}[\\p{L}'’\\-]*`, "u");
const CAPITALISED = new RegExp(`^(?:[dl]['’])?\\p{Lu}`, "u");

type WordRead = { end: number; lastNameEnd: number };

/**
 * Reads up to `max` words after `from` on the same line. In `strict` mode a
 * word must be capitalised (or a particle), which keeps "sur place" or "la
 * route était bloquée" out of the addresses. Returns the end of the last
 * NON-particle word, or -1 when no name could be read.
 */
function readNameWords(text: string, from: number, max: number, strict: boolean): WordRead | null {
  let position = from;
  let lastNameEnd = -1;
  let words = 0;
  let previousWasParticle = false;

  while (words < max) {
    const gap = /^[ \t]+/.exec(text.slice(position, position + 8));
    if (!gap) break;
    const wordStart = position + gap[0].length;
    const rest = text.slice(wordStart, wordStart + 60);

    const digits = /^\d{1,4}(?![\d\p{L}])/u.exec(rest);
    if (digits && previousWasParticle) {
      lastNameEnd = wordStart + digits[0].length;
      position = lastNameEnd;
      words += 1;
      previousWasParticle = false;
      continue;
    }

    const word = WORD.exec(rest);
    if (!word) break;
    const raw = word[0];
    const base = raw.replace(/['’].*$/u, "");
    const capitalAfterApostrophe = /['’]\p{Lu}/u.test(raw);
    const isParticle = PARTICLES.has(base) && !capitalAfterApostrophe;

    if (isParticle) {
      previousWasParticle = true;
      position = wordStart + raw.length;
      words += 1;
      continue;
    }
    if (strict && !CAPITALISED.test(raw)) break;

    lastNameEnd = wordStart + raw.length;
    position = lastNameEnd;
    words += 1;
    previousWasParticle = false;
  }

  return lastNameEnd === -1 ? null : { end: lastNameEnd, lastNameEnd };
}

function detectAddresses(text: string, into: DetectedSpan[]): void {
  STREET_PATTERN.lastIndex = 0;
  for (const match of text.matchAll(STREET_PATTERN)) {
    const index = match.index ?? 0;
    const hasNumber = match[1] !== undefined;
    const typeEnd = index + match[0].length;
    const name = readNameWords(text, typeEnd, hasNumber ? 5 : 4, !hasNumber);
    if (!name) continue;
    into.push({ start: index, end: name.end, type: "ADRESSE", value: text.slice(index, name.end) });
  }
}

// ---------------------------------------------------------------------------
// Persons named without being known (title, introduction, signature)
// ---------------------------------------------------------------------------

const PERSON_LEAD_INS: readonly { pattern: RegExp; allowNewline: boolean }[] = [
  // Civility.
  {
    pattern: new RegExp(
      "(?<![\\p{L}])(?:M\\.|Mr\\.?|Mme\\.?|Mlle\\.?|Monsieur|Madame|Mademoiselle|Maître|Maitre|Me|Dr\\.?|Docteur|Pr\\.?|Professeur)(?=[ \\t])",
      "gu",
    ),
    allowNewline: false,
  },
  // Introductions.
  {
    pattern: new RegExp(
      "(?<![\\p{L}])(?:je m['’]appelle|je me nomme|mon nom est|mon nom c['’]est|moi c['’]est|je suis|nom et prénom ?:|nom ?:|prénom ?:|nom de famille ?:|contact ?:|signé ?:)(?=[ \\t])",
      "giu",
    ),
    allowNewline: false,
  },
  // Greetings (same line only).
  {
    pattern: new RegExp("(?<![\\p{L}])(?:bonjour|bonsoir|salut|cher|chère|chere|allô|allo)[ \\t]*[,.!]?(?=[ \\t])", "giu"),
    allowNewline: false,
  },
  // Closings: the signature often sits on the next line.
  {
    pattern: new RegExp(
      "(?<![\\p{L}])(?:cordialement|bien cordialement|bien à vous|bien a vous|sincères salutations|salutations|amicalement|merci d['’]avance|à bientôt|a bientot|bonne journée|bonne soirée)[ \\t]*[,.!]?(?=[ \\t\\r\\n])",
      "giu",
    ),
    allowNewline: true,
  },
];

const NAME_WORD = new RegExp("^(?:\\p{Lu}[\\p{L}'’\\-]+|\\p{Lu}\\.)", "u");

const NOT_A_NAME = new Set([
  "monsieur",
  "madame",
  "mademoiselle",
  "maître",
  "maitre",
  "docteur",
  "professeur",
  "à",
  "tous",
  "toute",
  "équipe",
  "agence",
  "l'agence",
  "marseille",
  "cassis",
  "ciotat",
  "la",
  "le",
  "les",
]);

function readPersonName(text: string, from: number, allowNewline: boolean): { start: number; end: number } | null {
  let position = from;
  const lead = (allowNewline ? /^[ \t\r\n]+/ : /^[ \t]+/).exec(text.slice(position, position + 12));
  if (!lead) return null;
  position += lead[0].length;
  const start = position;
  let end = -1;
  let words = 0;

  while (words < 3) {
    const rest = text.slice(position, position + 60);
    const word = NAME_WORD.exec(rest);
    if (!word) {
      // Lower-case nobiliary particle followed by a capitalised word.
      const particle = /^(?:de la|de|du|d['’]|van|von|le|el|al|ben)[ \t]?(?=\p{Lu})/u.exec(rest);
      if (!particle || words === 0) break;
      position += particle[0].length;
      continue;
    }
    const bare = word[0].replace(/\.$/u, "");
    if (NOT_A_NAME.has(bare.toLowerCase())) break;
    end = position + bare.length;
    position = end;
    words += 1;
    const gap = /^[ \t]+/.exec(text.slice(position, position + 4));
    if (!gap) break;
    position += gap[0].length;
  }

  return end === -1 ? null : { start, end };
}

function detectNamedPersons(text: string, into: DetectedSpan[]): void {
  for (const { pattern, allowNewline } of PERSON_LEAD_INS) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const matchEnd = (match.index ?? 0) + match[0].length;
      const name = readPersonName(text, matchEnd, allowNewline);
      if (!name) continue;
      into.push({ start: name.start, end: name.end, type: "PERSONNE", value: text.slice(name.start, name.end) });
    }
  }
}

// ---------------------------------------------------------------------------
// Known entities of the dossier
// ---------------------------------------------------------------------------

function nameRegex(name: string): string {
  return escapeRegExp(foldForMatching(name.trim())).replace(/(?:\\-|-| )+/g, "[ \\-]+");
}

/** Components of a compound name (3 letters or more, particles excluded). */
function nameComponents(name: string): string[] {
  const parts = name
    .trim()
    .split(/[\s\-]+/u)
    .filter((part) => part.length >= 3 && !PARTICLES.has(foldForMatching(part)));
  return parts.length > 1 || (parts.length === 1 && parts[0] !== name.trim()) ? [...new Set(parts)] : [];
}

function detectKnown(text: string, known: KnownEntities, into: DetectedSpan[]): void {
  const folded = foldForMatching(text);
  const boundary = (body: string) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${body})(?![\\p{L}\\p{N}])`, "gu");

  for (const person of known.persons) {
    const first = person.firstName?.trim() ?? "";
    const last = person.lastName?.trim() ?? "";
    const canonicalFull = `${first} ${last}`.trim();

    if (first.length >= 2 && last.length >= 2) {
      const both = `${nameRegex(first)}[ \\t]*,?[ \\t]+${nameRegex(last)}|${nameRegex(last)}[ \\t]*,?[ \\t]+${nameRegex(first)}`;
      for (const match of folded.matchAll(boundary(both))) {
        const index = match.index ?? 0;
        into.push({
          start: index,
          end: index + match[0].length,
          type: "PERSONNE",
          value: text.slice(index, index + match[0].length),
          canonical: canonicalFull,
        });
      }
    }
    for (const [name, type] of [
      [last, "NOM"],
      [first, "PRENOM"],
    ] as const) {
      if (name.length < 2) continue;
      // The whole name, then each component ("de la Fontaine" -> "Fontaine",
      // "Jean-Pierre" -> "Jean", "Pierre"): people shorten names in free text.
      for (const piece of [name, ...nameComponents(name)]) {
        for (const match of folded.matchAll(boundary(nameRegex(piece)))) {
          const index = match.index ?? 0;
          into.push({
            start: index,
            end: index + match[0].length,
            type,
            value: text.slice(index, index + match[0].length),
            canonical: piece,
          });
        }
      }
    }
  }

  const agency = known.agencyName?.trim() ?? "";
  if (agency.length >= 3) {
    for (const match of folded.matchAll(boundary(nameRegex(agency)))) {
      const index = match.index ?? 0;
      into.push({
        start: index,
        end: index + match[0].length,
        type: "AGENCE",
        value: text.slice(index, index + match[0].length),
        canonical: agency,
      });
    }
  }

  for (const email of known.emails) {
    const value = email.trim();
    if (value.length < 5) continue;
    for (const match of folded.matchAll(new RegExp(escapeRegExp(foldForMatching(value)), "gu"))) {
      const index = match.index ?? 0;
      into.push({ start: index, end: index + match[0].length, type: "EMAIL", value: text.slice(index, index + match[0].length) });
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const TYPE_PRIORITY: Record<PseudonymType, number> = {
  EMAIL: 0,
  URL: 1,
  IBAN: 2,
  SECU: 3,
  CARTE: 4,
  TEL: 5,
  ID: 6,
  ADRESSE: 7,
  PERSONNE: 8,
  AGENCE: 9,
  NOM: 10,
  PRENOM: 11,
};

/** Keeps the longest span where several overlap; returns them in text order. */
export function resolveOverlaps(spans: readonly DetectedSpan[]): DetectedSpan[] {
  const ordered = [...spans].sort(
    (a, b) =>
      a.start - b.start ||
      b.end - b.start - (a.end - a.start) ||
      // On the same text, what the dossier KNOWS (canonical form) beats a guess.
      Number(b.canonical !== undefined) - Number(a.canonical !== undefined) ||
      TYPE_PRIORITY[a.type] - TYPE_PRIORITY[b.type],
  );
  const kept: DetectedSpan[] = [];
  for (const span of ordered) {
    const last = kept[kept.length - 1];
    if (!last || span.start >= last.end) {
      kept.push(span);
      continue;
    }
    // Overlap: keep the longer one (ties keep the earlier-sorted, i.e. higher priority).
    if (span.end - span.start > last.end - last.start) kept[kept.length - 1] = span;
  }
  return kept;
}

/** Finds every identifier of `text` (truncated to `MAX_SCANNED_CHARS`). */
export function detectIdentifiers(text: string, known: KnownEntities = NO_KNOWN_ENTITIES): DetectedSpan[] {
  const scanned = text.length > MAX_SCANNED_CHARS ? text.slice(0, MAX_SCANNED_CHARS) : text;
  const spans: DetectedSpan[] = [];

  collect(scanned, EMAIL_PATTERNS, "EMAIL", spans);
  collect(scanned, PHONE_PATTERNS, "TEL", spans);
  collect(scanned, URL_PATTERNS, "URL", spans);
  collect(scanned, [IBAN_PATTERN], "IBAN", spans);
  collect(scanned, [NIR_PATTERN], "SECU", spans);
  collect(scanned, [CARD_PATTERN], "CARTE", spans);
  collect(scanned, [UUID_PATTERN], "ID", spans);
  collect(scanned, [HANDLE_PATTERN], "URL", spans);
  detectAddresses(scanned, spans);
  detectNamedPersons(scanned, spans);
  detectKnown(scanned, known, spans);

  return resolveOverlaps(spans);
}

/** Digits of a phone number, with the +33 / 0033 prefix folded to a leading 0. */
export function phoneDigits(value: string): string {
  const digits = value.replace(/\D/gu, "");
  if (digits.startsWith("0033")) return `0${digits.slice(4)}`;
  if (value.trim().startsWith("+33") && digits.startsWith("33")) return `0${digits.slice(2).replace(/^0/, "")}`;
  return digits;
}
