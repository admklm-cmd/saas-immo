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
  /** Robots on the big sphere (they leave with it). */
  readonly sphereRobots: number;
  /** Size multiplier of the points of the opening (the sphere is large: 1.25 on a computer, 1 on a phone). */
  readonly sphereGrowth: number;
  /**
   * Beads travelling the rails of the hands (U.6): the 2 messengers + the circulants. Tiny round pearls (`beadSize`, CSS px),
   * a share of them cobalt (`railCobalt`), at a constant speed (`railSpeed`, px/s), with a fine trail (`beadTrail`).
   */
  readonly railDots: number;
  readonly railCobalt: number;
  readonly beadSize: number;
  readonly railSpeed: { readonly min: number; readonly max: number };
  readonly beadTrail: { readonly ghosts: number; readonly gap: number };
  /** Cobalt marks allowed on the canvas at once (beads + contact point + ring + bit), U.6. */
  readonly cobaltCap: number;
  /** Robots of the whole scene: circulants + the 2 messengers + orbitals on the hands. */
  readonly robots: number;
  /** Robot square on the sphere, CSS px. */
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
  /** Multiplier of the point size of the planes (a phone draws larger hands on a small screen: 2.1 / 1.5 / 1.1 px, U.7). */
  readonly pointScale: number;
  /** Scale of the amplitudes of the second animation (breathing, orbit, ring): 1 at 1440, 0.55 at 1024, 0.55 at 390 (the hands are two windows wide there, U.7). */
  readonly motionScale: number;
  /** The living act is drawn every `liveFrameStep` frames (1 = 60 frames/s; falls back to 2 above `LIVE_WORK_BUDGET_MS`). */
  readonly liveFrameStep: number;
};

/** Number of beads on the rails, as a multiple of the tier value (docs/design-system.md U.6): 1 = designed, 0 = no bead at all. */
export const RAIL_DOTS = 1;

const TIERS: Record<Tier["name"], Tier> = {
  desktop: { name: "desktop", points: 14_000, skin: 12_000, sphereRobots: 6, sphereGrowth: 1.25, railDots: 24, railCobalt: 8, beadSize: 3, railSpeed: { min: 90, max: 150 }, beadTrail: { ghosts: 5, gap: 8 }, cobaltCap: 12, robots: 28, robotSize: 6, handsRobotSize: 9, orbitSize: 7, circulants: 22, orbitals: 4, contactSize: 4, dprCap: 1.5, pointScale: 1, motionScale: 1, liveFrameStep: 1 },
  tablet: { name: "tablet", points: 9_000, skin: 6_000, sphereRobots: 4, sphereGrowth: 1.25, railDots: 16, railCobalt: 5, beadSize: 2.6, railSpeed: { min: 80, max: 130 }, beadTrail: { ghosts: 4, gap: 7 }, cobaltCap: 8, robots: 20, robotSize: 6, handsRobotSize: 8, orbitSize: 6, circulants: 14, orbitals: 4, contactSize: 3, dprCap: 1.5, pointScale: 1, motionScale: 0.55, liveFrameStep: 1 },
  phone: { name: "phone", points: 4_200, skin: 1_800, sphereRobots: 3, sphereGrowth: 1, railDots: 10, railCobalt: 3, beadSize: 2.4, railSpeed: { min: 60, max: 100 }, beadTrail: { ghosts: 3, gap: 6 }, cobaltCap: 6, robots: 12, robotSize: 5, handsRobotSize: 7, orbitSize: 5, circulants: 8, orbitals: 2, contactSize: 3, dprCap: 1.25, pointScale: 1.1, motionScale: 0.55, liveFrameStep: 2 },
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

/** The hands are drawn this much stronger (share added to the opacity) than the sphere. */
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
  /** Speed (rad/s) the rotation reaches by 5 s and keeps: it never stops (U.4). */
  spinTo: 0.45,
  tilt: (16 * Math.PI) / 180,
  differential: 0.3,
  breath: 0.035,
  /** The breath of the surface fades to 0 between these times (ms): the sphere is emptying into the hands. */
  breathFadeFromMs: 3000,
  breathFadeToMs: 9600,
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
 * The « held ball » step (docs/design-system.md U.5): a hand cupped around a ball needs an illustration the
 * data do not have (`hands.baked.json` holds two outstretched hands, index fingers pointing). It stays off: the sphere,
 * always turning, becomes the two hands directly. The future `held` shape (baked from `held-hand.png` with
 * `scripts/bake-hero-hands.mjs --config … --out held`) is wired in `HeroScene.setHands`/`compute` as a first wave
 * (sphere → held hand and ball) overlapping the second one (U.4); nothing of it is loaded while this flag is false.
 */
export const HELD_ENABLED = false;

/** Quiet zone in front of the texts (docs/design-system.md T.3): grow (sides, top and bottom), ring, opacity by level. */
export const QUIET = { growX: 32, growY: 20, ring: 24, inside: 0.25, around: 0.6 } as const;

/** Focal length of the soft perspective, in shape heights. */
export const FOCAL = 4;

/** Hands: width of the baked frame (the source picture width) as a share of the stage width, per tier. On a phone the frame is two windows wide, centred between the index tips and cropped by the edges (U.7). */
export const HANDS_WIDTH_SHARE = { desktop: 0.92, tablet: 0.92, phone: 2 } as const;
/** Cap of the hands width (CSS px). */
export const HANDS_MAX_WIDTH = 1500;

/** Beads of the rails: fade at both ends (ms) and trail ghosts (diameter and opacity from the nearest to the farthest, U.6). */
export const BEAD_TRAIL = { diameter: [2.4, 1.2], alpha: [0.45, 0.08] } as const;
/** Hairline of a white bead (ink at 45 %, CSS px). */
export const BEAD_RING = { width: 0.8, alpha: 0.45 } as const;
/** The beads are born (and may be cobalt) from this sequence time (ms), U.4 / U.6. */
export const BEADS_AT_MS = 8400;
export const BEADS_FADE_IN_MS = 300;
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
