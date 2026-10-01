/**
 * Pure helpers of the editorial titles (docs/design-system.md §2.2.5, §3.8).
 * Moved from the development gallery (`AccentTitle`), where they were tested.
 *
 * A title is a list of author lines and at most one accented word. The accent
 * is a WHOLE word: « main » is not found in « maintenant »; an elided article
 * and the punctuation stay outside it (« l'administratif. » → « l' »,
 * « administratif », « . »).
 */

/** Beyond this number of author lines, a title is static (accent kept). */
export const MAX_ANIMATED_LINES = 4;

const STARTS_WITH_LETTER = /^\p{L}/u;
const ENDS_WITH_LETTER = /\p{L}$/u;

/** Prefix, accented word and suffix of a token, or `null` when the token does not hold the whole word. */
export function splitAccent(token: string, accent: string): [string, string, string] | null {
  if (!accent) return null;
  const index = token.indexOf(accent);
  if (index === -1) return null;
  const before = token.slice(0, index);
  const rest = token.slice(index + accent.length);
  if (ENDS_WITH_LETTER.test(before) || STARTS_WITH_LETTER.test(rest)) return null;
  return [before, accent, rest];
}

/** Tokens of a line, split on spaces (the spaces are rendered back as text). */
export function tokensOf(line: string): string[] {
  return line.split(" ").filter((token) => token.length > 0);
}

/** Number of times the accented word appears in the lines (must be exactly one, tested). */
export function countAccent(lines: readonly string[], accent: string): number {
  return lines.flatMap(tokensOf).filter((token) => splitAccent(token, accent)).length;
}

/** Position of the accented word, or `null` when it is absent or not unique. */
export function findAccent(
  lines: readonly string[],
  accent: string | undefined,
): { line: number; token: number } | null {
  if (!accent || countAccent(lines, accent) !== 1) return null;
  for (const [line, text] of lines.entries()) {
    const token = tokensOf(text).findIndex((candidate) => splitAccent(candidate, accent));
    if (token !== -1) return { line, token };
  }
  return null;
}

/** True when the title animates line by line (1 to 4 author lines). */
export function isAnimatable(lines: readonly string[]): boolean {
  return lines.length > 0 && lines.length <= MAX_ANIMATED_LINES;
}

/**
 * Splits a one-line text (an empty-state title) around its accented word:
 * `[before, word, after]`, whose concatenation is exactly the text. `null`
 * when the word is absent or not unique: the title is then rendered plain.
 */
export function splitTextAccent(text: string, accent: string | undefined): [string, string, string] | null {
  if (!accent || countAccent([text], accent) !== 1) return null;
  let offset = 0;
  for (const token of text.split(" ")) {
    const parts = splitAccent(token, accent);
    if (parts) {
      const start = offset + parts[0].length;
      return [text.slice(0, start), accent, text.slice(start + accent.length)];
    }
    offset += token.length + 1;
  }
  return null;
}

/**
 * How far the ink of the accented word (Instrument Serif italic) reaches past
 * its box on the right, in em of the word: the italic « f » leans out
 * (« administratif » 0.149 em measured in Chromium), most endings barely do
 * (« fictive » 0.024 em, « main » 0). Used to centre the focus frame on the
 * ink, not on the box (docs/design-system.md §2.11.2).
 */
export function accentOverhangEm(word: string): number {
  return word.endsWith("f") ? 0.15 : 0.02;
}
