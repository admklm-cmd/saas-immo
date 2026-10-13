import type { Hands } from "./hands-data";
import { BALL_ORBIT, type Tier } from "./hero-config";
import type { Layout } from "./layout";
import type { HandsLive } from "./live-motion";
import { emptyPose, restingRobot, robotPose, type RobotKind, type RobotPose } from "./robots";
import { BIRTH_MS, phaseDuration, type PhaseState, type TransitionKind } from "./timeline";
import { bezier, controlPoint, easeInOutCubic, progressOf } from "./trajectory";

/**
 * Poses of the nanorobots over the whole opening (docs/design-system.md T.2): a few of them orbit the
 * big sphere, three follow the ball into the hand, then migrate to the rails of the hands with the same
 * mechanism as a point (Bézier, delay, easing); the others are born at the wrists at the end. Pure; the
 * poses are written into preallocated objects.
 */
export type RobotInputs = {
  readonly layout: Layout;
  readonly hands: Hands | null;
  /** Per-point curvature of each transition (to-hand, to-hands). */
  readonly kappa: readonly Float32Array[];
  readonly tier: Tier;
  /** State of the living act (second animation), read by the robots of the hands. */
  readonly live: HandsLive;
};

const KINDS: Record<string, RobotKind | null> = { sphere: "sphere", hand: "ball", hands: "hands" };

/** The robots that are not carried by the ball are born at the wrists over this window of the last transition (ms). */
const BIRTH_FROM_MS = 1900;
const BIRTH_SPAN_MS = 300;
/** Seconds of the sphere phase and of the hand phase at their end. */
const SPHERE_END_S = 3.8;
const HAND_END_S = 1.6;

const from = emptyPose();
const to = emptyPose();
const control = { x: 0, y: 0 };

export function computeRobotPoses(poses: RobotPose[], state: PhaseState, sequenceMs: number, still: boolean, input: RobotInputs): void {
  const count = poses.length;
  for (const pose of poses) {
    pose.alpha = 0;
    pose.accent = false;
  }
  const { layout, hands, tier } = input;
  const context = { layout, hands, count: tier.sphereRobots, tier, live: input.live };
  if (still) {
    if (!hands) return;
    for (let i = 0; i < Math.min(count, 4); i++) restingRobot(i, hands, layout.hands, poses[i]!);
    return;
  }
  const carried = Math.min(BALL_ORBIT.robots, tier.sphereRobots);
  if (!state.transition) {
    const kind = KINDS[state.phase];
    if (!kind) return;
    if (kind === "sphere") {
      const fade = Math.min(1, sequenceMs / BIRTH_MS);
      for (let i = 0; i < tier.sphereRobots && i < count; i++) {
        robotPose("sphere", i, sequenceMs / 1000, context, poses[i]!);
        poses[i]!.alpha = fade;
      }
    } else if (kind === "ball") {
      for (let i = 0; i < carried; i++) robotPose("ball", i, (sequenceMs - 6600) / 1000, context, poses[i]!);
    } else {
      for (let i = 0; i < count; i++) robotPose("hands", i, input.live.actSec, context, poses[i]!);
    }
    return;
  }
  const kind = state.phase as TransitionKind;
  const duration = phaseDuration(kind);
  const spread = 0.4;
  const kappa = input.kappa[kind === "to-hand" ? 0 : 1]!;
  for (let i = 0; i < count; i++) {
    const pose = poses[i]!;
    if (kind === "to-hand") {
      if (i >= tier.sphereRobots) continue;
      robotPose("sphere", i, SPHERE_END_S, context, from);
      if (i >= carried) {
        // Robots the ball does not keep leave the picture where they are.
        pose.x = from.x;
        pose.y = from.y;
        pose.z = from.z;
        pose.alpha = 1 - easeInOutCubic(state.progress);
        continue;
      }
      robotPose("ball", i, 0, context, to);
      const rank = carried > 1 ? i / (carried - 1) : 0;
      const e = easeInOutCubic(progressOf(state.local, spread * duration * rank, duration, spread));
      controlPoint(from.x, from.y, to.x, to.y, kappa[i]!, control);
      pose.x = bezier(from.x, control.x, to.x, e);
      pose.y = bezier(from.y, control.y, to.y, e);
      pose.z = from.z + (to.z - from.z) * e;
      pose.alpha = 1;
      continue;
    }
    robotPose("hands", i, 0, context, to);
    if (i >= carried) {
      // Born at the end, on the rail of their role (the orbitals appear later with the act).
      pose.x = to.x;
      pose.y = to.y;
      pose.z = to.z;
      pose.alpha = to.alpha * Math.min(1, Math.max(0, (state.local - BIRTH_FROM_MS) / BIRTH_SPAN_MS));
      continue;
    }
    robotPose("ball", i, HAND_END_S, context, from);
    const rank = carried > 1 ? i / (carried - 1) : 0;
    const e = easeInOutCubic(progressOf(state.local, spread * duration * rank, duration, spread));
    controlPoint(from.x, from.y, to.x, to.y, kappa[i]!, control);
    pose.x = bezier(from.x, control.x, to.x, e);
    pose.y = bezier(from.y, control.y, to.y, e);
    pose.z = from.z + (to.z - from.z) * e;
    pose.alpha = 1 + (to.alpha - 1) * e;
  }
}
