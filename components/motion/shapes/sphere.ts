import { MAX_ALPHA, MIN_ALPHA, POINT_STRIDE, type ShapeDefinition, type ShapeFn } from "./types";

/**
 * Point on the rotating, breathing sphere of spec §4-B, for seeds (su, sv),
 * rotation time `spin` and breathing time `breath`. Writes x, y, z into out[o..o+2]
 * (z in [-1, 1], positive towards the viewer). Shared with the agents preset.
 */
export function spherePoint(su: number, sv: number, spin: number, breath: number, radiusBase: number, out: Float32Array, o: number): void {
  const theta = su * Math.PI * 2 + spin * 0.25;
  const phi = Math.acos(2 * sv - 1);
  const radius = radiusBase + Math.sin(breath * 0.8) * radiusBase * 0.06;
  const sinPhi = Math.sin(phi);
  const z = sinPhi * Math.sin(theta);
  out[o] = radius * sinPhi * Math.cos(theta);
  out[o + 1] = radius * Math.cos(phi) * 0.9 + z * radiusBase * 0.2;
  out[o + 2] = z;
}

/** Back of the sphere lighter than the front: opacity follows depth. */
export function depthAlpha(z: number): number {
  const front = (z + 1) / 2;
  return MIN_ALPHA + front * front * (MAX_ALPHA - MIN_ALPHA);
}

export const sphereShape: ShapeFn = (index, _count, t, seeds, out) => {
  const s = index * 4;
  const o = index * POINT_STRIDE;
  spherePoint(seeds[s] ?? 0, seeds[s + 1] ?? 0, t, t, 1, out, o);
  out[o + 2] = depthAlpha(out[o + 2] ?? 0);
};

export const sphere: ShapeDefinition = {
  shape: sphereShape,
  // |x| <= 1.06 ; |y| <= sqrt((1.06*.9)^2 + .2^2) < 0.98.
  bounds: { minX: -1.07, maxX: 1.07, minY: -1, maxY: 1 },
  cycle: null,
  staticTime: 1.2,
  maxStretch: 1,
};
