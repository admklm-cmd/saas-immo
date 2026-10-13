import type { Hands } from "./hands-data";
import type { Tier } from "./hero-config";
import type { Layout } from "./layout";
import type { HandsLive } from "./live-motion";
import { appleYawAt, emptyPose, restingRobot, robotPose, type RobotKind, type RobotPose } from "./robots";
import type { Shape } from "./shapes";
import { phaseDuration, type Phase, type PhaseState, type TransitionKind } from "./timeline";
import { WAVE_SPREAD, bezier, controlPoint, easeInOutCubic, progressOf } from "./trajectory";

/**
 * Poses of the nanorobots over the whole sequence (docs/design-system.md §2.11.4 ter D): a rail
 * per steady phase, and in a transition the same mechanism as a point (Bézier, delay, easing)
 * from the rail of the previous phase to the rail of the next, so the robots migrate with the
 * cloud. Pure; the poses are written into preallocated objects.
 */
export type RobotInputs = {
  readonly layout: Layout;
  readonly hands: Hands | null;
  /** The cloud shape (a robot is born where its own point is). */
  readonly cloud: Shape;
  /** Per-point curvature of each transition (to-sphere, to-apple, to-hands). */
  readonly kappa: readonly Float32Array[];
  readonly tier: Tier;
  /** State of the living act (second animation), read by the robots of the hands. */
  readonly live: HandsLive;
};

const KINDS: Record<Phase, RobotKind | null> = { cloud: null, "to-sphere": null, sphere: "sphere", "to-apple": null, apple: "apple", "to-hands": null, hands: "hands" };
/** Seconds of the sphere and apple phases at their end (1.4 s each). */
const STEADY_END_S = 1.4;

const from = emptyPose();
const to = emptyPose();
const control = { x: 0, y: 0 };

export function computeRobotPoses(poses: RobotPose[], state: PhaseState, sequenceMs: number, liveSec: number, still: boolean, input: RobotInputs): void {
  const count = poses.length;
  for (const pose of poses) {
    pose.alpha = 0;
    pose.accent = false;
  }
  const { layout, hands } = input;
  const context = { layout, hands, count, tier: input.tier, live: input.live };
  if (still) {
    if (!hands) return;
    for (let i = 0; i < Math.min(count, 4); i++) restingRobot(i, hands, layout.hands, poses[i]!);
    return;
  }
  if (!state.transition) {
    const kind = KINDS[state.phase];
    if (!kind) return;
    const seconds = kind === "sphere" ? (sequenceMs - 3400) / 1000 : kind === "apple" ? (sequenceMs - 6800) / 1000 : input.live.actSec;
    const yaw = kind === "apple" ? appleYawAt(sequenceMs) : 0;
    for (let i = 0; i < count; i++) robotPose(kind, i, seconds, yaw, context, poses[i]!);
    return;
  }
  const kind = state.phase as TransitionKind;
  const duration = phaseDuration(kind);
  const spread = WAVE_SPREAD[kind];
  const fromKind: RobotKind | null = kind === "to-sphere" ? null : kind === "to-apple" ? "sphere" : "apple";
  const toKind: RobotKind = kind === "to-sphere" ? "sphere" : kind === "to-apple" ? "apple" : "hands";
  const kappa = input.kappa[kind === "to-sphere" ? 0 : kind === "to-apple" ? 1 : 2]!;
  for (let i = 0; i < count; i++) {
    const rank = count > 1 ? i / (count - 1) : 0;
    const e = easeInOutCubic(progressOf(state.local, spread * duration * rank, duration, spread));
    robotPose(toKind, i, 0, 0, context, to);
    let ax: number;
    let ay: number;
    let az = 0;
    if (fromKind) {
      robotPose(fromKind, i, STEADY_END_S, fromKind === "apple" ? appleYawAt(8200) : 0, context, from);
      ax = from.x;
      ay = from.y;
      az = from.z;
    } else {
      ax = layout.cloud.cx + input.cloud.x[i]! * layout.cloud.sx;
      ay = layout.cloud.cy + input.cloud.y[i]! * layout.cloud.sy;
    }
    controlPoint(ax, ay, to.x, to.y, kappa[i]!, control);
    const pose = poses[i]!;
    pose.x = bezier(ax, control.x, to.x, e);
    pose.y = bezier(ay, control.y, to.y, e);
    pose.z = az + (to.z - az) * e;
    // Arriving on the hands, a robot takes the opacity of its role at the start of the living act (the orbitals are born later).
    pose.alpha = toKind === "hands" ? 1 + (to.alpha - 1) * e : fromKind ? 1 : e;
    pose.accent = false;
  }
}
