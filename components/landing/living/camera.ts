/**
 * Camera of the neural network background (docs/design-system.md §2.11.4).
 *
 * The reference orbits continuously; here the pose is tied to the scroll
 * progress of the page (the gesture moves it, nothing turns at rest), plus an
 * optional small drift that goes and comes back during a sequence. Pure: the
 * time is a parameter, nothing allocates per frame.
 */

import type { ScreenClass } from "./network";

export type Pose = { yaw: number; pitch: number };

/** Yaw amplitude of the reference orbit (± rad). */
export const YAW_RANGE = 0.16;
/** Pitch arc of the reference orbit (rad). */
export const PITCH_ARC = 0.055;
/** Reduced motion: one fixed pose, independent of the scroll. */
export const REDUCED_POSE: Pose = Object.freeze({ yaw: 0, pitch: PITCH_ARC });
/** Exponential smoothing time constant (seconds). */
export const SMOOTHING_SECONDS = 0.25;
/**
 * Minimum approach speed (rad/s) added to the exponential: the camera lands
 * in a bounded time (≤ 0.95 s for the largest jump, 0.32 rad) instead of
 * creeping forever.
 */
export const MIN_APPROACH_SPEED = 0.03;
/** Below this gap (rad) the camera is posed: it snaps and the loop may stop. */
export const SETTLE_EPSILON = 0.0005;
/** Drift of the yaw during a sequence (rad); 0 = first fallback of §2.11.4. */
export const SEQUENCE_DRIFT = 0.012;
/** Perspective of the reference: 4.5 / (4.5 + depth). */
export const FOCAL = 4.5;

/** Pose for a scroll progress p ∈ [0, 1]: θ = π (p − 0.5), yaw = 0.16 sin θ, pitch = 0.055 cos θ. */
export function poseFromProgress(progress: number, out: Pose = { yaw: 0, pitch: 0 }): Pose {
  const p = Number.isFinite(progress) ? (progress < 0 ? 0 : progress > 1 ? 1 : progress) : 0.5;
  const theta = Math.PI * (p - 0.5);
  out.yaw = YAW_RANGE * Math.sin(theta);
  out.pitch = PITCH_ARC * Math.cos(theta);
  return out;
}

/** One smoothing step of an angle toward its target (`dt` in seconds). */
export function approach(current: number, target: number, dt: number): number {
  const gap = target - current;
  if (dt <= 0) return current;
  const remaining = Math.abs(gap) * Math.exp(-dt / SMOOTHING_SECONDS) - MIN_APPROACH_SPEED * dt;
  if (remaining <= SETTLE_EPSILON * 0.5) return target;
  return target - Math.sign(gap) * remaining;
}

/** Yaw added during a sequence: 0 at its start and at its end (the final pose never depends on it). */
export function sequenceDrift(elapsed: number, duration: number, amplitude = SEQUENCE_DRIFT): number {
  if (amplitude === 0 || duration <= 0 || elapsed <= 0 || elapsed >= duration) return 0;
  return amplitude * Math.sin((Math.PI * elapsed) / duration);
}

/** A ready-to-use projection (rotation terms and screen frame), mutated in place. */
export type Projector = {
  cosYaw: number;
  sinYaw: number;
  cosPitch: number;
  sinPitch: number;
  /** World unit → CSS px. */
  size: number;
  centerX: number;
  centerY: number;
};

export function createProjector(): Projector {
  return { cosYaw: 1, sinYaw: 0, cosPitch: 1, sinPitch: 0, size: 1, centerX: 0, centerY: 0 };
}

/** World scale of the reference: max(0.29 W, 0.43 H); compact: max(0.38 W, 0.30 H). */
export function worldSize(width: number, height: number, screenClass: ScreenClass): number {
  return screenClass === "compact" ? Math.max(width * 0.38, height * 0.3) : Math.max(width * 0.29, height * 0.43);
}

export function setProjector(
  projector: Projector,
  yaw: number,
  pitch: number,
  width: number,
  height: number,
  screenClass: ScreenClass,
): Projector {
  projector.cosYaw = Math.cos(yaw);
  projector.sinYaw = Math.sin(yaw);
  projector.cosPitch = Math.cos(pitch);
  projector.sinPitch = Math.sin(pitch);
  projector.size = worldSize(width, height, screenClass);
  projector.centerX = width * 0.5;
  projector.centerY = height * 0.46;
  return projector;
}

/**
 * Projects a world point (yaw, then pitch, then perspective) and writes
 * screen x, screen y, depth and perspective scale at `out[offset..offset+3]`.
 */
export function projectInto(
  projector: Projector,
  x: number,
  y: number,
  z: number,
  out: Float32Array | Float64Array,
  offset: number,
): void {
  const rx = x * projector.cosYaw + z * projector.sinYaw;
  const rz = -x * projector.sinYaw + z * projector.cosYaw;
  const ry = y * projector.cosPitch - rz * projector.sinPitch;
  const depth = y * projector.sinPitch + rz * projector.cosPitch;
  const scale = FOCAL / (FOCAL + depth);
  out[offset] = projector.centerX + rx * projector.size * scale;
  out[offset + 1] = projector.centerY + ry * projector.size * scale;
  out[offset + 2] = depth;
  out[offset + 3] = scale;
}

/** Proximity of the reference: 1 near the viewer, 0 far away. */
export function nearness(depth: number): number {
  const value = (1.55 - depth) / 2.1;
  return value < 0 ? 0 : value > 1 ? 1 : value;
}
