import { createPrng } from "@/components/motion/engine/prng";

import { APPLE_SWING, APPLE_SWING_PERIOD_S, FOCAL, ROBOT_FADE_MS, ROBOT_SPEED, SPHERE_SPIN, SPHERE_TILT } from "./hero-config";
import type { Hands } from "./hands-data";
import type { Layout, Placement } from "./layout";
import { appleScale, appleProfile } from "./shapes";
import { easeInOutSine } from "./trajectory";

/**
 * The nanorobots (docs/design-system.md §2.11.4 ter D, E): small squares that follow a rail proper
 * to each phase — three inclined orbits around the sphere, two meridians and a parallel on the
 * apple, rails taken from the baked hands. Pure: a pose from the robot, the phase and the time.
 */
export type RobotKind = "sphere" | "apple" | "hands";

export type RobotPose = { x: number; y: number; z: number; alpha: number };

export const emptyPose = (): RobotPose => ({ x: 0, y: 0, z: 0, alpha: 0 });

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

/** Length of a polyline (normalised units). */
export function railLength(rail: readonly (readonly [number, number])[]): number {
  let length = 0;
  for (let k = 1; k < rail.length; k++) length += Math.hypot(rail[k]![0] - rail[k - 1]![0], rail[k]![1] - rail[k - 1]![1]);
  return length;
}

/** Point at the arc length `s` along a polyline (clamped), written into `out`. */
export function pointOnRail(rail: readonly (readonly [number, number])[], s: number, out: { x: number; y: number }): { x: number; y: number } {
  let left = Math.max(0, s);
  for (let k = 1; k < rail.length; k++) {
    const dx = rail[k]![0] - rail[k - 1]![0];
    const dy = rail[k]![1] - rail[k - 1]![1];
    const length = Math.hypot(dx, dy);
    if (left <= length || k === rail.length - 1) {
      const f = length === 0 ? 0 : Math.min(1, left / length);
      out.x = rail[k - 1]![0] + dx * f;
      out.y = rail[k - 1]![1] + dy * f;
      return out;
    }
    left -= length;
  }
  return out;
}

const scratch = { x: 0, y: 0 };

/** Seeded speed (px/s) and phase of one robot on the hands. */
function handsGait(index: number): { speed: number; phase: number } {
  const random = createPrng(77_000 + index * 31);
  return { speed: ROBOT_SPEED.min + random() * (ROBOT_SPEED.max - ROBOT_SPEED.min), phase: random() };
}

/**
 * A robot on the hands, in the living state: it travels its rail from the wrist (or the forearm)
 * to the tip (`inOutSine`), fades out in 300 ms at the end, then reappears at the origin.
 * `trail` (px behind it) is applied by the renderer.
 */
function handsRobot(index: number, seconds: number, hands: Hands, place: Placement, out: RobotPose, behind = 0): RobotPose {
  const rail = hands.rails[index % hands.rails.length]!;
  const length = railLength(rail);
  const pixels = length * place.sx;
  const { speed, phase } = handsGait(index);
  const travel = pixels / speed;
  const cycle = travel + 0.5;
  const t = (((seconds + phase * cycle) % cycle) + cycle) % cycle;
  const u = Math.min(1, t / travel);
  const fade = ROBOT_FADE_MS / 1000;
  const s = easeInOutSine(u) * length - behind / place.sx;
  pointOnRail(rail, s, scratch);
  out.x = place.cx + scratch.x * place.sx;
  out.y = place.cy + scratch.y * place.sy;
  out.z = 0;
  out.alpha = t <= travel ? Math.min(1, t / fade) : Math.max(0, 1 - (t - travel) / fade);
  return out;
}

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
};

/**
 * Pose of a robot on the rail of `kind`. `seconds` is the time of the steady phase for the
 * sphere and the apple (the rails turn with it), and the living time for the hands.
 */
export function robotPose(kind: RobotKind, index: number, seconds: number, yaw: number, context: RobotContext, out: RobotPose, behind = 0): RobotPose {
  if (kind === "sphere") return sphereRobot(index, context.count, seconds, context.layout.sphere, out);
  if (kind === "apple") return appleRobot(index, context.count, seconds, yaw, context.layout.apple, out);
  if (!context.hands) {
    out.alpha = 0;
    return out;
  }
  return handsRobot(index, seconds, context.hands, context.layout.hands, out, behind);
}
