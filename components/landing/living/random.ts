/**
 * Seeded randomness and small numeric helpers of the neural network
 * background (docs/design-system.md §2.11.4). Nothing in
 * `components/landing/living/` may call `Math.random`: the same seed and the
 * same screen class always give the same network and the same cascades
 * (stable captures and tests).
 */

/**
 * Default seed of the landing network. 20261002 (the date) left an empty cell
 * in the coverage test on phones; 20261069 is the first seed after it that
 * passes spacing and coverage in the three classes (docs/design-system.md §2.11.4).
 */
export const DEFAULT_SEED = 20261069;

export type Random = {
  /** Uniform in [0, 1). */
  next: () => number;
  /** Uniform in [min, max). */
  range: (min: number, max: number) => number;
};

/** mulberry32: tiny, fast, good enough for a decor; 32-bit state. */
export function createRandom(seed: number): Random {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, range: (min, max) => min + next() * (max - min) };
}

/** Stable 32-bit hash of a label (FNV-1a), to derive a seed per sequence or per class. */
export function hashLabel(label: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < label.length; index++) {
    hash ^= label.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Seed derived from a base seed and a label (`DEFAULT_SEED` + « arrivee », + « large »…). */
export function deriveSeed(seed: number, label: string): number {
  return (seed ^ hashLabel(label)) >>> 0;
}

/** Deterministic hash of integers to [0, 1). */
export function hash01(a: number, b: number, c: number, seed: number): number {
  let x = (Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1) ^ seed) >>> 0;
  x = Math.imul(x ^ (x >>> 15), x | 1);
  x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
}

export function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function smoothstep(value: number): number {
  const q = clamp01(value);
  return q * q * (3 - 2 * q);
}
