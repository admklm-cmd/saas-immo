import { createPrng } from "@/components/motion/engine/prng";

import { SEEDS } from "./hero-config";

/**
 * Point sets of the hero shapes (docs/design-system.md §2.11.4 ter D). Pure and deterministic
 * (fixed seeds). Coordinates are NORMALISED (each shape has its own unit, set by the layout),
 * origin at the middle of the shape, `y` pointing down (screen), `z` toward the viewer.
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
 * Cloud: unit = the stage (x and y span about ±0.5 of its width and height). 70 % a mixture of wide
 * gaussians over the whole band, 30 % in slow bands along the left and right margins. No readable shape.
 */
export function buildCloud(count: number): Shape {
  const random = createPrng(SEEDS.cloud);
  const shape = emptyShape(count);
  const blobs = [
    { x: -0.3, y: -0.1, sx: 0.22, sy: 0.22 },
    { x: 0.3, y: 0.05, sx: 0.24, sy: 0.26 },
    { x: 0, y: 0.22, sx: 0.3, sy: 0.18 },
    { x: -0.05, y: -0.28, sx: 0.32, sy: 0.16 },
    { x: 0.12, y: 0.0, sx: 0.18, sy: 0.3 },
  ];
  for (let i = 0; i < count; i++) {
    let x: number;
    let y: number;
    if (random() < 0.7) {
      const blob = blobs[Math.floor(random() * blobs.length)]!;
      x = blob.x + gaussian(random) * blob.sx;
      y = blob.y + gaussian(random) * blob.sy;
    } else {
      const side = random() < 0.5 ? -1 : 1;
      x = side * (0.43 + gaussian(random) * 0.05);
      y = gaussian(random) * 0.3;
    }
    shape.x[i] = Math.max(-0.58, Math.min(0.58, x));
    shape.y[i] = Math.max(-0.58, Math.min(0.58, y));
    shape.z[i] = (random() - 0.5) * 0.5;
  }
  return shape;
}

/** Sphere: Fibonacci lattice on the surface, diameter 1 (radius 0.5). */
export function buildSphere(count: number): Shape {
  const shape = emptyShape(count);
  for (let i = 0; i < count; i++) {
    const cos = 1 - (2 * (i + 0.5)) / count;
    const sin = Math.sqrt(1 - cos * cos);
    const phi = i * GOLDEN_ANGLE;
    shape.x[i] = 0.5 * sin * Math.cos(phi);
    shape.y[i] = -0.5 * cos;
    shape.z[i] = 0.5 * sin * Math.sin(phi);
  }
  return shape;
}

/** Profile of the apple body, in units of R (docs/design-system.md §2.11.4 ter D): `theta` from the top (0) to the bottom (pi). */
export function appleProfile(theta: number): { rho: number; y: number } {
  const sin = Math.sin(theta);
  const cos = Math.cos(theta);
  const rho = sin * (1 + 0.14 * cos);
  let y = cos * 0.94;
  // Dimple around the stem (top) and a shallower one under the fruit.
  const top = Math.max(0, 1 - (rho / 0.5) ** 2);
  const bottom = Math.max(0, 1 - (rho / 0.4) ** 2);
  y -= cos > 0 ? 0.2 * top * top : 0;
  y += cos < 0 ? 0.06 * bottom * bottom : 0;
  return { rho, y };
}

export type AppleParts = { readonly body: number; readonly stem: number; readonly leaf: number };

/** Split of `count` points among body, stem (4 %) and leaf (6 %). */
export function appleParts(count: number): AppleParts {
  const stem = Math.round(count * 0.04);
  const leaf = Math.round(count * 0.06);
  return { body: count - stem - leaf, stem, leaf };
}

/** Where the stem leaves the body, in units of R. */
const STEM = { length: 0.36, radius: 0.045, bend: 0.1 } as const;
const LEAF = { halfLength: 0.27, halfWidth: 0.1, angle: (30 * Math.PI) / 180, onStem: 0.55 } as const;

