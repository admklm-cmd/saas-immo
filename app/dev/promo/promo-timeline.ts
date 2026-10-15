import { PROMO_TEXTS } from "./promo-texts";

/**
 * Timeline of the promo video (docs/motion/promo-2026-10.md §4). Pure: every function takes the
 * time `tMs` of the film and nothing else, so two calls with the same time give the same result.
 */
export const DURATION_MS = 33_000;
export const DEFAULT_FPS = 30;

export const T = {
  // plan 1
  title1TypeFrom: 700,
  title1TypeMs: 36,
  title1EraseFrom: 4300,
  title1EraseMs: 14,
  loseFrom: 2400,
  loseTo: 4000,
  loseMs: 900,
  pullFrom: 4000,
  // plan 2
  gatherFrom: 4500,
  gatherDelayMs: 900,
  gatherDurationMs: 1900,
  title2TypeFrom: 5900,
  title2TypeMs: 36,
  title2EraseFrom: 8500,
  flattenFrom: 8600,
  flattenDelayMs: 250,
  flattenDurationMs: 650,
  sweepFrom: 8800,
  sweepTo: 9500,
  // plan 3
  dossierBornFrom: 9700,
  freezeFrom: 14_000,
  freezeMs: 250,
  // plan 4
  humanPointAt: 15_000,
  ringMs: 900,
  barrierOpenFrom: 17_300,
  barrierOpenMs: 400,
  mandateNoteAt: 20_100,
  sweepBackFrom: 20_400,
  sweepBackTo: 21_000,
  // plan 5
  windowFrom: 20_700,
  curveFrom: 22_000,
  curveTo: 23_800,
  figuresFrom: 23_000,
  figuresTo: 24_200,
  dissolveFrom: 25_400,
  // plan 6
  handsFrom: 26_000,
  handsDelayMs: 700,
  handsDurationMs: 1700,
  handsFormed: 28_400,
  approachFrom: 29_000,
  contactAt: 29_700,
  contactDotMs: 300,
  logoFrom: 30_100,
  logoMs: 600,
} as const;

// ---------------------------------------------------------------------------------------------
// Easing: cubic-bezier solved numerically (no rebound anywhere in the film).
// ---------------------------------------------------------------------------------------------
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (u: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (s: number) => ((ax * s + bx) * s + cx) * s;
  const sampleY = (s: number) => ((ay * s + by) * s + cy) * s;
  return (u) => {
    if (u <= 0) return 0;
    if (u >= 1) return 1;
    let lo = 0;
    let hi = 1;
    let s = u;
    for (let k = 0; k < 28; k++) {
      const x = sampleX(s);
      if (Math.abs(x - u) < 1e-6) break;
      if (x < u) lo = s;
      else hi = s;
      s = (lo + hi) / 2;
    }
    return sampleY(s);
  };
}

export const easeOut = cubicBezier(0.22, 1, 0.36, 1);
export const easeInOut = cubicBezier(0.65, 0, 0.35, 1);
export const easeIn = cubicBezier(0.55, 0, 1, 0.45);

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
/** 0 before `from`, 1 after `to`, linear in between. */
export const progress = (t: number, from: number, to: number): number => clamp01((t - from) / (to - from));
export const lerp = (a: number, b: number, e: number): number => a + (b - a) * e;

// ---------------------------------------------------------------------------------------------
// Typing
// ---------------------------------------------------------------------------------------------
/** Characters typed at `t` for a text typed from `from` at `msPerChar`. */
export function typedCount(t: number, from: number, msPerChar: number, length: number): number {
  if (t < from) return 0;
  return Math.min(length, Math.floor((t - from) / msPerChar) + 1);
}

/** Title 1 is typed, held, then erased by backspace; returns the number of visible characters. */
export function title1Chars(t: number): number {
  const length = PROMO_TEXTS.title1.length;
  if (t < T.title1EraseFrom) return typedCount(t, T.title1TypeFrom, T.title1TypeMs, length);
  const erased = Math.floor((t - T.title1EraseFrom) / T.title1EraseMs) + 1;
  return Math.max(0, length - erased);
}

