/**
 * Data of the « problem » illustration of the landing: mandates progress, the
 * administrative work absorbs the time, progression plateaus.
 *
 * Pure module (no DOM, no React): the geometry of the curve, the fictitious
 * administrative events that weigh on it, the explicit mapping between the
 * causes written next to the chart and those events, and the timing of the
 * appearance sequence. No figure is ever drawn: the shapes are an illustration,
 * not a measure.
 */

/** Kinds of administrative events drawn on the chart (labels in landing-texts). */
export const PROBLEM_EVENT_KINDS = ["relance", "dossier", "document", "doublon", "suivi", "validation"] as const;
export type ProblemEventKind = (typeof PROBLEM_EVENT_KINDS)[number];

/** Causes written next to the chart (titles and bodies in landing-texts). */
export const PROBLEM_CAUSES = ["relances", "dossiers", "doublons", "suivi"] as const;
export type ProblemCause = (typeof PROBLEM_CAUSES)[number];

/**
 * Cause → the events it produces on the chart. Every event kind belongs to
 * exactly one cause (checked by problem-scene.test.ts):
 * - manual follow-ups produce « Relance »;
 * - scattered files produce « Dossier » and « Document »;
 * - duplicates between advisers produce « Doublon »;
 * - a saturated follow-up produces « Suivi » and « Validation » (every open
 *   file waits for a call back, an answer, a validation).
 */
export const CAUSE_EVENTS: Record<ProblemCause, readonly ProblemEventKind[]> = {
  relances: ["relance"],
  dossiers: ["dossier", "document"],
  doublons: ["doublon"],
  suivi: ["suivi", "validation"],
};

export function causeOfEvent(kind: ProblemEventKind): ProblemCause {
  for (const cause of PROBLEM_CAUSES) {
    if (CAUSE_EVENTS[cause].includes(kind)) return cause;
  }
  // Unreachable while CAUSE_EVENTS covers every kind (tested).
  return "suivi";
}

export function isProblemCause(value: string | undefined | null): value is ProblemCause {
  return (PROBLEM_CAUSES as readonly string[]).includes(value ?? "");
}

/* --- Geometry, in viewBox units ------------------------------------------ */

/** Proportions close to the column of the causes at 1440 px: the scene fills it. */
export const VIEW = { width: 720, height: 540 } as const;
const PAD_X = 20;
const BASE_Y = 516;
/** Height reached by the plateau above the base. */
const RISE = 262;
/** Logistic shape: steady progression, then a ceiling. */
const STEEPNESS = 8.5;
const MIDPOINT = 0.38;
/** Where the curve starts to lose the capacity it should have kept (share of time). */
export const FRICTION_START = 0.46;
/** Vertical distance, at the end of time, between the expected progression and the plateau. */
const ABSORBED_AT_END = 250;
const GAP_EXPONENT = 1.25;
/** Early events sit just under the curve, before the friction starts. */
const EARLY_OFFSET = 18;

const logistic = (t: number) => 1 / (1 + Math.exp(-STEEPNESS * (t - MIDPOINT)));
const L0 = logistic(0);
const L1 = logistic(1);

/** Mandates (0..1) along time (0..1): a shape, never a measure. */
export function mandates(t: number): number {
  return (logistic(t) - L0) / (L1 - L0);
}

export function xAt(t: number): number {
  return PAD_X + t * (VIEW.width - PAD_X * 2);
}

export function curveY(t: number): number {
  return BASE_Y - mandates(t) * RISE;
}

/** Capacity absorbed by the administrative work at time t (viewBox units, ≥ 0). */
export function absorbedAt(t: number): number {
  if (t <= FRICTION_START) return 0;
  return ABSORBED_AT_END * ((t - FRICTION_START) / (1 - FRICTION_START)) ** GAP_EXPONENT;
}

/** The progression the agency would have kept without the friction. */
export function expectedY(t: number): number {
  return curveY(t) - absorbedAt(t);
}

const round = (value: number) => Math.round(value * 10) / 10;

function polyline(from: number, to: number, y: (t: number) => number, samples: number): string[] {
  const parts: string[] = [];
  for (let index = 0; index <= samples; index++) {
    const t = from + ((to - from) * index) / samples;
    parts.push(`${round(xAt(t))} ${round(y(t))}`);
  }
  return parts;
}

/** The real curve: progresses, then plateaus. */
export const CURVE_PATH = `M${polyline(0, 1, curveY, 72).join(" L")}`;
/** Area under the curve, down to the base. */
export const AREA_PATH = `${CURVE_PATH} L${round(xAt(1))} ${BASE_Y} L${round(xAt(0))} ${BASE_Y} Z`;
/** Expected progression, drawn from the start of the friction. */
export const EXPECTED_PATH = `M${polyline(FRICTION_START, 1, expectedY, 36).join(" L")}`;
/** Friction zone: between the expected progression and the real curve. */
export const FRICTION_PATH = `${EXPECTED_PATH} L${polyline(FRICTION_START, 1, curveY, 36).reverse().join(" L")} Z`;

/** The measure of the absorbed capacity, at the right edge. */
export const CAPACITY_MARKER = {
  x: round(xAt(1)),
  y1: round(curveY(1)),
  y2: round(expectedY(1)),
} as const;

export const BASE_LINE_Y = BASE_Y;

/* --- Events ---------------------------------------------------------------- */

/**
 * When the word of an event is shown. Exactly one event per kind carries its
 * word, and every word sits at the same place: just under the curve, below
 * its event (the area under the curve is kept free of events for that).
 * - `rest`: always shown;
 * - `wide`: shown at rest from the tablet width on (room for a third word);
 * - `cause`: shown only while its cause is highlighted. The link between a
 *   cause and its words is also written under each cause: the highlight never
 *   carries the information on its own.
 */
