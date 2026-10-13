import { createPrng } from "@/components/motion/engine/prng";

import { SEEDS } from "./hero-config";

/**
 * Curved trajectories with a per-point delay (docs/design-system.md §2.11.4 ter C): a quadratic
 * Bézier A → C → B, C = middle(A, B) + n·κ·|AB|; a delay c·T·r_i (+ noise); easeInOutCubic.
 * Pure helpers over typed arrays; the frame loop calls `progressOf` and `bezier` only.
 */

export function easeInOutCubic(q: number): number {
  const x = q < 0 ? 0 : q > 1 ? 1 : q;
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

export function easeInOutSine(q: number): number {
  const x = q < 0 ? 0 : q > 1 ? 1 : q;
  return -(Math.cos(Math.PI * x) - 1) / 2;
}

/** Share of the duration spent waiting, by transition (the spec's `c`). */
export const WAVE_SPREAD = { "to-sphere": 0.35, "to-apple": 0.35, "to-hands": 0.4 } as const;
/** Noise on the delay, as a share of the duration. */
export const WAVE_NOISE = 0.04;

/** Progress 0..1 of one point at `tau` ms into a transition of `duration` ms, with its delay (ms). */
export function progressOf(tau: number, delayMs: number, duration: number, spread: number): number {
  const run = (1 - spread) * duration;
  const q = (tau - delayMs) / run;
  return q < 0 ? 0 : q > 1 ? 1 : q;
}

/** Delay (ms) of a point from its wave rank `r` (0..1), the seeded noise `n` (-1..1) and the spread. */
export function delayOf(rank: number, noise: number, duration: number, spread: number): number {
  const raw = spread * duration * rank + noise * WAVE_NOISE * duration;
  return Math.max(0, Math.min(spread * duration, raw));
}

/** Position on the quadratic Bézier at `e` (0..1). */
export function bezier(a: number, c: number, b: number, e: number): number {
  const u = 1 - e;
  return u * u * a + 2 * u * e * c + e * e * b;
}

/** Per-point curvature κ (signed, 0.10 to 0.30; 70 % share one sign: a vortex) and delay noise (-1..1). */
export function buildCurvature(count: number, stream: number): { kappa: Float32Array; noise: Float32Array } {
  const random = createPrng(SEEDS.curve + stream * 101);
  const kappa = new Float32Array(count);
  const noise = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const magnitude = 0.1 + random() * 0.2;
    kappa[i] = random() < 0.7 ? magnitude : -magnitude;
    noise[i] = random() * 2 - 1;
  }
  return { kappa, noise };
}

/**
 * Control point of the Bézier between A and B: the middle pushed along the normal of AB by κ·|AB|.
 * Writes into `out` and returns it.
 */
export function controlPoint(ax: number, ay: number, bx: number, by: number, kappa: number, out: { x: number; y: number }): { x: number; y: number } {
  const dx = bx - ax;
  const dy = by - ay;
  // The normal (-dy, dx) has the length |AB|: κ·|AB| in one multiplication.
  out.x = (ax + bx) / 2 - dy * kappa;
  out.y = (ay + by) / 2 + dx * kappa;
  return out;
}
