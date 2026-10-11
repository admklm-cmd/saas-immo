/**
 * The nanorobots of the hero (docs/design-system.md §2.11.4 bis C), drawn
 * once from a fixed seed: the server HTML and the client render the very
 * same positions (no hydration jitter, no `Math.random`).
 *
 * Two populations in one layer: 48 ambient robots (32 on a phone) that drift
 * slowly, and 8 pairs of actors (4 on a phone) that exchange a bit.
 */

export const AMBIENT_COUNT = 48;
export const AMBIENT_COUNT_COMPACT = 32;
export const PAIR_COUNT = 8;
export const PAIR_COUNT_COMPACT = 4;

/** Linear congruential generator (same constants as the former page-wide field). */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

export type AmbientShape = "dot" | "chip" | "ring";

export type AmbientRobot = {
  /** Position in % of the layer. */
  readonly left: number;
  readonly top: number;
  /** Side or diameter, px. */
  readonly size: number;
  readonly opacity: number;
  /** Drift amplitude, px (6 to 22). */
  readonly driftX: number;
  readonly driftY: number;
  /** ms, 7 000 to 14 000. */
  readonly duration: number;
  /** ms, 0 to 2 000. */
  readonly delay: number;
  readonly shape: AmbientShape;
  /** Beyond the 32 kept on a phone. */
  readonly compactHidden: boolean;
};

export type Point = { readonly x: number; readonly y: number };

export type PairSeed = {
  /** 1 to 8. */
  readonly id: number;
  /** Meeting point M, % of the `hero-stage` layer (≥ 768 px). */
  readonly anchor: Point;
  /** Meeting point on a phone, % of the free space above the terminal (pairs 1 to 4). */
  readonly compactAnchor: Point | null;
  /** Angle of the pair, degrees, in [−35, +35]: the wires stay nearly horizontal. */
  readonly theta: number;
  /** Where the rest distance sits in its range, 0 to 1. */
  readonly spread: number;
};

const ANCHORS: readonly Point[] = [
  { x: 9, y: 18 },
  { x: 91, y: 14 },
  { x: 16, y: 46 },
  { x: 84, y: 40 },
  { x: 7, y: 74 },
  { x: 93, y: 70 },
  { x: 12, y: 94 },
  { x: 88, y: 94 },
];

const COMPACT_ANCHORS: readonly Point[] = [
  { x: 20, y: 30 },
  { x: 80, y: 30 },
  { x: 30, y: 75 },
  { x: 70, y: 75 },
];

function ambientRobots(): AmbientRobot[] {
  const random = seededRandom(0x51a9d);
  return Array.from({ length: AMBIENT_COUNT }, (_, index) => {
    const shape: AmbientShape = index % 9 === 0 ? "ring" : index % 5 === 0 ? "chip" : "dot";
    const left = 4 + random() * 92;
    const top = 6 + random() * 88;
    const unit = random();
    const size = shape === "ring" ? 4 + unit : shape === "chip" ? 2 + unit * 2 : 1.4 + unit * 2.2;
    const opacityUnit = random();
    const opacity = shape === "ring" ? 0.25 + opacityUnit * 0.25 : 0.2 + opacityUnit * 0.4;
    return {
      left,
      top,
      size,
      opacity,
      driftX: 6 + random() * 16,
      driftY: 6 + random() * 16,
      duration: 7_000 + random() * 7_000,
      delay: random() * 2_000,
      shape,
      compactHidden: index >= AMBIENT_COUNT_COMPACT,
    };
  });
}

function pairSeeds(): PairSeed[] {
  const random = seededRandom(0xb17e5);
  return ANCHORS.map((anchor, index) => ({
    id: index + 1,
    anchor,
    compactAnchor: COMPACT_ANCHORS[index] ?? null,
    theta: -35 + random() * 70,
    spread: random(),
  }));
}

export const AMBIENT_ROBOTS: readonly AmbientRobot[] = ambientRobots();
export const PAIR_SEEDS: readonly PairSeed[] = pairSeeds();
/** Pairs drawn linked in the still composition (server HTML, reduced motion). */
export const STILL_LINKED_PAIRS: readonly number[] = [3, 4];
