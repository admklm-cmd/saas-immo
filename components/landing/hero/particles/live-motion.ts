import {
  BREATH,
  CONTACT_GAP_SHARE,
  FINGER_SPREAD,
  HAND_FOLLOW,
  HAND_SPREAD,
  LIVE_CYCLE,
  MIN_TIP_GAP_PX,
  TIP_CLIMB,
  TREMOR,
} from "./hero-config";
import type { Hands } from "./hands-data";
import type { Placement } from "./layout";
import { easeInOutSine } from "./trajectory";

/**
 * The second animation of the hero (docs/design-system.md §2.11.4 ter S.3, S.4): the two index
 * fingers reach towards each other, almost touch, withdraw, rest — a cycle of 7.2 s, never a touch.
 * Pure maths: a time in, a small state out (preallocated, no allocation per frame). The points keep
 * their identity: each one is moved by a weight computed once (`buildHandsMotion`).
 */

export type LiveStep = "approach" | "contact" | "retreat" | "rest";

/** Smooth step 0..1 over `span`. */
const ramp = (value: number, span: number): number => {
  const q = Math.min(1, Math.max(0, value / span));
  return q * q * (3 - 2 * q);
};

/** Step and proportion of closeness `s` (0 = rest, 1 = almost touching) at a time of the cycle (s). */
export function cycleAt(t: number): { step: LiveStep; s: number } {
  const { approach, contact, retreat } = LIVE_CYCLE;
  // Boundaries rounded to the millisecond: 2.6 + 0.8 is not exactly 3.4 in floating point.
  const contactEnd = Math.round((approach + contact) * 1000) / 1000;
  const retreatEnd = Math.round((contactEnd + retreat) * 1000) / 1000;
  if (t < approach) return { step: "approach", s: easeInOutSine(t / approach) };
  if (t < contactEnd) return { step: "contact", s: 1 };
  if (t < retreatEnd) return { step: "retreat", s: 1 - easeInOutSine((t - contactEnd) / retreat) };
  return { step: "rest", s: 0 };
}

/** The state of the living act for one frame, written by `updateLive`. */
export type HandsLive = {
  /** Seconds since the living act began (0 = the end of the opening). */
  actSec: number;
  cycle: number;
  /** Time inside the cycle, s. */
  t: number;
  step: LiveStep;
  /** 0 = rest, 1 = nearest. */
  s: number;
  /** False = a still image (pause, reduced motion): nothing moves. */
  moving: boolean;
  /** Gap between the tips at rest, and nearest, CSS px. */
  g0: number;
  g1: number;
  /** Half of the closing of the gap that each index has made, CSS px (tremor included). */
  reach: number;
  /** Current gap between the two tips, CSS px. */
  gap: number;
  /** Per hand (0 left, 1 right): vertical breath (px), scale, pivot (the tip at rest), climb sign. */
  breathY: [number, number];
  breathK: [number, number];
  pivotX: [number, number];
  pivotY: [number, number];
  climb: [number, number];
  /** Current tips and the middle of the gap (the cobalt contact point), CSS px. */
  tip: { lx: number; ly: number; rx: number; ry: number };
  contactX: number;
  contactY: number;
  /** Size of the amplitudes (1 at 1440). */
  scale: number;
};

export function createHandsLive(): HandsLive {
  return {
    actSec: 0,
    cycle: 0,
    t: 0,
    step: "rest",
    s: 0,
    moving: false,
    g0: 0,
    g1: 0,
    reach: 0,
    gap: 0,
    breathY: [0, 0],
    breathK: [0, 0],
    pivotX: [0, 0],
    pivotY: [0, 0],
    climb: [0, 0],
    tip: { lx: 0, ly: 0, rx: 0, ry: 0 },
    contactX: 0,
    contactY: 0,
    scale: 1,
  };
}

/**
 * Writes the state of the living act at `actSec`. `moving` false gives the image of rest (gap `g0`,
 * no breath), for the pause and reduced motion. `scale` sizes the breathing.
 */
