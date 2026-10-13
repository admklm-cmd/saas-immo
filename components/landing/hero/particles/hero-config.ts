/**
 * Constants of the hero particle metamorphosis (docs/design-system.md §2.11.4 ter).
 * Every number the engine uses lives here: tune the look from this file, never in the loops.
 */

/** Frame budget: the point count drops 25 % (floor 40 %) when the mean frame cost exceeds this (ms, over 30 frames). */
export const ADAPTIVE = { budgetMs: 5, window: 30, step: 0.75, floor: 0.4 } as const;

export type Tier = {
  readonly name: "desktop" | "tablet" | "phone";
  /** Identities of the sequence: the points of the hands, never exceeded (the hands are made of them). */
  readonly points: number;
  /** « Skin » points of the opening only (docs/design-system.md T.3): they make the big sphere full, then fade out. */
  readonly skin: number;
  /** Robots on the big sphere, then (3 at most) around the held ball. */
  readonly sphereRobots: number;
  /** Size multiplier of the points of the opening (the sphere is large: 1.25 on a computer, 1 on a phone). */
  readonly sphereGrowth: number;
  /** Robots of the whole scene: circulants + the 2 messengers + orbitals on the hands. */
  readonly robots: number;
  /** Robot square on the sphere and the ball, CSS px. */
  readonly robotSize: number;
  /** Robot square on the hands (circulating and messenger robots), CSS px. */
  readonly handsRobotSize: number;
  /** Orbiting robot square around the contact point, CSS px. */
  readonly orbitSize: number;
  /** Robots circulating on the rails of the hands, and robots orbiting the contact point (the 2 messengers come on top). */
  readonly circulants: number;
  readonly orbitals: number;
  /** Cobalt contact square, CSS px. */
  readonly contactSize: number;
  /** Device pixel ratio cap. */
  readonly dprCap: number;
  /** Scale of the amplitudes of the second animation (breathing, orbit, ring): 1 at 1440, 0.55 at 1024, 0.3 at 390. */
  readonly motionScale: number;
  /** The living act is drawn every `liveFrameStep` frames (1 = 60 frames/s; falls back to 2 above `LIVE_WORK_BUDGET_MS`). */
  readonly liveFrameStep: number;
};

