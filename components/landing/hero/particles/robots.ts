import { FOCAL, SPHERE, resolveTier, type Tier } from "./hero-config";
import type { Hands } from "./hands-data";
import { handsRobotPose } from "./hands-robots";
import type { Layout, Placement } from "./layout";
import { createHandsLive, type HandsLive } from "./live-motion";
import { pointOnRail, railLength } from "./rails";

/**
 * The nanorobots (docs/design-system.md §2.11.4 ter D, E; T.2): small squares that follow a rail
 * proper to its place — three inclined orbits around the big sphere,
 * rails taken from the baked hands. Pure: a pose from the robot and the time.
 */
export type RobotKind = "sphere" | "hands";

/** `accent`: the robot carries the cobalt port (the message of the left messenger). */
export type RobotPose = { x: number; y: number; z: number; alpha: number; accent: boolean; /** Drawn as a round bead travelling a rail (messenger or circulant), not as a square (U.6). */ bead: boolean };

export const emptyPose = (): RobotPose => ({ x: 0, y: 0, z: 0, alpha: 0, accent: false, bead: false });

const perspective = (z: number) => FOCAL / (FOCAL - z);

const ORBITS = [
  { incline: (20 * Math.PI) / 180, node: 0, omega: 0.5 },
  { incline: (-35 * Math.PI) / 180, node: (60 * Math.PI) / 180, omega: 0.5 },
  { incline: (70 * Math.PI) / 180, node: (120 * Math.PI) / 180, omega: 0.5 },
] as const;

/** Orbit radius on the surface of the sphere (the sphere has radius 0.5). */
const SPHERE_ORBIT_RADIUS = 0.5;

/** A robot on one of the three inclined orbits of the big sphere, `seconds` into the opening. */
function sphereRobot(index: number, count: number, seconds: number, place: Placement, out: RobotPose): RobotPose {
  const orbit = ORBITS[index % ORBITS.length]!;
  const perOrbit = Math.max(1, Math.ceil(count / ORBITS.length));
  const u = orbit.omega * seconds + (Math.floor(index / ORBITS.length) / perOrbit) * Math.PI * 2;
  const x = Math.cos(u) * SPHERE_ORBIT_RADIUS;
  const y = Math.sin(u) * SPHERE_ORBIT_RADIUS;
  // Incline around the x axis, then turn the node around the vertical axis.
  const y1 = y * Math.cos(orbit.incline);
  const z1 = y * Math.sin(orbit.incline);
  const x2 = x * Math.cos(orbit.node) + z1 * Math.sin(orbit.node);
  const z2 = -x * Math.sin(orbit.node) + z1 * Math.cos(orbit.node);
  // The fixed tilt of the sphere.
  const y3 = y1 * Math.cos(SPHERE.tilt) - z2 * Math.sin(SPHERE.tilt);
  const z3 = y1 * Math.sin(SPHERE.tilt) + z2 * Math.cos(SPHERE.tilt);
  const s = perspective(z3);
  out.x = place.cx + x2 * place.sx * s;
  out.y = place.cy + y3 * place.sy * s;
  out.z = z3;
  out.alpha = 1;
  return out;
}

const scratch = { x: 0, y: 0 };
const fallbackLive = createHandsLive();

/** Robots resting on the index fingers (reduced motion, pause): near the tip of the main rails. */
export function restingRobot(index: number, hands: Hands, place: Placement, out: RobotPose): RobotPose {
  const mains = [0, 4, 1, 5, 2, 6, 3, 7].filter((rail) => rail < hands.rails.length);
  const rail = hands.rails[mains[index % mains.length]!]!;
  const length = railLength(rail);
  pointOnRail(rail, length * (0.9 - 0.12 * Math.floor(index / mains.length)), scratch);
  out.x = place.cx + scratch.x * place.sx;
  out.y = place.cy + scratch.y * place.sy;
  out.z = 0;
  out.alpha = 1;
  return out;
}

export type RobotContext = {
  readonly layout: Layout;
  readonly hands: Hands | null;
  /** Robots on the big sphere (the others are not born yet). */
  readonly count: number;
  /** Tier and state of the living act (the hands only; defaults: the desktop tier at the start of the act). */
  readonly tier?: Tier;
  readonly live?: HandsLive;
  /** Clock of the beads on the rails (s): runs from the birth of the beads and on through the act; defaults to the act clock. */
  readonly railSec?: number;
};

/**
 * Pose of a robot on the rail of `kind`. `seconds` is the time of the steady phase for the sphere and
 * the ball (the rails turn with it), and the living time for the hands (taken from `context.live`).
 */
export function robotPose(kind: RobotKind, index: number, seconds: number, context: RobotContext, out: RobotPose, behind = 0): RobotPose {
  if (kind === "sphere") return sphereRobot(index, context.count, seconds, context.layout.sphere, out);
  if (!context.hands) {
    out.alpha = 0;
    return out;
  }
  return handsRobotPose(index, context.hands, context.layout.hands, context.live ?? fallbackLive, context.tier ?? resolveTier(1440, false), out, behind, context.railSec);
}
