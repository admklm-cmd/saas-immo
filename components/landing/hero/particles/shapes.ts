import { createPrng } from "@/components/motion/engine/prng";

import { BALL_SURFACE_SHARE, BALL_VOLUME_SPREAD, SEEDS, SPHERE } from "./hero-config";

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

/**
 * The ball the left hand holds, radius 1 (the layout scales it): `BALL_SURFACE_SHARE` of the points on
 * its surface (Fibonacci), the others in its volume (gaussian, σ = `BALL_VOLUME_SPREAD`): the ball is
 * the densest zone of the picture, with a darker heart. `stream` shifts the seed (skin points vs identities).
 */
export function buildBall(count: number, stream = 0): Shape {
  const random = createPrng(SEEDS.ball + stream * 977);
  const shape = emptyShape(count);
  const surface = Math.round(count * BALL_SURFACE_SHARE);
  for (let i = 0; i < count; i++) {
    let x: number;
    let y: number;
    let z: number;
    if (i < surface) {
      const cos = 1 - (2 * (i + 0.5)) / surface;
      const sin = Math.sqrt(1 - cos * cos);
      const phi = i * GOLDEN_ANGLE;
      x = sin * Math.cos(phi);
      y = -cos;
      z = sin * Math.sin(phi);
    } else {
      do {
        x = gaussian(random) * BALL_VOLUME_SPREAD;
        y = gaussian(random) * BALL_VOLUME_SPREAD;
        z = gaussian(random) * BALL_VOLUME_SPREAD;
      } while (x * x + y * y + z * z > 0.9);
    }
    shape.x[i] = x;
    shape.y[i] = y;
    shape.z[i] = z;
  }
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