/** Title 2 is typed, held, then erased the same way before the rail takes over. */
export function title2Chars(t: number): number {
  const length = PROMO_TEXTS.title2.length;
  if (t < T.title2EraseFrom) return typedCount(t, T.title2TypeFrom, T.title2TypeMs, length);
  const erased = Math.floor((t - T.title2EraseFrom) / T.title1EraseMs) + 1;
  return Math.max(0, length - erased);
}

// ---------------------------------------------------------------------------------------------
// Terminal lines (docs §4 plans 3 and 4)
// ---------------------------------------------------------------------------------------------
export type TerminalLine = { id: string; text: string; from: number; msPerChar: number; kind: "machine" | "human" | "log" };

export const TERMINAL_LINES: readonly TerminalLine[] = [
  { id: "lea", text: PROMO_TEXTS.terminal.lea, from: 10_400, msPerChar: 24, kind: "machine" },
  { id: "hugo", text: PROMO_TEXTS.terminal.hugo, from: 11_600, msPerChar: 24, kind: "machine" },
  { id: "emma", text: PROMO_TEXTS.terminal.emma, from: 12_800, msPerChar: 24, kind: "machine" },
  { id: "human", text: PROMO_TEXTS.terminal.human, from: 15_700, msPerChar: 52, kind: "human" },
  { id: "log", text: PROMO_TEXTS.terminal.log, from: 17_500, msPerChar: 24, kind: "log" },
  { id: "louis", text: PROMO_TEXTS.terminal.louis, from: 18_300, msPerChar: 24, kind: "machine" },
  { id: "sarah", text: PROMO_TEXTS.terminal.sarah, from: 19_100, msPerChar: 24, kind: "machine" },
];
export const TERMINAL_VISIBLE_LINES = 3;
/** The terminal fades out just before the sweep back. */
export const TERMINAL_OUT = { from: 20_300, to: 20_500 } as const;
/** The terminal appears with the first line. */
export const TERMINAL_IN_FROM = 10_200;

export type TerminalView = { line: TerminalLine; chars: number }[];

/** The (at most 3) most recent lines started at `t`, with their typed length. */
export function terminalView(t: number): TerminalView {
  const started = TERMINAL_LINES.filter((line) => t >= line.from);
  return started.slice(-TERMINAL_VISIBLE_LINES).map((line) => ({ line, chars: typedCount(t, line.from, line.msPerChar, line.text.length) }));
}

/** True while a character is being typed (solid cursor); false when the cursor blinks alone. */
export function isTyping(t: number): boolean {
  return TERMINAL_LINES.some((line) => t >= line.from && t < line.from + line.text.length * line.msPerChar + 120);
}

/** Cursor blink: 530 ms on, 530 ms off. */
export function blinkOn(t: number): boolean {
  return Math.floor(t / 530) % 2 === 0;
}

// ---------------------------------------------------------------------------------------------
// Dossier along the rail (station index, linear speed between stations)
// ---------------------------------------------------------------------------------------------
export const STATION_IDS = ["lea", "hugo", "emma", "human", "louis", "sarah", "mandate"] as const;
export type StationId = (typeof STATION_IDS)[number];

/** Where the dossier waits in front of the barrier (station index). */
export const WAIT_STATION = 2.88;

/** Keyframes [time, station position]; linear in between, so the speed is constant per stretch. */
export const DOSSIER_KEYS: readonly (readonly [number, number])[] = [
  [T.dossierBornFrom, -0.35],
  [10_300, 0],
  [11_500, 1],
  [12_700, 2],
  [13_900, WAIT_STATION],
  [T.barrierOpenFrom, WAIT_STATION],
  [18_200, 4],
  [19_100, 5],
  [20_000, 5.88],
];

