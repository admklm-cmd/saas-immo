import { APPLE_SWING, APPLE_SWING_PERIOD_S, FOCAL, SPHERE_SPIN, SPHERE_TILT, resolveTier, type Tier } from "./hero-config";
import type { Hands } from "./hands-data";
import { handsRobotPose } from "./hands-robots";
import type { Layout, Placement } from "./layout";
import { createHandsLive, type HandsLive } from "./live-motion";
import { pointOnRail, railLength } from "./rails";
import { appleScale, appleProfile } from "./shapes";

/**
 * The nanorobots (docs/design-system.md §2.11.4 ter D, E): small squares that follow a rail proper
 * to each phase — three inclined orbits around the sphere, two meridians and a parallel on the
 * apple, rails taken from the baked hands. Pure: a pose from the robot, the phase and the time.
 */
export type RobotKind = "sphere" | "apple" | "hands";

/** `accent`: the robot carries the cobalt port (the message of the left messenger). */
export type RobotPose = { x: number; y: number; z: number; alpha: number; accent: boolean };

export const emptyPose = (): RobotPose => ({ x: 0, y: 0, z: 0, alpha: 0, accent: false });

/** Yaw of the sphere (rad) at a sequence time: spins in its phase, frozen before and after. */
export function sphereYawAt(sequenceMs: number): number {
  return SPHERE_SPIN * (Math.min(Math.max(sequenceMs, 3400), 4800) - 3400) / 1000;
}

/** Yaw of the apple (rad) at a sequence time: a slow sway of ± 14°, never a full turn. */
export function appleYawAt(sequenceMs: number): number {
  const local = (Math.min(Math.max(sequenceMs, 6800), 8200) - 6800) / 1000;
  return APPLE_SWING * Math.sin((2 * Math.PI * local) / APPLE_SWING_PERIOD_S);
}

const perspective = (z: number) => FOCAL / (FOCAL - z);

const ORBITS = [
  { incline: (20 * Math.PI) / 180, node: 0, omega: 1.0 },
  { incline: (-35 * Math.PI) / 180, node: (60 * Math.PI) / 180, omega: 0.9 },
  { incline: (70 * Math.PI) / 180, node: (120 * Math.PI) / 180, omega: 1.1 },
] as const;

const SPHERE_ORBIT_RADIUS = 0.54;

function sphereRobot(index: number, count: number, seconds: number, place: Placement, out: RobotPose): RobotPose {
  const orbit = ORBITS[index % ORBITS.length]!;
  const perOrbit = Math.ceil(count / ORBITS.length);
  const u = orbit.omega * seconds + (Math.floor(index / ORBITS.length) / perOrbit) * Math.PI * 2;
  let x = Math.cos(u) * SPHERE_ORBIT_RADIUS;
  let y = Math.sin(u) * SPHERE_ORBIT_RADIUS;
  let z = 0;
  // Incline around the x axis, then turn the node around the vertical axis.
  const y1 = y * Math.cos(orbit.incline) - z * Math.sin(orbit.incline);
  const z1 = y * Math.sin(orbit.incline) + z * Math.cos(orbit.incline);
  const x2 = x * Math.cos(orbit.node) + z1 * Math.sin(orbit.node);
  const z2 = -x * Math.sin(orbit.node) + z1 * Math.cos(orbit.node);
  // The fixed tilt of the sphere.
  const y3 = y1 * Math.cos(SPHERE_TILT) - z2 * Math.sin(SPHERE_TILT);
  const z3 = y1 * Math.sin(SPHERE_TILT) + z2 * Math.cos(SPHERE_TILT);
  x = x2;
  y = y3;
  z = z3;
  const s = perspective(z);
  out.x = place.cx + x * place.sx * s;
  out.y = place.cy + y * place.sy * s;
  out.z = z;
  out.alpha = 1;
  return out;
}

function appleRobot(index: number, count: number, seconds: number, yaw: number, place: Placement, out: RobotPose): RobotPose {
  const { scale, middle } = appleScale();
  const rail = index % 3;
  const turn = Math.floor(index / 3) / Math.max(1, Math.ceil(count / 3));
  let theta: number;
  let phi: number;
  if (rail === 2) {
    theta = Math.PI * 0.55;
    phi = seconds * 0.9 + turn * Math.PI * 2 + yaw;
  } else {
    theta = Math.PI * (0.5 + 0.46 * Math.sin(seconds * 0.8 + turn * Math.PI * 2));
    phi = Math.PI / 2 + (rail === 0 ? -0.9 : 0.9) + yaw;
  }
  const { rho, y } = appleProfile(theta);
  const lift = 1.04;
  const x = rho * Math.cos(phi) * scale * lift;
  const z = rho * Math.sin(phi) * scale * lift;
  const s = perspective(z);
  out.x = place.cx + x * place.sx * s;
  out.y = place.cy - (y - middle) * scale * place.sy * s;
  out.z = z;
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
  readonly count: number;
  /** Tier and state of the living act (the hands only; defaults: the desktop tier at the start of the act). */
  readonly tier?: Tier;
  readonly live?: HandsLive;
};

/**
 * Pose of a robot on the rail of `kind`. `seconds` is the time of the steady phase for the
 * sphere and the apple (the rails turn with it), and the living time for the hands (taken from `context.live`).
 */
export function robotPose(kind: RobotKind, index: number, seconds: number, yaw: number, context: RobotContext, out: RobotPose, behind = 0): RobotPose {
  if (kind === "sphere") return sphereRobot(index, context.count, seconds, context.layout.sphere, out);
  if (kind === "apple") return appleRobot(index, context.count, seconds, yaw, context.layout.apple, out);
  if (!context.hands) {
    out.alpha = 0;
    return out;
  }
  return handsRobotPose(index, context.hands, context.layout.hands, context.live ?? fallbackLive, context.tier ?? resolveTier(1440, false), out, behind);
}
