/** Polylines the nanorobots follow (normalised units). Pure helpers. */

/** Length of a polyline (normalised units). */
export function railLength(rail: readonly (readonly [number, number])[]): number {
  let length = 0;
  for (let k = 1; k < rail.length; k++) length += Math.hypot(rail[k]![0] - rail[k - 1]![0], rail[k]![1] - rail[k - 1]![1]);
  return length;
}

/** Point at the arc length `s` along a polyline (clamped), written into `out`. */
export function pointOnRail(rail: readonly (readonly [number, number])[], s: number, out: { x: number; y: number }): { x: number; y: number } {
  let left = Math.max(0, s);
  for (let k = 1; k < rail.length; k++) {
    const dx = rail[k]![0] - rail[k - 1]![0];
    const dy = rail[k]![1] - rail[k - 1]![1];
    const length = Math.hypot(dx, dy);
    if (left <= length || k === rail.length - 1) {
      const f = length === 0 ? 0 : Math.min(1, left / length);
      out.x = rail[k - 1]![0] + dx * f;
      out.y = rail[k - 1]![1] + dy * f;
      return out;
    }
    left -= length;
  }
  return out;
}
