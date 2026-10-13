/**
 * Constants of the hero particle metamorphosis (docs/design-system.md §2.11.4 ter).
 * Every number the engine uses lives here: tune the look from this file, never in the loops.
 */

/** Frame budget: the point count drops 25 % (floor 40 %) when the mean frame cost exceeds this (ms, over 30 frames). */
export const ADAPTIVE = { budgetMs: 5, window: 30, step: 0.75, floor: 0.4 } as const;

export type Tier = {
  readonly name: "desktop" | "tablet" | "phone";
  /** Points of the sequence (never exceeded). */
  readonly points: number;
  readonly robots: number;
  /** Robot square, CSS px. */
  readonly robotSize: number;
  /** Cobalt contact square, CSS px. */
  readonly contactSize: number;
  /** Device pixel ratio cap. */
  readonly dprCap: number;
};

const TIERS: Record<Tier["name"], Tier> = {
  desktop: { name: "desktop", points: 14_000, robots: 14, robotSize: 6, contactSize: 4, dprCap: 1.5 },
  tablet: { name: "tablet", points: 9_000, robots: 10, robotSize: 6, contactSize: 3, dprCap: 1.5 },
  phone: { name: "phone", points: 3_600, robots: 6, robotSize: 5, contactSize: 3, dprCap: 1.25 },
};

/** Tier from the width of the stage (CSS px) and the pointer: a phone, or a coarse pointer, gets the light one. */
export function resolveTier(width: number, coarsePointer: boolean): Tier {
  if (coarsePointer || width < 768) return TIERS.phone;
  return width >= 1280 ? TIERS.desktop : TIERS.tablet;
}

/** Three depth planes, fixed per point identity (docs/design-system.md §2.11.4 ter D). */
export const PLANES = [
  { share: 0.2, size: 1.9, alpha: 0.78, speed: 1 },
  { share: 0.35, size: 1.4, alpha: 0.5, speed: 0.75 },
  { share: 0.45, size: 1, alpha: 0.22, speed: 0.5 },
] as const;
export const PLANE_COUNT = PLANES.length;

/** The hands are drawn this much stronger (share added to the opacity) than the ball and the apple. */
export const HANDS_EMPHASIS = 0.35;
/** ... and this much larger (share added to the point size). */
export const HANDS_GROWTH = 0.25;

/** Micro-movement amplitude (CSS px) of the plane 0 point in the living end state; the others scale with `speed`. */
export const LIVE_AMPLITUDE = 1.4;
/** Drift of the cloud (CSS px, period 7 s). */
export const CLOUD_DRIFT = 14;
export const CLOUD_DRIFT_PERIOD_S = 7;

/** Rotation of the sphere (rad/s) and its fixed tilt (rad); yaw swing of the apple (rad, period s). */
export const SPHERE_SPIN = 0.3;
export const SPHERE_TILT = (12 * Math.PI) / 180;
export const APPLE_SWING = (14 * Math.PI) / 180;
export const APPLE_SWING_PERIOD_S = 6;
/** Focal length of the soft perspective, in shape heights. */
export const FOCAL = 4;

/** Reference sizes of each shape in CSS px, by tier (docs/design-system.md §2.11.4 ter F, L). */
export const SHAPE_PX = {
  desktop: { sphere: 400, apple: 380 },
  tablet: { sphere: 340, apple: 320 },
  phone: { sphere: 260, apple: 250 },
} as const;

/** Hands: width of the baked frame (the source picture width) as a share of the stage width, per tier. */
export const HANDS_WIDTH_SHARE = { desktop: 0.98, tablet: 0.98, phone: 1.2 } as const;
/** Cap of the hands width (CSS px). */
export const HANDS_MAX_WIDTH = 1500;

/** Robots in the living end state: speed (CSS px/s), trail ghosts, end fade (ms). */
export const ROBOT_SPEED = { min: 38, max: 60 } as const;
export const ROBOT_TRAIL = [
  { gap: 8, alpha: 0.4 },
  { gap: 16, alpha: 0.2 },
  { gap: 24, alpha: 0.1 },
] as const;
export const ROBOT_FADE_MS = 300;
export const ROBOT_PORT = 2;

/** Pulse of the living end state (seconds): ring 1.6 s, bit 0.5 s later for 0.9 s, every 3.6 s. */
export const PULSE = { period: 3.6, ring: 1.6, ringFrom: 4, ringTo: 18, bitDelay: 0.5, bitDuration: 0.9 } as const;

/** The living end state is drawn every other frame. */
export const LIVE_FRAME_STEP = 2;

/** Seeds: one per stream, so a change in one shape never moves the others. */
export const SEEDS = { cloud: 20261012, plane: 20261013, apple: 20261014, curve: 20261015, micro: 20261016, wave: 20261017 } as const;

