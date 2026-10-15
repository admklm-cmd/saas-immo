import { createPrng } from "@/components/motion/engine/prng";

import { SEEDS, SPHERE } from "./hero-config";

/**
 * Point sets of the hero shapes (docs/design-system.md T.3, T.2). Pure and deterministic (fixed
 * seeds). Coordinates are NORMALISED (each shape has its own unit, set by the layout), origin at the
 * middle of the shape, `y` pointing down (screen), `z` toward the viewer.
 */
export type Shape = {
  readonly count: number;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly z: Float32Array;
};

export function emptyShape(count: number): Shape {
  return { count, x: new Float32Array(count), y: new Float32Array(count), z: new Float32Array(count) };
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function gaussian(random: () => number): number {
  // Box-Muller; the guard keeps the logarithm finite.
  const u = Math.max(random(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
}

/**
 * Sphere: Fibonacci lattice on the surface, diameter 1 (radius 0.5), with a denser pole (docs T.3):
 * `SPHERE.pole` of the points (half per pole) lie in a cap of `SPHERE.cap` around each pole, the others
 * on the band between the caps. Points are ordered north cap, south cap, then the band.
 */
export function buildSphere(count: number): Shape {
  const shape = emptyShape(count);
  const cosCap = Math.cos(SPHERE.cap);
  const perPole = Math.round((count * SPHERE.pole) / 2);
  const band = count - 2 * perPole;
  let index = 0;
  const put = (cos: number, phi: number) => {
    const sin = Math.sqrt(Math.max(0, 1 - cos * cos));
    shape.x[index] = 0.5 * sin * Math.cos(phi);
    shape.y[index] = -0.5 * cos;
    shape.z[index] = 0.5 * sin * Math.sin(phi);
    index++;
  };
  for (let k = 0; k < perPole; k++) put(1 - ((1 - cosCap) * (k + 0.5)) / perPole, k * GOLDEN_ANGLE);
  for (let k = 0; k < perPole; k++) put(-(1 - ((1 - cosCap) * (k + 0.5)) / perPole), k * GOLDEN_ANGLE);
  for (let k = 0; k < band; k++) put(cosCap - (2 * cosCap * (k + 0.5)) / band, k * GOLDEN_ANGLE);
  return shape;
}

/** Fisher-Yates permutation of 0..count-1 from a seeded stream. */
export function shuffledIndices(count: number, seed: number): Uint32Array {
  const random = createPrng(seed);
  const order = new Uint32Array(count);
  for (let i = 0; i < count; i++) order[i] = i;
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const swap = order[i]!;
    order[i] = order[j]!;
    order[j] = swap;
  }
  return order;
}