export type ProblemEventLabel = "rest" | "wide" | "cause";

export type ProblemEvent = {
  id: string;
  kind: ProblemEventKind;
  /** Share of time (0..1). */
  t: number;
  /**
   * Inside the friction zone: share of the absorbed capacity (0 = on the
   * curve, 1 = on the expected progression). Ignored for the early events
   * (t ≤ FRICTION_START), which sit just under the curve, discreet.
   */
  depth: number;
  label?: ProblemEventLabel;
};

/**
 * Fictitious administrative events: two early ones, discreet, then the
 * friction zone fills up, denser and denser towards the right while the curve
 * slows down. Every later event stays inside the friction zone (tested).
 */
export const PROBLEM_EVENTS: readonly ProblemEvent[] = [
  { id: "e01", kind: "relance", t: 0.3, depth: 0 },
  { id: "e02", kind: "dossier", t: 0.4, depth: 0 },
  { id: "e03", kind: "dossier", t: 0.6, depth: 0.5, label: "cause" },
  { id: "e04", kind: "relance", t: 0.64, depth: 0.42, label: "rest" },
  { id: "e05", kind: "relance", t: 0.655, depth: 0.88 },
  { id: "e06", kind: "document", t: 0.686, depth: 0.6 },
  { id: "e07", kind: "validation", t: 0.7, depth: 0.3, label: "cause" },
  { id: "e08", kind: "validation", t: 0.72, depth: 0.8 },
  { id: "e09", kind: "dossier", t: 0.743, depth: 0.55 },
  { id: "e10", kind: "doublon", t: 0.762, depth: 0.2 },
  { id: "e11", kind: "doublon", t: 0.78, depth: 0.66, label: "wide" },
  { id: "e12", kind: "relance", t: 0.795, depth: 0.34 },
  { id: "e13", kind: "suivi", t: 0.81, depth: 0.9 },
  { id: "e14", kind: "dossier", t: 0.826, depth: 0.5 },
  { id: "e15", kind: "validation", t: 0.844, depth: 0.78 },
  { id: "e16", kind: "suivi", t: 0.858, depth: 0.28 },
  { id: "e17", kind: "relance", t: 0.87, depth: 0.64 },
  { id: "e18", kind: "document", t: 0.882, depth: 0.42, label: "cause" },
  { id: "e19", kind: "document", t: 0.895, depth: 0.86 },
  { id: "e20", kind: "validation", t: 0.906, depth: 0.22 },
  { id: "e21", kind: "dossier", t: 0.918, depth: 0.6 },
  { id: "e22", kind: "doublon", t: 0.93, depth: 0.16 },
  { id: "e23", kind: "suivi", t: 0.942, depth: 0.44, label: "rest" },
  { id: "e24", kind: "relance", t: 0.952, depth: 0.76 },
  { id: "e25", kind: "suivi", t: 0.963, depth: 0.26 },
  { id: "e26", kind: "dossier", t: 0.972, depth: 0.92 },
  { id: "e27", kind: "validation", t: 0.981, depth: 0.56 },
  { id: "e28", kind: "suivi", t: 0.99, depth: 0.2 },
];

export function isEarlyEvent(event: ProblemEvent): boolean {
  return event.t <= FRICTION_START;
}

export function eventPoint(event: ProblemEvent): { x: number; y: number; anchorY: number } {
  const anchorY = curveY(event.t);
  const y = isEarlyEvent(event) ? anchorY + EARLY_OFFSET : anchorY - event.depth * absorbedAt(event.t);
  return { x: round(xAt(event.t)), y: round(y), anchorY: round(anchorY) };
}

/**
 * The words of the events share one lane under the curve: a single baseline,
 * each word right below its event and linked to it by a hairline. The lane
 * is low enough for the words never to touch the curve (the first labelled
 * event is at t = 0.6 and a word spans at most ±0.11 of time on a phone).
 */
export const LABEL_LANE_Y = round(curveY(0.49));

/** Words near the right edge extend only to the left of their event. */
export function labelAlign(event: ProblemEvent): "center" | "end" {
  return event.t > 0.9 ? "end" : "center";
}

export function labelPoint(event: ProblemEvent): { x: number; y: number } {
  return { x: round(xAt(event.t)), y: LABEL_LANE_Y };
}

/* --- Timing of the appearance sequence (ms, from the Reveal entering) ---- */

/** The curve draws itself slowly. */
export const CURVE_DELAY_MS = 300;
export const CURVE_DURATION_MS = 2800;
/** Events arrive after the curve passed them, and keep accumulating. */
const EVENTS_SPREAD_MS = 3000;
export const EVENT_DURATION_MS = 520;
/** The friction zone, the expected progression and the capacity measure close the story. */
export const FRICTION_DELAY_MS = CURVE_DELAY_MS + CURVE_DURATION_MS + 400;
export const CAPACITY_DELAY_MS = FRICTION_DELAY_MS + 900;

export function eventDelayMs(event: ProblemEvent): number {
  const first = PROBLEM_EVENTS[0]?.t ?? 0;
  const share = (event.t - first) / (1 - first);
  return Math.round(CURVE_DELAY_MS + CURVE_DURATION_MS * event.t + EVENTS_SPREAD_MS * share * share * 0.5);
}

/** A cause appears next to the chart with the first event it produces. */
export function causeDelayMs(cause: ProblemCause): number {
  const kinds = CAUSE_EVENTS[cause];
  const first = PROBLEM_EVENTS.find((event) => kinds.includes(event.kind));
  return first ? eventDelayMs(first) : CURVE_DELAY_MS;
}
