import { MAX_ALPHA, MIN_ALPHA, POINT_STRIDE, type ShapeDefinition, type ShapeFn } from "./types";

/**
 * Dashboard — fluid veil (spec §4-A), formula kept verbatim:
 * q = u*1.2 + t*.5 ; x = u*31 + sin(v*2 + q)*9 ;
 * y = v*19 + sin(q)*19 + cos(u*2 - v + t*.24)*9 ; depth = cos(q + v).
 */
export const veilShape: ShapeFn = (index, _count, t, seeds, out) => {
  const s = index * 4;
  const u = ((seeds[s] ?? 0) * 2 - 1) * 2.9;
  const v = (seeds[s + 1] ?? 0) * 2 - 1;
  const q = u * 1.2 + t * 0.5;
  const depth = Math.cos(q + v);
  const o = index * POINT_STRIDE;
  out[o] = u * 31 + Math.sin(v * 2 + q) * 9;
  out[o + 1] = v * 19 + Math.sin(q) * 19 + Math.cos(u * 2 - v + t * 0.24) * 9;
  out[o + 2] = MIN_ALPHA + ((depth + 1) / 2) * (MAX_ALPHA - MIN_ALPHA);
};

export const veil: ShapeDefinition = {
  shape: veilShape,
  // |x| <= 2.9*31 + 9 = 98.9 ; |y| <= 19 + 19 + 9 = 47.
  bounds: { minX: -99, maxX: 99, minY: -47, maxY: 47 },
  cycle: null,
  staticTime: 2.4,
  maxStretch: 1.5,
};