/** Station position of the dossier at `t` (0 = Léa, 3 = barrier...). */
export function dossierStation(t: number): number {
  const first = DOSSIER_KEYS[0]!;
  if (t <= first[0]) return first[1];
  for (let k = 1; k < DOSSIER_KEYS.length; k++) {
    const [t1, s1] = DOSSIER_KEYS[k]!;
    const [t0, s0] = DOSSIER_KEYS[k - 1]!;
    if (t <= t1) return lerp(s0, s1, (t - t0) / (t1 - t0));
  }
  return DOSSIER_KEYS[DOSSIER_KEYS.length - 1]![1];
}

/** Time the dossier reaches a station (for the light-up of its icon). */
export const STATION_ARRIVAL: Record<StationId, number> = { lea: 10_300, hugo: 11_500, emma: 12_700, human: 13_900, louis: 18_200, sarah: 19_100, mandate: 20_000 };

// ---------------------------------------------------------------------------------------------
// Sweeps (background and point tint change with a 300 px front, not a global fade)
// ---------------------------------------------------------------------------------------------
export const SWEEP_FRONT_PX = 300;

/** Leading edge of the front along the sweep axis (length `length`), from 0 to length + front. */
export function sweepEdge(t: number, from: number, to: number, length: number): number {
  return easeInOut(progress(t, from, to)) * (length + SWEEP_FRONT_PX);
}

/** Share of the new tint of a point at axis coordinate `a` once the front is at `edge`. */
export function sweepTint(a: number, edge: number): number {
  return clamp01((edge - a) / SWEEP_FRONT_PX);
}

// ---------------------------------------------------------------------------------------------
// Readability table (criterion 5): every text is fully shown at least words / 3 + 0.5 s.
// ---------------------------------------------------------------------------------------------
export type TextBeat = { id: string; words: number; fullFrom: number; fullTo: number };

const wordsOf = (text: string): number => text.trim().split(/\s+/).length;

export const MAIN4_FROM = 15_700;
export const MAIN4_STAGGER_MS = 90;
export const MAIN4_WORD_MS = 360;
export const MAIN4_OUT = { from: 20_300, to: 20_500 } as const;
export const TITLE5_IN = { from: 23_500, to: 24_000 } as const;
export const TITLE5_OUT = { from: 25_900, to: 26_100 } as const;
export const SIGNATURE_LINES = [{ from: 30_100, to: 30_400 }, { from: 30_200, to: 30_500 }] as const;

export const TEXT_BEATS: readonly TextBeat[] = [
  { id: "title1", words: wordsOf(PROMO_TEXTS.title1), fullFrom: T.title1TypeFrom + PROMO_TEXTS.title1.length * T.title1TypeMs, fullTo: T.title1EraseFrom },
  { id: "title2", words: wordsOf(PROMO_TEXTS.title2), fullFrom: T.title2TypeFrom + PROMO_TEXTS.title2.length * T.title2TypeMs, fullTo: T.title2EraseFrom },
  {
    id: "main4",
    words: wordsOf(PROMO_TEXTS.main4),
    fullFrom: MAIN4_FROM + (wordsOf(PROMO_TEXTS.main4) - 1) * MAIN4_STAGGER_MS + MAIN4_WORD_MS,
    fullTo: MAIN4_OUT.from,
  },
  { id: "title5", words: wordsOf(PROMO_TEXTS.title5), fullFrom: TITLE5_IN.to, fullTo: TITLE5_OUT.from },
  {
    id: "signature",
    words: wordsOf(`${PROMO_TEXTS.signatureName} ${PROMO_TEXTS.signatureLine}`),
    fullFrom: SIGNATURE_LINES[1].to,
    fullTo: DURATION_MS,
  },
];

export const requiredReadingMs = (words: number): number => (words / 3 + 0.5) * 1000;

// ---------------------------------------------------------------------------------------------
// Frame times
// ---------------------------------------------------------------------------------------------
export function frameTimeMs(index: number, fps: number): number {
  return Math.round((index * 1000) / fps);
}
export function frameCount(fps: number): number {
  return Math.round((DURATION_MS * fps) / 1000);
}
