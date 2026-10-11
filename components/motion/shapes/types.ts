/** Number of floats written per particle: x, y (shape units, y pointing down) and opacity. */
export const POINT_STRIDE = 3;

/**
 * Pure shape function. Writes x, y and opacity of particle `index` at
 * `out[index * POINT_STRIDE]`. `seeds` holds four uniform seeds per particle.
 * Must not allocate: it runs for every particle on every frame.
 */
export type ShapeFn = (index: number, count: number, t: number, seeds: Float32Array, out: Float32Array) => void;

export type ShapeBounds = { minX: number; maxX: number; minY: number; maxY: number };

export type ShapeDefinition = {
  shape: ShapeFn;
  /** Every point of the shape stays inside these bounds at every instant (tested). */
  bounds: ShapeBounds;
  /** Loop duration in seconds, or null when the motion is an endless drift. */
  cycle: number | null;
  /** Representative instant rendered without motion under prefers-reduced-motion. */
  staticTime: number;
  /**
   * How far the renderer may stretch one axis relative to the other to fill a
   * zone. 1 keeps the proportions (objects); > 1 lets fields adapt to the zone.
   */
  maxStretch: number;
};

/** Opacity range of the material (spec §3). */
export const MIN_ALPHA = 0.12;
export const MAX_ALPHA = 0.6;