const TIERS: Record<Tier["name"], Tier> = {
  desktop: { name: "desktop", points: 14_000, skin: 12_000, sphereRobots: 6, sphereGrowth: 1.25, robots: 14, robotSize: 6, handsRobotSize: 9, orbitSize: 7, circulants: 8, orbitals: 4, contactSize: 4, dprCap: 1.5, motionScale: 1, liveFrameStep: 1 },
  tablet: { name: "tablet", points: 9_000, skin: 6_000, sphereRobots: 4, sphereGrowth: 1.25, robots: 12, robotSize: 6, handsRobotSize: 8, orbitSize: 6, circulants: 6, orbitals: 4, contactSize: 3, dprCap: 1.5, motionScale: 0.55, liveFrameStep: 1 },
  phone: { name: "phone", points: 3_600, skin: 1_800, sphereRobots: 3, sphereGrowth: 1, robots: 8, robotSize: 5, handsRobotSize: 7, orbitSize: 5, circulants: 4, orbitals: 2, contactSize: 3, dprCap: 1.25, motionScale: 0.3, liveFrameStep: 2 },
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
export const HANDS_EMPHASIS = 0.5;
/** ... and this much larger (share added to the point size), the size being capped (CSS px). */
export const HANDS_GROWTH = 0.4;
export const HANDS_POINT_MAX = 2.6;

/** Micro-movement amplitude (CSS px) of the plane 0 point in the living end state; the others scale with `LIVE_PLANE_SPEED`. */
export const LIVE_AMPLITUDE = 1.8;
/** Share of `LIVE_AMPLITUDE` by plane: 1.8 px for the near plane, 0.6 px for the far one (§2.11.4 ter S.4). */
export const LIVE_PLANE_SPEED = [1, 0.67, 0.33] as const;
/**
 * The big sphere of the opening (docs/design-system.md T.2, T.3): it turns slowly around the vertical
 * axis (the equator a little faster than the poles, like a smoke), leans by 16°, and its surface breathes.
 * `pole`: share of the points in the two polar caps (denser poles), `cap`: half-angle of a cap.
 */
export const SPHERE = {
  spin: 0.22,
  tilt: (16 * Math.PI) / 180,
  differential: 0.3,
  breath: 0.035,
  pole: 0.08,
  cap: (16 * Math.PI) / 180,
  /** Birth: the sphere swells from 60 % of its radius over this many ms, each point late by up to `birthSpread` ms. */
  birthMs: 800,
  birthSpread: 400,
  birthFrom: 0.6,
  /** Share of the visible height of the first screen the sphere fills (≈ 818 px at 1440 × 900). */
  fit: 0.98,
} as const;

/** Opacity multiplier of the points of the big sphere (it reads as a full ball). */
export const SPHERE_OPACITY = 1.6;

/**
 * The ball the left hand holds (docs/design-system.md T.2): units of the hands (width of the source picture),
 * origin = the middle between the two index tips, y down. Starting values, tuned by eye on captures.
 */
export const BALL_AT = { x: -0.14, y: -0.05 } as const;
export const BALL_RADIUS_SHARE = 0.07;
/** The left hand steps back by this share of the width of the hands while it holds the ball. */
export const HOLD_SHIFT = 0.06;
/** Ball: spin (rad/s), share of the points on its surface (the others fill its volume), spread of the volume (share of the radius). */
export const BALL_SPIN = 0.7;
export const BALL_SURFACE_SHARE = 0.65;
export const BALL_VOLUME_SPREAD = 0.38;
/** Smallest diameter of the ball on a phone (CSS px). */
export const BALL_MIN_PX = 72;
/** The skin points leave the picture over the last share of their trip to the ball. */
export const SKIN_FADE_SHARE = 0.45;

/** Quiet zone in front of the texts (docs/design-system.md T.3): grow (sides, top and bottom), ring, opacity by level. */
export const QUIET = { growX: 32, growY: 20, ring: 24, inside: 0.25, around: 0.6 } as const;

/** Robots around the held ball: ellipse (shares of the ball radius), turn speed (rad/s). */
export const BALL_ORBIT = { a: 1.25, b: 0.5, omega: 0.9, robots: 3 } as const;
/** Focal length of the soft perspective, in shape heights. */
export const FOCAL = 4;

/** Hands: width of the baked frame (the source picture width) as a share of the stage width, per tier. */
export const HANDS_WIDTH_SHARE = { desktop: 0.92, tablet: 0.92, phone: 1.1 } as const;
/** Cap of the hands width (CSS px). */
export const HANDS_MAX_WIDTH = 1500;

/** Circulating robots of the hands: speed (CSS px/s), trail ghosts (5, 10 px apart), fade at both ends (ms). */
export const ROBOT_SPEED = { min: 90, max: 140 } as const;
export const ROBOT_TRAIL = [
  { gap: 10, alpha: 0.5 },
  { gap: 20, alpha: 0.35 },
  { gap: 30, alpha: 0.25 },
  { gap: 40, alpha: 0.15 },
  { gap: 50, alpha: 0.08 },
] as const;
export const ROBOT_FADE_MS = 300;
export const ROBOT_PORT = 3;
export const ORBIT_PORT = 2;

/**
 * The second animation (docs/design-system.md §2.11.4 ter S.3): « les index qui veulent se toucher ».
 * Cycle of 7.2 s: approach 2.6 s, almost touching 0.8 s, retreat 2.2 s, rest 1.6 s.
 */
export const LIVE_CYCLE = { period: 7.2, approach: 2.6, contact: 0.8, retreat: 2.2, rest: 1.6 } as const;
/** Gap between the two index tips at the nearest point, as a share of the width of the hands; never below `MIN_TIP_GAP_PX`. */
export const CONTACT_GAP_SHARE = 0.01;
export const MIN_TIP_GAP_PX = 3;
/** Tremor of the tips while they almost touch (px on the gap, period s). */
export const TREMOR = { amplitude: 0.5, period: 0.8 } as const;
/** Share of the horizontal move a finger also makes vertically, towards the other tip (the tips are at different heights: they meet on a diagonal). */
export const TIP_CLIMB = 0.5;
/** Spread of the finger weight and of the hand weight, as a share of the width of the hands. */
export const FINGER_SPREAD = 0.07;
export const HAND_SPREAD = 0.32;
/** Weight of the hand (not the finger) in the move: the forearm hardly follows. */
export const HAND_FOLLOW = 0.35;
/** Breathing of each hand: vertical swing (px at 1440), scale around the wrist, period s, offset of the right hand, ramp-in s. */
export const BREATH = { amplitude: 3, scale: 0.003, period: 7.2, phase: Math.PI / 2, ramp: 1.2 } as const;

/** Messenger robots (one per hand): leave the wrist at the start of the cycle, reach the tip at the end of the approach. */
export const MESSENGER = { fadeOut: 3.4, fadeIn: 6.9, bitStart: 2.7, bitDuration: 0.5 } as const;
/** Orbiting robots: ellipse (px at 1440), tilt, period s, born at this live time (s), tightening at contact. */
export const ORBIT = { a: 24, b: 10, tilt: (20 * Math.PI) / 180, period: 5, bornAt: 0.3, bornFade: 0.6, tight: 0.6 } as const;
/** The ring that follows the bit: starts when the bit has crossed; radius from/to (px at 1440) over `duration` s. */
export const RING = { start: 3.2, duration: 1.2, from: 4, to: 22 } as const;
/** The cobalt contact square swells by this factor while the tips almost touch (one pulse). */
export const CONTACT_SWELL = 1.5;
/** Work (ms, 75th percentile) above which the living act falls back to 30 frames/s. */
export const LIVE_WORK_BUDGET_MS = 4;

/** Seeds: one per stream, so a change in one shape never moves the others. */
export const SEEDS = { sphere: 20261012, plane: 20261013, ball: 20261014, curve: 20261015, micro: 20261016, wave: 20261017, skin: 20261018 } as const;
