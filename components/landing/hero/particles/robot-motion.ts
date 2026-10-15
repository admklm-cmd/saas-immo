import type { Hands } from "./hands-data";
import { BEADS_AT_MS, BEADS_FADE_IN_MS, type Tier } from "./hero-config";
import type { Layout } from "./layout";
import type { HandsLive } from "./live-motion";
import { restingRobot, robotPose, type RobotPose } from "./robots";
import { BIRTH_MS, SEQUENCE_END_MS } from "./timeline";

/**
 * Poses of the nanorobots over the whole opening (docs/design-system.md T.2, U.4, U.6). One clock, no phase:
 * a few squares orbit the big sphere while it turns and leave with it (they fade out as the sphere empties
 * into the hands); from `BEADS_AT_MS` the beads are born on the rails of the hands and run on, at a constant
 * speed, through the act (their clock does not restart at the act: no jump). The orbitals of the contact
 * point appear with the act. Pure; the poses are written into preallocated objects.
 */
export type RobotInputs = {
  readonly layout: Layout;
  readonly hands: Hands | null;
  readonly tier: Tier;
  /** State of the living act (second animation), read by the robots of the hands. */
  readonly live: HandsLive;
};

/** The sphere robots fade out over this window (ms of the sequence): the sphere is emptying into the hands. */
const SPHERE_LEAVE_FROM_MS = 3000;
const SPHERE_LEAVE_TO_MS = 6000;
/** Seconds the rails clock is ahead of the act clock at the start of the act (the beads were born 2.2 s earlier). */
const RAIL_LEAD_S = (SEQUENCE_END_MS - BEADS_AT_MS) / 1000;

/** Clock (s) of the beads on the rails: from their birth, then on through the act without a restart. */
export function railClock(sequenceMs: number, live: HandsLive): number {
  return sequenceMs < SEQUENCE_END_MS ? Math.max(0, (sequenceMs - BEADS_AT_MS) / 1000) : live.actSec + RAIL_LEAD_S;
}

export function computeRobotPoses(poses: RobotPose[], sequenceMs: number, still: boolean, input: RobotInputs): void {
  const count = poses.length;
  for (const pose of poses) {
    pose.alpha = 0;
    pose.accent = false;
    pose.bead = false;
  }
  const { layout, hands, tier, live } = input;
  if (still) {
    if (!hands) return;
    for (let i = 0; i < Math.min(count, 4); i++) restingRobot(i, hands, layout.hands, poses[i]!);
    return;
  }
  const railSec = railClock(sequenceMs, live);
  const context = { layout, hands, count: tier.sphereRobots, tier, live, railSec };
  const born = Math.min(1, Math.max(0, (sequenceMs - BEADS_AT_MS) / BEADS_FADE_IN_MS));
  for (let i = 0; i < count; i++) {
    const pose = poses[i]!;
    if (sequenceMs >= BEADS_AT_MS) {
      if (!hands) continue;
      robotPose("hands", i, 0, context, pose);
      if (pose.bead) pose.alpha *= born;
      continue;
    }
    if (i >= tier.sphereRobots || sequenceMs >= SPHERE_LEAVE_TO_MS) continue;
    robotPose("sphere", i, sequenceMs / 1000, context, pose);
    const birth = Math.min(1, sequenceMs / BIRTH_MS);
    const leave = 1 - Math.min(1, Math.max(0, (sequenceMs - SPHERE_LEAVE_FROM_MS) / (SPHERE_LEAVE_TO_MS - SPHERE_LEAVE_FROM_MS)));
    pose.alpha = birth * leave;
  }
}
