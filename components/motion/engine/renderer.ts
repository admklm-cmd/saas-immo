import { MAX_ALPHA, MIN_ALPHA, POINT_STRIDE } from "../shapes/types";

/** Particle ink (spec §3). Canvas cannot read Tailwind tokens; see docs/design-system.md. */
export const PARTICLE_COLOR = "rgb(39, 39, 49)";
/** Opacity levels: points are batched per level, one fill per level. */
const LEVELS = 16;
const NO_LEVEL = 255;

/** Output opacity range. Shapes produce .12–.60 (spec §3); the background mode uses .08–.35 (spec §9). */
export type OpacityRange = { min: number; max: number };
export const ZONE_OPACITY: OpacityRange = { min: MIN_ALPHA, max: MAX_ALPHA };
export const BACKGROUND_OPACITY: OpacityRange = { min: 0.08, max: 0.35 };

/**
 * Maps a shape opacity (.12–.60, or below .12 while fading) into `range`.
 * Piecewise linear and continuous: 0 stays 0, .12 -> range.min, .60 -> range.max.
 */
export function mapOpacity(alpha: number, range: OpacityRange): number {
  if (alpha <= 0) return 0;
  if (alpha < MIN_ALPHA) return (alpha / MIN_ALPHA) * range.min;
  const clamped = alpha > MAX_ALPHA ? MAX_ALPHA : alpha;
  return range.min + ((clamped - MIN_ALPHA) / (MAX_ALPHA - MIN_ALPHA)) * (range.max - range.min);
}

export type DrawParams = {
  count: number;
  width: number;
  height: number;
  intensity: number;
  minSize: number;
  sizeRange: number;
  opacity: OpacityRange;
  /** Particles [count, fadeEnd) are drawn too, with their opacity multiplied by `fade` (0 to 1). */
  fadeEnd: number;
  fade: number;
};

/**
 * Draws points in a few batched paths grouped by opacity. Buffers are
 * allocated once for the engine capacity; drawing allocates nothing.
 */
export class PointRenderer {
  private readonly levelOf: Uint8Array;
  private readonly order: Int32Array;
  private readonly starts = new Int32Array(LEVELS + 1);
  private readonly cursor = new Int32Array(LEVELS);

  constructor(capacity: number) {
    this.levelOf = new Uint8Array(capacity);
    this.order = new Int32Array(capacity);
  }

  draw(context: CanvasRenderingContext2D, points: Float32Array, seeds: Float32Array, params: DrawParams): void {
    const { count, width, height, intensity, minSize, sizeRange, opacity, fade } = params;
    const total = Math.max(count, params.fadeEnd);
    const top = opacity.max;
    const { levelOf, order, starts, cursor } = this;
    starts.fill(0);
    for (let i = 0; i < total; i++) {
      let alpha = mapOpacity((points[i * POINT_STRIDE + 2] ?? 0) * intensity, opacity);
      if (i >= count) alpha *= fade;
      if (alpha < 0.005) {
        levelOf[i] = NO_LEVEL;
        continue;
      }
      const level = Math.min(LEVELS - 1, Math.floor((alpha / top) * LEVELS));
      levelOf[i] = level;
      starts[level + 1] = (starts[level + 1] ?? 0) + 1;
    }
    for (let l = 0; l < LEVELS; l++) {
      starts[l + 1] = (starts[l + 1] ?? 0) + (starts[l] ?? 0);
      cursor[l] = starts[l] ?? 0;
    }
    for (let i = 0; i < total; i++) {
      const level = levelOf[i] ?? NO_LEVEL;
      if (level === NO_LEVEL) continue;
      const position = cursor[level] ?? 0;
      order[position] = i;
      cursor[level] = position + 1;
    }

    context.clearRect(0, 0, width, height);
    context.fillStyle = PARTICLE_COLOR;
    for (let l = 0; l < LEVELS; l++) {
      const start = starts[l] ?? 0;
      const end = starts[l + 1] ?? 0;
      if (end <= start) continue;
      context.globalAlpha = ((l + 0.5) / LEVELS) * top;
      context.beginPath();
      for (let k = start; k < end; k++) {
        const i = order[k] ?? 0;
        const o = i * POINT_STRIDE;
        const size = minSize + (seeds[i * 4 + 2] ?? 0) * sizeRange;
        context.rect((points[o] ?? 0) * width - size / 2, (points[o + 1] ?? 0) * height - size / 2, size, size);
      }
      context.fill();
    }
    context.globalAlpha = 1;
  }
}
