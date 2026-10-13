import { createPrng } from "@/components/motion/engine/prng";

import { LIVE_CYCLE, MESSENGER, ORBIT, ROBOT_FADE_MS, ROBOT_SPEED, type Tier } from "./hero-config";
import type { Hands } from "./hands-data";
import type { Placement } from "./layout";
import { moveOnHands, type HandsLive } from "./live-motion";
import { pointOnRail, railLength } from "./rails";
import type { RobotPose } from "./robots";
import { easeInOutSine } from "./trajectory";

/**
 * The nanorobots of the second animation (docs/design-system.md §2.11.4 ter S.6). Three roles, told
 * by the index of the robot: two « messengers » (one per hand: they leave the wrist with the cycle
 * and reach the index tip at the end of the approach), the « circulants » that travel the rails
 * of the hands, and the « orbitals » around the contact point. Pure: a pose from the index and the
 * state of the living act.
 */
export type HandsRobotRole = "messenger" | "circulant" | "orbital" | "none";

/** Rails the circulants use, alternating the two hands. The messengers take the main rail of each hand (0 and 4). */
const CIRCULANT_RAILS = [1, 5, 2, 6, 3, 7, 0, 4] as const;
/** Rails of the messengers: the main rail of the left hand, then of the right hand. */
const MESSENGER_RAILS = [0, 4] as const;
/** The messenger stops this far (CSS px at 1440) behind the tip along its rail, so that it never covers the fingertip. */
const MESSENGER_STOP_PX = 12;

export function roleOf(index: number, tier: Tier): { role: HandsRobotRole; order: number } {
  if (index < 2) return { role: "messenger", order: index };
  if (index < 2 + tier.circulants) return { role: "circulant", order: index - 2 };
  if (index < 2 + tier.circulants + tier.orbitals) return { role: "orbital", order: index - 2 - tier.circulants };
  return { role: "none", order: 0 };
}

/** Seeded speed (px/s) and phase of one circulating robot. */
function gait(index: number): { speed: number; phase: number } {
  const random = createPrng(77_000 + index * 31);
  return { speed: ROBOT_SPEED.min + random() * (ROBOT_SPEED.max - ROBOT_SPEED.min), phase: random() };
}

const rail = { x: 0, y: 0 };
const moved = { x: 0, y: 0 };

/** Writes a position on a rail of the hands (arc length `s`, normalised units) moved with the hands. */
function placeOnRail(hands: Hands, place: Placement, live: HandsLive, railIndex: number, s: number, out: RobotPose): void {
  const path = hands.rails[railIndex % hands.rails.length]!;
  pointOnRail(path, s, rail);
  moveOnHands(live, hands, place, rail.x, rail.y, moved);
  out.x = moved.x;
  out.y = moved.y;
  out.z = 0;
}

function messenger(order: number, hands: Hands, place: Placement, live: HandsLive, tier: Tier, out: RobotPose, behind: number): RobotPose {
  const path = hands.rails[MESSENGER_RAILS[order]! % hands.rails.length]!;
  const length = railLength(path);
  const t = live.t;
  const stop = (MESSENGER_STOP_PX * tier.motionScale) / place.sx;
  const target = Math.max(0, length - stop);
  const u = t < LIVE_CYCLE.approach ? easeInOutSine(t / LIVE_CYCLE.approach) : t < MESSENGER.fadeIn ? 1 : 0;
  placeOnRail(hands, place, live, MESSENGER_RAILS[order]!, Math.max(0, u * target - behind / place.sx), out);
  const fade = ROBOT_FADE_MS / 1000;
  out.alpha = t < MESSENGER.fadeOut ? 1 : t < MESSENGER.fadeOut + fade ? 1 - (t - MESSENGER.fadeOut) / fade : t < MESSENGER.fadeIn ? 0 : (t - MESSENGER.fadeIn) / fade;
  return out;
}

function circulant(order: number, index: number, hands: Hands, place: Placement, live: HandsLive, out: RobotPose, behind: number): RobotPose {
  const railIndex = CIRCULANT_RAILS[order % CIRCULANT_RAILS.length]!;
  const path = hands.rails[railIndex % hands.rails.length]!;
  const length = railLength(path);
  const { speed, phase } = gait(index);
  const travel = (length * place.sx) / speed;
  const fade = ROBOT_FADE_MS / 1000;
  const cycle = travel + fade;
  const t = (((live.actSec + phase * cycle) % cycle) + cycle) % cycle;
  placeOnRail(hands, place, live, railIndex, Math.max(0, easeInOutSine(Math.min(1, t / travel)) * length - behind / place.sx), out);
  out.alpha = t < fade ? t / fade : t <= travel ? 1 : Math.max(0, 1 - (t - travel) / fade);
  return out;
}

function orbital(order: number, place: Placement, live: HandsLive, tier: Tier, out: RobotPose): RobotPose {
  const total = Math.max(1, tier.orbitals);
  const direction = order % 2 === 0 ? 1 : -1;
  const angle = (order / total) * Math.PI * 2 + (direction * 2 * Math.PI * live.actSec) / ORBIT.period;
  const tighten = 1 - (1 - ORBIT.tight) * live.s;
  const a = ORBIT.a * tier.motionScale * tighten;
  const b = ORBIT.b * tier.motionScale * tighten;
  const ex = a * Math.cos(angle);
  const ey = b * Math.sin(angle);
  const cos = Math.cos(ORBIT.tilt);
  const sin = Math.sin(ORBIT.tilt);
  // Before the first update the middle of the gap is the origin of the hands.
  const cx = live.contactX || place.cx;
  const cy = live.contactY || place.cy;
  out.x = cx + ex * cos - ey * sin;
  out.y = cy + ex * sin + ey * cos;
  out.z = 0;
  out.alpha = Math.min(1, Math.max(0, (live.actSec - ORBIT.bornAt) / ORBIT.bornFade));
  return out;
}

/** Pose of the robot `index` of the hands at the current state of the living act; `behind` px back along its rail (trail ghosts). */
export function handsRobotPose(index: number, hands: Hands, place: Placement, live: HandsLive, tier: Tier, out: RobotPose, behind = 0): RobotPose {
  out.accent = false;
  const { role, order } = roleOf(index, tier);
  if (role === "messenger") {
    messenger(order, hands, place, live, tier, out, behind);
    out.accent = order === 0 && (live.t < LIVE_CYCLE.approach || live.t >= MESSENGER.fadeIn);
    return out;
  }
  if (role === "circulant") return circulant(order, index, hands, place, live, out, behind);
  if (role === "orbital") return orbital(order, place, live, tier, out);
  out.alpha = 0;
  return out;
}
