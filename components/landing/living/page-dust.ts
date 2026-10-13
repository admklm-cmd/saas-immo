import { createPrng } from "@/components/motion/engine/prng";

/**
 * The small particles of the page below the hero (docs/design-system.md §2.11.4 ter J): a few
 * hundred pale squares drifting very slowly, behind every content. Pure: the seeded initial
 * state and the step. Decorative; no connection, no cobalt, nothing that reads as data.
 */
export const DUST = {
  /** Particles at 1024 px and above, and below. */
  count: { wide: 220, narrow: 120 },
  /** Two planes: share, opacity (never above 0.16), size range (CSS px). */
  planes: [
    { share: 0.6, alpha: 0.1 },
    { share: 0.4, alpha: 0.16 },
  ],
  size: { min: 1.2, max: 2 },
  /** Drift in CSS px per second. */
  speed: { min: 3, max: 8 },
  /** Frame step (the loop runs at 30 frames/s). */
  frameMs: 1000 / 30,
  seed: 20261018,
} as const;

export type Dust = {
  readonly count: number;
  /** Positions as a share of the viewport (0..1). */
  readonly x: Float32Array;
  readonly y: Float32Array;
  /** Velocity in CSS px per second. */
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  readonly size: Float32Array;
  readonly plane: Uint8Array;
};

export function dustCount(width: number): number {
  return width >= 1024 ? DUST.count.wide : DUST.count.narrow;
}

export function createDust(count: number): Dust {
  const random = createPrng(DUST.seed);
  const dust: Dust = {
    count,
    x: new Float32Array(count),
    y: new Float32Array(count),
    vx: new Float32Array(count),
    vy: new Float32Array(count),
    size: new Float32Array(count),
    plane: new Uint8Array(count),
  };
  for (let i = 0; i < count; i++) {
    const angle = random() * Math.PI * 2;
    const speed = DUST.speed.min + random() * (DUST.speed.max - DUST.speed.min);
    dust.x[i] = random();
    dust.y[i] = random();
    dust.vx[i] = Math.cos(angle) * speed;
    dust.vy[i] = Math.sin(angle) * speed;
    dust.size[i] = DUST.size.min + random() * (DUST.size.max - DUST.size.min);
    dust.plane[i] = random() < DUST.planes[0].share ? 0 : 1;
  }
  return dust;
}

/** Moves every particle by `seconds`, wrapping at the edges of a `width` × `height` viewport. */
export function stepDust(dust: Dust, seconds: number, width: number, height: number): void {
  for (let i = 0; i < dust.count; i++) {
    let x = dust.x[i]! + (dust.vx[i]! * seconds) / width;
    let y = dust.y[i]! + (dust.vy[i]! * seconds) / height;
    x -= Math.floor(x);
    y -= Math.floor(y);
    dust.x[i] = x;
    dust.y[i] = y;
  }
}
