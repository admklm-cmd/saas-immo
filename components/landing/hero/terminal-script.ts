/**
 * Typing schedule of the hero terminal « humain ⇄ machine »
 * (docs/design-system.md §2.11.4 bis E). Pure and deterministic: no random,
 * the same delays on every load, computed on the server and written inline as
 * CSS variables (the CSS animations do the typing; the server HTML is the
 * final state).
 *
 * The machine types fast and regular (24 ms a character), the human slower,
 * after a hesitation of the cursor (700 ms, then 52 ms a character); the
 * closing comment at 36 ms. Times are ms after the first display.
 */

export type TerminalLine =
  | { readonly kind: "comment"; readonly text: string }
  | { readonly kind: "agent" | "human"; readonly from: string; readonly to: string; readonly content: string };

/** First typed line, after the arrival of the title (1.4 s). */
export const TYPING_START_MS = 1_600;
export const AGENT_CHAR_MS = 24;
export const HUMAN_CHAR_MS = 52;
export const CLOSING_CHAR_MS = 36;
export const AGENT_PAUSE_MS = 520;
export const HUMAN_PAUSE_MS = 800;
/** Pause before the closing comment (instead of 520). */
export const CLOSING_PAUSE_MS = 900;
/** The cursor blinks this long after the prompt of the human line. */
export const HESITATION_MS = 700;
/** Final blinks of the cursor: 530 ms on, 530 ms off, three times. */
export const BLINK_HALF_MS = 530;
export const FINAL_BLINKS = 3;

export type ScheduledChar = {
  readonly char: string;
  /** The character appears at this instant (steps, no fade). */
  readonly at: number;
  /** The cursor sits right after it during [at, at + cursorMs). */
  readonly cursorMs: number;
};

export type ScheduledLine =
  | { readonly kind: "static"; readonly text: string }
  | {
      readonly kind: "agent" | "human" | "closing";
      /** Prompt (sender, arrow, receiver) shown at once; `null` for the closing comment. */
      readonly promptAt: number | null;
      readonly from: string | null;
      readonly to: string | null;
      /** Blinking cursor before the first character (human line only). */
      readonly hesitation: { readonly at: number; readonly ms: number } | null;
      readonly chars: readonly ScheduledChar[];
      /** Instant the last character's slot ends. */
      readonly end: number;
    };

export type TerminalSchedule = {
  readonly lines: readonly ScheduledLine[];
  /** All typed: `data-terminal-state="done"`. */
  readonly doneAt: number;
  /** End of the three final blinks; the cursor then stays on, still. */
  readonly settledAt: number;
};

function rateOf(kind: "agent" | "human" | "closing"): number {
  return kind === "human" ? HUMAN_CHAR_MS : kind === "closing" ? CLOSING_CHAR_MS : AGENT_CHAR_MS;
}

/**
 * The schedule of the given lines: the first comment is static (always
 * visible, never typed), the last comment is the typed closing line, every
 * other line is an agent or human line.
 */
export function terminalSchedule(lines: readonly TerminalLine[]): TerminalSchedule {
  const out: ScheduledLine[] = [];
  let t = TYPING_START_MS;
  const typedIndexes = lines.map((line, index) => (index === 0 && line.kind === "comment" ? -1 : index)).filter((index) => index >= 0);
  const lastTyped = typedIndexes.at(-1) ?? -1;

  lines.forEach((line, index) => {
    if (index === 0 && line.kind === "comment") {
      out.push({ kind: "static", text: line.text });
      return;
    }
    const kind: "agent" | "human" | "closing" = line.kind === "comment" ? "closing" : line.kind;
    const text = line.kind === "comment" ? line.text : line.content;
    const promptAt = line.kind === "comment" ? null : t;
    const hesitation = kind === "human" ? { at: t, ms: HESITATION_MS } : null;
    const first = t + (hesitation ? HESITATION_MS : 0);
    const rate = rateOf(kind);
    const glyphs = Array.from(text);
    const end = first + glyphs.length * rate;
    const next = lines[index + 1];
    const isLast = index === lastTyped;
    const pause = isLast ? 0 : next?.kind === "comment" ? CLOSING_PAUSE_MS : kind === "human" ? HUMAN_PAUSE_MS : AGENT_PAUSE_MS;
    const chars = glyphs.map((char, k) => ({
      char,
      at: first + k * rate,
      // The cursor follows the last character shown; on the last one it waits through the pause.
      cursorMs: k < glyphs.length - 1 ? rate : rate + pause,
    }));
    out.push({
      kind,
      promptAt,
      from: line.kind === "comment" ? null : line.from,
      to: line.kind === "comment" ? null : line.to,
      hesitation,
      chars,
      end,
    });
    t = end + pause;
  });

  const lastLine = out.at(-1);
  const doneAt = lastLine && lastLine.kind !== "static" ? lastLine.end : 0;
  return { lines: out, doneAt, settledAt: doneAt + FINAL_BLINKS * 2 * BLINK_HALF_MS };
}
