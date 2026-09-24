/**
 * Scenes of the landing "living background": one per section of the page.
 *
 * The background is an ILLUSTRATION (fictitious example, simulation). It never
 * reads any real state. It tells one story: request received → qualification →
 * follow-up → human validation → appointment → follow-up → mandate, and each
 * section of the landing shows one facet of it.
 *
 * Coordinates are normalised to the viewport (0..1). Every layout keeps the
 * path away from the text column of its section; what falls behind a card is
 * partly hidden on purpose.
 */

export const LIVING_SCENES = ["hero", "probleme", "solution", "agents", "controle", "resultat", "final"] as const;
export type LivingScene = (typeof LIVING_SCENES)[number];

export function isLivingScene(value: string | undefined | null): value is LivingScene {
  return (LIVING_SCENES as readonly string[]).includes(value ?? "");
}

/** Stops of the path: entry, Léa, Hugo, Emma, human gate, Louis, Sarah, mandate. */
export const STOP_COUNT = 8;
export const ENTRY_STOP = 0;
export const GATE_STOP = 4;
export const GOAL_STOP = 7;
/** Stop index → agent index (0 = Léa … 4 = Sarah), or -1 for the other stops. */
export const STOP_AGENT = [-1, 0, 1, 2, -1, 3, 4, -1] as const;

export type Point = readonly [number, number];

export type SceneSpec = {
  /** 8 stops, desktop and tablet (≥ 768 px). */
  wide: readonly Point[];
  /** 8 stops, mobile: a quiet column along the right edge. */
  compact: readonly Point[];
  /** Seconds between two fictitious files entering the path (per lane). */
  period: number;
  /** Parallel clean paths drawn at once (result section). */
  lanes: number;
  /** Distance between two lanes, CSS px. */
  laneGap: number;
  /** Share of files stopped by a guard rail (drawn as a halted impulse). */
  blockRate: number;
  /** Share of files lost mid-way without explanation (problem section only). */
  lostRate: number;
  /** Share of files duplicated by a second entry (problem section only). */
  duplicateRate: number;
  /** Wandering of the stops, CSS px (problem section only). */
  scatter: number;
  /** Links drawn with gaps: the path is interrupted. */
  broken: boolean;
  /** Seconds a file waits in front of the human validation. */
  gateHold: number;
  /** Agents light up one after another. */
  spotlight: boolean;
  /** Stops appear and connect one after another when the scene starts. */
  build: boolean;
  /** Ambient prospects drift towards the entry (false: they wander). */
  inflow: boolean;
};

const BASE: SceneSpec = {
  wide: [],
  compact: [],
  period: 3.2,
  lanes: 1,
  laneGap: 0,
  blockRate: 0.14,
  lostRate: 0,
  duplicateRate: 0,
  scatter: 0,
  broken: false,
  gateHold: 1.8,
  spotlight: false,
  build: false,
  inflow: true,
};

/** Mobile: one discreet column on the right edge, below the header. */
const COMPACT_COLUMN: readonly Point[] = [
  [0.95, 0.99],
  [0.9, 0.9],
  [0.95, 0.8],
  [0.9, 0.7],
  [0.95, 0.6],
  [0.9, 0.5],
  [0.95, 0.4],
  [0.9, 0.3],
];

export const SCENES: Record<LivingScene, SceneSpec> = {
  // The five agents appear and connect around the demonstration card.
  hero: {
    ...BASE,
    wide: [
      [0.47, 0.99],
      [0.56, 0.93],
      [0.7, 0.965],
      [0.86, 0.93],
      [0.965, 0.72],
      [0.965, 0.44],
      [0.9, 0.16],
      [0.72, 0.13],
    ],
    compact: COMPACT_COLUMN,
    build: true,
  },
  // Scattered signals, duplicates, interrupted paths.
  probleme: {
    ...BASE,
    wide: [
      [0.56, 0.5],
      [0.64, 0.22],
      [0.79, 0.4],
      [0.69, 0.62],
      [0.9, 0.24],
      [0.85, 0.68],
      [0.95, 0.47],
      [0.74, 0.84],
    ],
    compact: [
      [0.93, 0.95],
      [0.86, 0.82],
      [0.96, 0.74],
      [0.88, 0.6],
      [0.96, 0.5],
      [0.87, 0.42],
      [0.95, 0.3],
      [0.9, 0.2],
    ],
    period: 1.7,
    blockRate: 0,
    lostRate: 0.45,
    duplicateRate: 0.35,
    scatter: 14,
    broken: true,
    gateHold: 0.4,
    inflow: false,
  },
  // The same flow, reorganised: one clean curve.
  solution: {
    ...BASE,
    wide: [
      [0.54, 0.52],
      [0.6, 0.36],
      [0.67, 0.24],
      [0.74, 0.2],
      [0.8, 0.24],
      [0.86, 0.34],
      [0.92, 0.44],
      [0.965, 0.52],
    ],
    compact: COMPACT_COLUMN,
    period: 2.8,
    blockRate: 0.08,
  },
  // Agents activate one after another, in the empty space under the sticky title.
  agents: {
    ...BASE,
    wide: [
      [0.04, 0.99],
      [0.08, 0.88],
      [0.16, 0.8],
      [0.24, 0.88],
      [0.31, 0.78],
      [0.37, 0.88],
      [0.43, 0.77],
      [0.47, 0.92],
    ],
    compact: COMPACT_COLUMN,
    period: 3.6,
    blockRate: 0.1,
    spotlight: true,
  },
  // Every file stops in front of the human validation, then resumes.
  controle: {
    ...BASE,
    wide: [
      [0.52, 0.42],
      [0.58, 0.3],
      [0.66, 0.24],
      [0.74, 0.28],
      [0.8, 0.36],
      [0.86, 0.28],
      [0.92, 0.22],
      [0.97, 0.3],
    ],
    compact: COMPACT_COLUMN,
    period: 3,
    blockRate: 0.2,
    gateHold: 3.4,
  },
  // Several clean paths at the same time.
  resultat: {
    ...BASE,
    wide: [
      [0.53, 0.2],
      [0.6, 0.26],
      [0.67, 0.22],
      [0.74, 0.28],
      [0.8, 0.24],
      [0.86, 0.3],
      [0.92, 0.26],
      [0.975, 0.32],
    ],
    compact: COMPACT_COLUMN,
    period: 3.4,
    lanes: 3,
    laneGap: 26,
    blockRate: 0.06,
    gateHold: 1.2,
  },
  // Everything converges into one point, next to the final call to action.
  final: {
    ...BASE,
    wide: [
      [0.58, 0.18],
      [0.93, 0.26],
      [0.94, 0.72],
      [0.64, 0.8],
      [0.62, 0.42],
      [0.86, 0.38],
      [0.84, 0.6],
      [0.76, 0.5],
    ],
    compact: [
      [0.95, 0.3],
      [0.84, 0.4],
      [0.95, 0.52],
      [0.84, 0.64],
      [0.95, 0.74],
      [0.86, 0.84],
      [0.95, 0.9],
      [0.9, 0.97],
    ],
    period: 2.6,
    blockRate: 0.05,
    gateHold: 1.4,
  },
};
