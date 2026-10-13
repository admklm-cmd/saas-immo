import { createPrng } from "@/components/motion/engine/prng";

/**
 * The particle field of the page below the hero (docs/design-system.md T.6): about 22 000 small
 * squares visible at 1440 × 900, in three depth planes, that breathe and send a wave from the title
 * of the section near the middle of the window. Pure: the seeded plane tiles and the maths of the
 * drift, the breathing and the rings. Decorative; no connection, no cobalt, nothing that reads as data.
 */
export const DUST = {
  /** Three planes: far, middle, near. Share of the points, size (CSS px), opacity (never above `maxAlpha`), drift (px/s, heading in degrees), tile side (CSS px). */
  planes: [
    { share: 0.5, size: 1.0, alpha: 0.16, speed: 3, heading: 20, tile: 1024, period: 9, phase: 0 },
    { share: 0.35, size: 1.4, alpha: 0.26, speed: 5, heading: 110, tile: 1216, period: 7, phase: 2.1 },
    { share: 0.15, size: 1.9, alpha: 0.38, speed: 8, heading: 200, tile: 1408, period: 5.5, phase: 4.2 },
  ],
  /** One point for this many px² of window, within these bounds (T.6: 22 000 at 1440 × 900). */
  area: 60,
  min: 4_000,
  max: 24_000,
  /** A phone shows this many points (the same density would be a grey veil and would not hold 20 images/s). */
  phone: 5_400,
  phoneWidth: 768,
  /** Breathing of each plane: ± this share of its opacity. */
  breath: 0.12,
  /** Frame step: 30 images/s on a computer and a tablet, 20 on a phone. */
  frameMs: 1000 / 30,
  phoneFrameMs: 1000 / 20,
  /** A point never goes above this opacity, even in a wave; one pixel never exceeds this ink coverage. */
  maxAlpha: 0.55,
  maxCoverage: 0.6,
  seed: 20261018,
} as const;

/** The waves: one ring every 6 s from the title near the middle of the window, two alive at most. */
export const WAVE = {
  everyMs: 6_000,
  firstMs: 500,
  /** Ring speed (px/s), reach (px), half-width σ (px), gain of the opacity and growth of the size (px) of a point on the ring. */
  speed: 110,
  reach: 760,
  reachPhone: 480,
  sigma: 26,
  gain: 1.2,
  grow: 0.5,
  falloff: 1.2,
  maxRings: 2,
  /** Share of the origin that must be visible for it to emit. */
  visible: 0.4,
} as const;

/** One plane of points in its own tile (positions in CSS px inside `side` × `side`). */
export type PlaneTile = {
  readonly count: number;
  readonly side: number;
  readonly x: Float32Array;
  readonly y: Float32Array;
};

/** Number of points visible in a `width` × `height` window (T.6). */
export function fieldCount(width: number, height: number): number {
  if (width < DUST.phoneWidth) return DUST.phone;
  return Math.round(Math.min(DUST.max, Math.max(DUST.min, (width * height) / DUST.area)));
}

/** Points of plane `plane` in its tile for a window of `visible` points: the same density as the window, whatever the tile. */
export function planeCount(visible: number, width: number, height: number, plane: number): number {
  const spec = DUST.planes[plane]!;
  return Math.round(((visible * spec.share) / (width * height)) * spec.tile * spec.tile);
}

/** The deterministic tile of a plane. */
export function buildPlane(plane: number, count: number): PlaneTile {
  const spec = DUST.planes[plane]!;
  const random = createPrng(DUST.seed + plane * 131);
  const x = new Float32Array(count);
  const y = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    x[i] = random() * spec.tile;
    y[i] = random() * spec.tile;
  }
  return { count, side: spec.tile, x, y };
}

/** Drift offset (CSS px, wrapped into one tile) of a plane after `seconds`. */
export function driftOffset(plane: number, seconds: number): { x: number; y: number } {
  const spec = DUST.planes[plane]!;
  const heading = (spec.heading * Math.PI) / 180;
  const wrap = (value: number) => ((value % spec.tile) + spec.tile) % spec.tile;
  return { x: wrap(Math.cos(heading) * spec.speed * seconds), y: wrap(Math.sin(heading) * spec.speed * seconds) };
}

/** Opacity multiplier of a plane at `seconds`: it breathes by ± 12 %, never a flicker. */
export function breathing(plane: number, seconds: number): number {
  const spec = DUST.planes[plane]!;
  return 1 + DUST.breath * Math.sin((2 * Math.PI * seconds) / spec.period + spec.phase);
}

/** Gain of a point at distance `distance` from the origin of a ring of radius `radius` (T.6): gaussian, dying as it grows. */
export function ringGain(distance: number, radius: number, reach: number): number {
  const q = (distance - radius) / WAVE.sigma;
  const fade = Math.max(0, 1 - radius / reach) ** WAVE.falloff;
  return Math.exp(-q * q) * fade;
}

/** Opacity of a point on a ring: its own, times `1 + 1.2 g`, never above `maxAlpha`. */
export function ringAlpha(base: number, gain: number): number {
  return Math.min(DUST.maxAlpha, base * (1 + WAVE.gain * gain));
}

/** Maximal reach of a ring for a window width. */
export function ringReach(width: number): number {
  return width < DUST.phoneWidth ? WAVE.reachPhone : WAVE.reach;
}

/** Radius (px) of a ring `ageMs` after its emission. */
export function ringRadius(ageMs: number): number {
  return (WAVE.speed * ageMs) / 1000;
}

/** Wave rings alive at `now`, from the emission times (ms), sparing the phone to one. */
export function aliveRings(emitted: readonly number[], now: number, width: number): number[] {
  const reach = ringReach(width);
  return emitted.filter((at) => ringRadius(now - at) <= reach);
}
