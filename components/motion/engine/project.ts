import type { ShapeDefinition } from "../shapes/types";
import { POINT_STRIDE } from "../shapes/types";
import type { Fit } from "./layout";

/** Depth planes of the background mode: one plane per particle, one normalised dx, dy per plane. */
export type ProjectionDepth = { planes: Uint8Array; offsets: Float32Array };

/**
 * Evaluates `definition` for `count` particles at time `t`, then maps the
 * points to normalised zone coordinates through `fit`. With `depth`, each
 * point is shifted by the parallax offset of its plane. Pure and
 * allocation-free: `out` holds x, y in [0, 1] and opacity for each particle.
 */
export function projectShape(
  definition: ShapeDefinition,
  count: number,
  t: number,
  seeds: Float32Array,
  fit: Fit,
  out: Float32Array,
  depth: ProjectionDepth | null = null,
): void {
  const shape = definition.shape;
  for (let i = 0; i < count; i++) shape(i, count, t, seeds, out);
  const { scaleX, scaleY, offsetX, offsetY } = fit;
  if (depth) {
    const { planes, offsets } = depth;
    for (let i = 0; i < count; i++) {
      const o = i * POINT_STRIDE;
      const p = (planes[i] ?? 0) * 2;
      out[o] = (out[o] ?? 0) * scaleX + offsetX + (offsets[p] ?? 0);
      out[o + 1] = (out[o + 1] ?? 0) * scaleY + offsetY + (offsets[p + 1] ?? 0);
    }
    return;
  }
  for (let i = 0; i < count; i++) {
    const o = i * POINT_STRIDE;
    out[o] = (out[o] ?? 0) * scaleX + offsetX;
    out[o + 1] = (out[o + 1] ?? 0) * scaleY + offsetY;
  }
}
