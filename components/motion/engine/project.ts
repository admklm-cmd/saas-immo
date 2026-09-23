import type { ShapeDefinition } from "../shapes/types";
import { POINT_STRIDE } from "../shapes/types";
import type { Fit } from "./layout";

/**
 * Evaluates `definition` for `count` particles at time `t`, then maps the
 * points to normalised zone coordinates through `fit`. Pure and allocation-free:
 * `out` holds x, y in [0, 1] and opacity for each particle.
 */
export function projectShape(definition: ShapeDefinition, count: number, t: number, seeds: Float32Array, fit: Fit, out: Float32Array): void {
  const shape = definition.shape;
  for (let i = 0; i < count; i++) shape(i, count, t, seeds, out);
  const { scaleX, scaleY, offsetX, offsetY } = fit;
  for (let i = 0; i < count; i++) {
    const o = i * POINT_STRIDE;
    out[o] = (out[o] ?? 0) * scaleX + offsetX;
    out[o + 1] = (out[o + 1] ?? 0) * scaleY + offsetY;
  }
}