/**
 * Apple, the fruit: whole, WITHOUT any bite. A solid of revolution (so it reads in volume when it
 * sways), symmetric about the vertical axis; stem and a leaf fixed to the LEFT of the stem (the
 * brand logo has a bite on the right and its leaf on the right). Total height (body + stem) = 1.
 * Points are ordered body, then stem, then leaf.
 */
export function buildApple(count: number): Shape {
  const random = createPrng(SEEDS.apple);
  const parts = appleParts(count);
  const shape = emptyShape(count);
  // y up while building, flipped at the end.
  const yTopAxis = appleProfile(0).y;
  let index = 0;
  for (let i = 0; i < parts.body; i++) {
    const theta = Math.acos(1 - (2 * (i + 0.5)) / parts.body);
    const { rho, y } = appleProfile(theta);
    // One point in six leans on the silhouette (the meridians facing left and right): the outline stays crisp.
    const phi = i % 6 === 0 ? (i % 12 === 0 ? 0 : Math.PI) + (random() - 0.5) * 0.3 : i * GOLDEN_ANGLE;
    shape.x[index] = rho * Math.cos(phi);
    shape.y[index] = y;
    shape.z[index] = rho * Math.sin(phi);
    index++;
  }
  const stemAt = (t: number) => ({ x: STEM.bend * t * t, y: yTopAxis - 0.1 + STEM.length * t });
  for (let i = 0; i < parts.stem; i++) {
    const t = random();
    const centre = stemAt(t);
    const angle = random() * Math.PI * 2;
    shape.x[index] = centre.x + STEM.radius * Math.cos(angle);
    shape.y[index] = centre.y;
    shape.z[index] = STEM.radius * Math.sin(angle);
    index++;
  }
  const root = stemAt(LEAF.onStem);
  // Long axis of the leaf: up and to the LEFT.
  const ax = -Math.cos(LEAF.angle);
  const ay = Math.sin(LEAF.angle);
  for (let i = 0; i < parts.leaf; i++) {
    const vein = random() < 0.4;
    const along = vein ? random() : Math.sqrt(random());
    const side = vein ? 0 : (random() * 2 - 1) * Math.sqrt(1 - along * along);
    const u = (0.1 + along * 0.9) * LEAF.halfLength * 2;
    const v = side * LEAF.halfWidth * (0.5 + 0.5 * Math.sin(Math.PI * Math.min(1, u / (LEAF.halfLength * 2))));
    shape.x[index] = root.x + ax * u - ay * v;
    shape.y[index] = root.y + ay * u + ax * v;
    shape.z[index] = 0.012 * (u / LEAF.halfLength) ** 2;
    index++;
  }
  // Normalise: total height 1, centred on the bounding box, y down.
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < count; i++) {
    min = Math.min(min, shape.y[i]!);
    max = Math.max(max, shape.y[i]!);
  }
  const scale = 1 / (max - min);
  const middle = (max + min) / 2;
  for (let i = 0; i < count; i++) {
    shape.x[i] = shape.x[i]! * scale;
    shape.y[i] = -(shape.y[i]! - middle) * scale;
    shape.z[i] = shape.z[i]! * scale;
  }
  return shape;
}

/** Scale applied to the apple profile units (R) to land in normalised units; used by the robot rails. */
export function appleScale(): { scale: number; middle: number } {
  let min = Infinity;
  let max = -Infinity;
  const yTopAxis = appleProfile(0).y;
  for (let k = 0; k <= 200; k++) {
    const { y } = appleProfile((k / 200) * Math.PI);
    min = Math.min(min, y);
    max = Math.max(max, y);
  }
  max = Math.max(max, yTopAxis - 0.1 + STEM.length);
  return { scale: 1 / (max - min), middle: (max + min) / 2 };
}
