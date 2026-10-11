import { smoothstep, wrap } from "../engine/math";
import { MAX_ALPHA, MIN_ALPHA, POINT_STRIDE, type ShapeDefinition, type ShapeFn } from "./types";

const LEFT = -120;
const RIGHT = 120;
/** Distance over which opacity fades to zero at both ends: recycling is invisible. */
export const CURRENT_EDGE_FADE = 30;
const SPEEDS = [7, 11, 16] as const;

/**
 * Pipeline — left-to-right current (spec §4-C):
 * x = wrap(initialX + t*speed, left, right) ;
 * y = initialY + sin(x*.028 - t*.7)*a1 + sin(x*.05 + t*.3)*a2.
 * Three speed lanes; opacity fades to 0 at both ends so the wrap never shows.
 */
export const currentShape: ShapeFn = (index, _count, t, seeds, out) => {
  const s = index * 4;
  const s0 = seeds[s] ?? 0;
  const s1 = seeds[s + 1] ?? 0;
  const s2 = seeds[s + 2] ?? 0;
  const s3 = seeds[s + 3] ?? 0;
  const lane = index % 3;
  const speed = (SPEEDS[lane] ?? 10) * (0.85 + s2 * 0.3);
  const x = wrap(LEFT + s0 * (RIGHT - LEFT) + t * speed, LEFT, RIGHT);
  // Denser in the middle of the stream: triangular distribution.
  const initialY = (s1 + s3 - 1) * 20 + (lane - 1) * 3;
  const y = initialY + Math.sin(x * 0.028 - t * 0.7) * 13 + Math.sin(x * 0.05 + t * 0.3) * 5;
  const edge = smoothstep(Math.min(x - LEFT, RIGHT - x) / CURRENT_EDGE_FADE);
  const o = index * POINT_STRIDE;
  out[o] = x;
  out[o + 1] = y;
  out[o + 2] = (MIN_ALPHA + (0.25 + 0.75 * s3) * (MAX_ALPHA - MIN_ALPHA) * 0.85) * edge;
};

export const current: ShapeDefinition = {
  shape: currentShape,
  // |y| <= 20 + 3 + 13 + 5 = 41.
  bounds: { minX: LEFT, maxX: RIGHT, minY: -41, maxY: 41 },
  cycle: null,
  staticTime: 6,
  maxStretch: 1.6,
};
