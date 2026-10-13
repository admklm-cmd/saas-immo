import { emptyShape, type Shape } from "./shapes";

/**
 * Pairing of the points between two shapes (docs/design-system.md §2.11.4 ter C.1): points are
 * sorted by their rank on a Hilbert curve in each shape (positions rescaled to its bounding
 * box), then paired rank for rank — no massive crossing, the flow looks organised. Computed once,
 * outside the frame loop.
 */

const ORDER = 10;
const SIDE = 1 << ORDER;

/** Index of the cell (x, y) on the Hilbert curve of `SIDE` × `SIDE` cells. */
export function hilbertIndex(x: number, y: number): number {
  let d = 0;
  let px = x;
  let py = y;
  for (let s = SIDE >> 1; s > 0; s >>= 1) {
    const rx = (px & s) > 0 ? 1 : 0;
    const ry = (py & s) > 0 ? 1 : 0;
    d += s * s * ((3 * rx) ^ ry);
    if (ry === 0) {
      if (rx === 1) {
        px = SIDE - 1 - px;
        py = SIDE - 1 - py;
      }
      const swap = px;
      px = py;
      py = swap;
    }
  }
  return d;
}

/** Point indices sorted by Hilbert rank (ties broken by depth, then index: stable). */
export function hilbertOrder(shape: Shape): Uint32Array {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < shape.count; i++) {
    x0 = Math.min(x0, shape.x[i]!);
    x1 = Math.max(x1, shape.x[i]!);
    y0 = Math.min(y0, shape.y[i]!);
    y1 = Math.max(y1, shape.y[i]!);
  }
  const wx = x1 - x0 || 1;
  const wy = y1 - y0 || 1;
  const keys = new Float64Array(shape.count);
  for (let i = 0; i < shape.count; i++) {
    const cx = Math.min(SIDE - 1, Math.floor(((shape.x[i]! - x0) / wx) * SIDE));
    const cy = Math.min(SIDE - 1, Math.floor(((shape.y[i]! - y0) / wy) * SIDE));
    // The depth is the fine tie-break (back to front), well below one Hilbert cell.
    keys[i] = hilbertIndex(cx, cy) + (shape.z[i]! + 1) * 1e-3;
  }
  const order = new Uint32Array(shape.count);
  for (let i = 0; i < shape.count; i++) order[i] = i;
  order.sort((a, b) => keys[a]! - keys[b]! || a - b);
  return order;
}

/**
 * Permutation that reorders `to` so its point i is the partner of the point i of `from`
 * (`to'[i] = to[perm[i]]`).
 */
export function pairingPermutation(from: Shape, to: Shape): Uint32Array {
  const a = hilbertOrder(from);
  const b = hilbertOrder(to);
  const perm = new Uint32Array(from.count);
  for (let rank = 0; rank < from.count; rank++) perm[a[rank]!] = b[rank]!;
  return perm;
}

export function permute(shape: Shape, perm: Uint32Array): Shape {
  const out = emptyShape(shape.count);
  for (let i = 0; i < shape.count; i++) {
    const source = perm[i]!;
    out.x[i] = shape.x[source]!;
    out.y[i] = shape.y[source]!;
    out.z[i] = shape.z[source]!;
  }
  return out;
}

/** `to` reordered to follow `from`. Both must hold the same number of points. */
export function pairShapes(from: Shape, to: Shape): Shape {
  if (from.count !== to.count) throw new Error("pairShapes: shapes must have the same number of points");
  return permute(to, pairingPermutation(from, to));
}

/** Rank of each value in 0..1 (0 = smallest); ties keep the index order. */
export function rankShare(values: ArrayLike<number>): Float32Array {
  const count = values.length;
  const order = Array.from({ length: count }, (_, i) => i).sort((a, b) => values[a]! - values[b]! || a - b);
  const out = new Float32Array(count);
  for (let rank = 0; rank < count; rank++) out[order[rank]!] = count > 1 ? rank / (count - 1) : 0;
  return out;
}
