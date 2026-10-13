import type { HoldPairing } from "./hold-pairing";
import type { Layout } from "./layout";
import type { SphereField } from "./sphere-field";
import { SPHERE_END_MS } from "./sphere-field";
import type { Shape } from "./shapes";
import { phaseDuration } from "./timeline";
import { controlPoint, delayOf } from "./trajectory";
import { BALL_SPIN } from "./hero-config";

/**
 * The two transitions of the opening that need the pairing (docs/design-system.md T.2): the sphere → the
 * left hand holding the ball (`to-hand`), then the ball → the right hand while the left hand steps forward
 * (`to-hands`). Built once per geometry, outside the frame loop: start, end and Bézier control of every point,
 * and its delay in the wave.
 */
export type HoldTransition = {
  readonly ax: Float32Array;
  readonly ay: Float32Array;
  readonly az: Float32Array;
  readonly bx: Float32Array;
  readonly by: Float32Array;
  readonly bz: Float32Array;
  readonly cx: Float32Array;
  readonly cy: Float32Array;
  readonly delay: Float32Array;
  readonly ampB: Float32Array;
};

const makeTransition = (n: number): HoldTransition => {
  const make = () => new Float32Array(n);
  return { ax: make(), ay: make(), az: make(), bx: make(), by: make(), bz: make(), cx: make(), cy: make(), delay: make(), ampB: make() };
};

/** Start of the held phase and its end (ms of the sequence). */
const HAND_START_MS = 6600;
const HAND_END_MS = 8200;

/** Yaw of the held ball (rad) at a sequence time: spins in its phase, frozen before and after. */
export function ballYawAt(sequenceMs: number): number {
  return (BALL_SPIN * (Math.min(Math.max(sequenceMs, HAND_START_MS), HAND_END_MS) - HAND_START_MS)) / 1000;
}

/** The held ball at a spin angle: points `from`..`to` into `x`, `y`, `z` (`skip` marks the ones the ball does not own). */
export function ballFrame(yaw: number, ball: Layout["ball"], shape: Shape, offset: number, from: number, to: number, x: Float32Array, y: Float32Array, z: Float32Array, skip: Uint8Array | null): void {
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  for (let i = from; i < to; i++) {
    if (skip && skip[i]) continue;
    const k = i - offset;
    const nx = shape.x[k]!;
    const nz = shape.z[k]!;
    x[i] = ball.cx + ball.r * (nx * cosY + nz * sinY);
    y[i] = ball.cy + ball.r * shape.y[k]!;
    // Depth in sphere units: the far side of the ball is paler.
    z[i] = (-nx * sinY + nz * cosY) * 0.5;
  }
}

export type HoldPlan = {
  readonly toHand: HoldTransition;
  readonly toHands: HoldTransition;
  /** Final place of each identity (the hands). */
  readonly hand: { readonly x: Float32Array; readonly y: Float32Array; readonly z: Float32Array };
  /** Place of each identity while the hand holds the ball, ball excluded (the left hand stepped back). */
  readonly held: { readonly x: Float32Array; readonly y: Float32Array; readonly z: Float32Array };
};

export type HoldInputs = {
  readonly layout: Layout;
  readonly pairing: HoldPairing;
  readonly sphere: SphereField;
  readonly count: number;
  readonly skin: number;
  /** Final place of each identity, from `placeShape` of the paired hands. */
  readonly hand: { readonly x: Float32Array; readonly y: Float32Array; readonly z: Float32Array };
  /** Per-point curvature and delay noise of the two transitions. */
  readonly curve: readonly { kappa: Float32Array; noise: Float32Array }[];
  readonly ampLive: Float32Array;
};

const control = { x: 0, y: 0 };

export function buildHoldPlan({ layout, pairing, sphere, count: n, skin, hand, curve, ampLive }: HoldInputs): HoldPlan {
  const total = n + skin;
  const { isLeft, ball, skinBall } = pairing;
  const held = { x: new Float32Array(n), y: new Float32Array(n), z: new Float32Array(n) };
  for (let i = 0; i < n; i++) {
    held.x[i] = hand.x[i]! - (isLeft[i] ? layout.holdShift : 0);
    held.y[i] = hand.y[i]!;
    held.z[i] = hand.z[i]!;
  }
  ballFrame(0, layout.ball, ball, 0, 0, n, held.x, held.y, held.z, isLeft);

  // to-hand: the sphere at its end → the held image (and the skin → the ball, fading).
  const toHand = makeTransition(total);
  sphere.frame(SPHERE_END_MS, layout.sphere, toHand.ax, toHand.ay, toHand.az, 0, total, false);
  const skinPlace = { x: new Float32Array(total), y: new Float32Array(total), z: new Float32Array(total) };
  ballFrame(0, layout.ball, skinBall, n, n, total, skinPlace.x, skinPlace.y, skinPlace.z, null);
  const first = curve[0]!;
  for (let i = 0; i < total; i++) {
    toHand.bx[i] = i < n ? held.x[i]! : skinPlace.x[i]!;
    toHand.by[i] = i < n ? held.y[i]! : skinPlace.y[i]!;
    toHand.bz[i] = i < n ? held.z[i]! : skinPlace.z[i]!;
    controlPoint(toHand.ax[i]!, toHand.ay[i]!, toHand.bx[i]!, toHand.by[i]!, first.kappa[i]!, control);
    toHand.cx[i] = control.x;
    toHand.cy[i] = control.y;
    toHand.delay[i] = delayOf(pairing.rankHand[i]!, first.noise[i]!, phaseDuration("to-hand"), 0.4);
    toHand.ampB[i] = i < n ? ampLive[i]! : 0;
  }

  // to-hands: the held ball (at its last spin) → the right hand; the left hand steps forward (slide, no delay).
  const toHands = makeTransition(n);
  ballFrame(ballYawAt(HAND_END_MS), layout.ball, ball, 0, 0, n, toHands.ax, toHands.ay, toHands.az, isLeft);
  const second = curve[1]!;
  for (let i = 0; i < n; i++) {
    if (isLeft[i]) {
      toHands.ax[i] = held.x[i]!;
      toHands.ay[i] = held.y[i]!;
      toHands.az[i] = held.z[i]!;
    }
    toHands.bx[i] = hand.x[i]!;
    toHands.by[i] = hand.y[i]!;
    toHands.bz[i] = hand.z[i]!;
    controlPoint(toHands.ax[i]!, toHands.ay[i]!, toHands.bx[i]!, toHands.by[i]!, second.kappa[i]!, control);
    toHands.cx[i] = control.x;
    toHands.cy[i] = control.y;
    toHands.delay[i] = isLeft[i] ? 0 : delayOf(pairing.rankHands[i]!, second.noise[i]!, phaseDuration("to-hands"), 0.4);
    toHands.ampB[i] = ampLive[i]!;
  }
  return { toHand, toHands, hand, held };
}