export function updateLive(live: HandsLive, actSec: number, hands: Hands, place: Placement, scale: number, moving: boolean): HandsLive {
  const { period } = LIVE_CYCLE;
  const at = moving ? Math.max(0, actSec) : 0;
  live.actSec = at;
  live.moving = moving;
  live.scale = scale;
  live.cycle = Math.floor(at / period);
  live.t = at - live.cycle * period;
  const { step, s } = moving ? cycleAt(live.t) : { step: "rest" as LiveStep, s: 0 };
  live.step = step;
  live.s = s;

  const tipL = hands.tips.left;
  const tipR = hands.tips.right;
  live.g0 = (tipR[0] - tipL[0]) * place.sx;
  live.g1 = Math.min(live.g0 * 0.9, Math.max(MIN_TIP_GAP_PX + TREMOR.amplitude, CONTACT_GAP_SHARE * place.sx));
  const tremor = step === "contact" ? Math.sin((2 * Math.PI * (live.t - LIVE_CYCLE.approach)) / TREMOR.period) * (TREMOR.amplitude / 2) : 0;
  live.reach = s * ((live.g0 - live.g1) / 2) + tremor;
  live.gap = live.g0 - 2 * live.reach;

  const grown = moving ? ramp(at, BREATH.ramp) * BREATH.amplitude * scale : 0;
  const turn = (2 * Math.PI * at) / BREATH.period;
  live.breathY[0] = grown * Math.sin(turn);
  live.breathY[1] = grown * Math.sin(turn + BREATH.phase);
  const swell = moving ? ramp(at, BREATH.ramp) * BREATH.scale : 0;
  live.breathK[0] = swell * Math.sin(turn);
  live.breathK[1] = swell * Math.sin(turn + BREATH.phase);

  live.pivotX[0] = place.cx + tipL[0] * place.sx;
  live.pivotY[0] = place.cy + tipL[1] * place.sy;
  live.pivotX[1] = place.cx + tipR[0] * place.sx;
  live.pivotY[1] = place.cy + tipR[1] * place.sy;
  const up = Math.sign(tipR[1] - tipL[1]) * TIP_CLIMB;
  live.climb[0] = up;
  live.climb[1] = -up;

  // The tips: weight 1 by construction (the finger weight is 1 on the tip).
  live.tip.lx = live.pivotX[0] + live.reach;
  live.tip.ly = live.pivotY[0] + live.climb[0] * live.reach + live.breathY[0];
  live.tip.rx = live.pivotX[1] - live.reach;
  live.tip.ry = live.pivotY[1] + live.climb[1] * live.reach + live.breathY[1];
  live.contactX = (live.tip.lx + live.tip.rx) / 2;
  live.contactY = (live.tip.ly + live.tip.ry) / 2;
  return live;
}

/** Weights of the move of a point of the hands at (`nx`, `ny`): finger (1 on the tip) and the whole (finger + a share of the hand). */
export function moveWeights(nx: number, ny: number, tips: Hands["tips"], out: { finger: number; whole: number; hand: 0 | 1 }): { finger: number; whole: number; hand: 0 | 1 } {
  const hand = nx < 0 ? 0 : 1;
  const tip = hand === 0 ? tips.left : tips.right;
  const d2 = (nx - tip[0]) ** 2 + (ny - tip[1]) ** 2;
  const finger = Math.exp(-d2 / FINGER_SPREAD ** 2);
  const body = Math.exp(-d2 / HAND_SPREAD ** 2);
  out.finger = finger;
  out.whole = finger + HAND_FOLLOW * body * (1 - finger);
  out.hand = hand;
  return out;
}

export type HandsMotion = {
  /** Horizontal move per px of reach (signed: towards the other hand), vertical move per px of reach. */
  readonly moveX: Float32Array;
  readonly moveY: Float32Array;
  /** 0 left hand, 1 right hand. */
  readonly hand: Uint8Array;
};

const scratch = { finger: 0, whole: 0, hand: 0 as 0 | 1 };

/** Computed once per hands shape, out of the loop (§2.11.4 ter S.4). */
export function buildHandsMotion(x: Float32Array, y: Float32Array, count: number, tips: Hands["tips"]): HandsMotion {
  const moveX = new Float32Array(count);
  const moveY = new Float32Array(count);
  const hand = new Uint8Array(count);
  const up = Math.sign(tips.right[1] - tips.left[1]) * TIP_CLIMB;
  for (let i = 0; i < count; i++) {
    moveWeights(x[i]!, y[i]!, tips, scratch);
    hand[i] = scratch.hand;
    moveX[i] = scratch.hand === 0 ? scratch.whole : -scratch.whole;
    moveY[i] = (scratch.hand === 0 ? up : -up) * scratch.finger;
  }
  return { moveX, moveY, hand };
}

/** Moves the first `count` points (already placed, CSS px) for the current state of the living act. */
export function applyHandsMotion(motion: HandsMotion, live: HandsLive, count: number, x: Float32Array, y: Float32Array): void {
  if (!live.moving) return;
  const { moveX, moveY, hand } = motion;
  const reach = live.reach;
  const [k0, k1] = live.breathK;
  const [b0, b1] = live.breathY;
  const [px0, px1] = live.pivotX;
  const [py0, py1] = live.pivotY;
  for (let i = 0; i < count; i++) {
    const right = hand[i]! === 1;
    const k = right ? k1 : k0;
    const xi = x[i]!;
    const yi = y[i]!;
    x[i] = xi + moveX[i]! * reach + (xi - (right ? px1 : px0)) * k;
    y[i] = yi + moveY[i]! * reach + (yi - (right ? py1 : py0)) * k + (right ? b1 : b0);
  }
}

/** The same move for a robot standing at (`x`, `y`) CSS px on the hands (normalised position `nx`, `ny`). Writes into `out`. */
export function moveOnHands(live: HandsLive, hands: Hands, place: Placement, nx: number, ny: number, out: { x: number; y: number }): { x: number; y: number } {
  const x = place.cx + nx * place.sx;
  const y = place.cy + ny * place.sy;
  if (!live.moving) {
    out.x = x;
    out.y = y;
    return out;
  }
  moveWeights(nx, ny, hands.tips, scratch);
  const h = scratch.hand;
  const k = live.breathK[h];
  const sign = h === 0 ? 1 : -1;
  out.x = x + sign * scratch.whole * live.reach + (x - live.pivotX[h]) * k;
  out.y = y + live.climb[h] * scratch.finger * live.reach + (y - live.pivotY[h]) * k + live.breathY[h];
  return out;
}
