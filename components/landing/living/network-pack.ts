/**
 * Packing of the neural network geometry into typed arrays, and the two
 * reads the frame functions make of it (docs/design-system.md §2.11.4):
 * sampling a point along a path, and a fingerprint of the geometry. Split
 * from network.ts (generation) to keep each file short.
 */

import type { Network, ScreenClass } from "./network";

/** A fiber as generated, before packing. */
export type RawFiber = {
  owner: number;
  other: number;
  /** x, y, z per point. */
  points: number[];
  width: number;
  endWidth: number;
  alpha: number;
  depth: number;
  /** Parent fiber and point index the fiber starts from (dendrites only, else -1). */
  parent: number;
  parentPoint: number;
};

export type PackedNodes = Pick<Network, "nodeX" | "nodeY" | "nodeZ" | "nodeR" | "shape"> & {
  screenClass: ScreenClass;
  seed: number;
  count: number;
};

export function packNetwork(fibers: RawFiber[], dendriteCount: number, nodes: PackedNodes): Network {
  const fiberCount = fibers.length;
  let pointCount = 0;
  for (const fiber of fibers) pointCount += fiber.points.length / 3;

  const points = new Float32Array(pointCount * 3);
  const cumulative = new Float64Array(pointCount);
  const fiberStart = new Uint32Array(fiberCount);
  const fiberSize = new Uint16Array(fiberCount);
  const fiberOwner = new Int16Array(fiberCount);
  const fiberOther = new Int16Array(fiberCount);
  const fiberWidth = new Float32Array(fiberCount);
  const fiberEndWidth = new Float32Array(fiberCount);
  const fiberAlpha = new Float32Array(fiberCount);
  const fiberDepth = new Float32Array(fiberCount);
  const fiberLength = new Float64Array(fiberCount);

  let cursor = 0;
  fibers.forEach((fiber, f) => {
    const size = fiber.points.length / 3;
    fiberStart[f] = cursor;
    fiberSize[f] = size;
    fiberOwner[f] = fiber.owner;
    fiberOther[f] = fiber.other;
    fiberWidth[f] = fiber.width;
    fiberEndWidth[f] = fiber.endWidth;
    fiberAlpha[f] = fiber.alpha;
    fiberDepth[f] = fiber.depth;
    let length = 0;
    for (let i = 0; i < size; i++) {
      const at = (cursor + i) * 3;
      points[at] = fiber.points[i * 3]!;
      points[at + 1] = fiber.points[i * 3 + 1]!;
      points[at + 2] = fiber.points[i * 3 + 2]!;
      if (i > 0) {
        // Lengths are measured on the stored (float32) points: an impulse
        // sampled at a distance always lands on the drawn path.
        length += Math.hypot(points[at]! - points[at - 3]!, points[at + 1]! - points[at - 2]!, points[at + 2]! - points[at - 1]!);
      }
      cumulative[cursor + i] = length;
    }
    fiberLength[f] = length;
    cursor += size;
  });

  // Branch table: where each child leaves its parent.
  const childCounts = new Uint32Array(fiberCount + 1);
  for (const fiber of fibers) if (fiber.parent >= 0) childCounts[fiber.parent + 1] = childCounts[fiber.parent + 1]! + 1;
  const childStart = new Uint32Array(fiberCount + 1);
  for (let f = 0; f < fiberCount; f++) childStart[f + 1] = childStart[f]! + childCounts[f + 1]!;
  const childFiber = new Uint32Array(childStart[fiberCount]!);
  const childDistance = new Float64Array(childStart[fiberCount]!);
  const childFill = childStart.slice(0, fiberCount);
  fibers.forEach((fiber, f) => {
    if (fiber.parent < 0) return;
    const slot = childFill[fiber.parent]!;
    childFill[fiber.parent] = slot + 1;
    childFiber[slot] = f;
    childDistance[slot] = cumulative[fiberStart[fiber.parent]! + fiber.parentPoint]!;
  });

  // Fibers leaving each neuron: its root dendrites and axon, and both ends of its connections.
  const outLists: { fiber: number; reverse: number }[][] = Array.from({ length: nodes.count }, () => []);
  fibers.forEach((fiber, f) => {
    if (fiber.other >= 0) {
      outLists[fiber.owner]!.push({ fiber: f, reverse: 0 });
      outLists[fiber.other]!.push({ fiber: f, reverse: 1 });
    } else if (fiber.parent < 0) {
      outLists[fiber.owner]!.push({ fiber: f, reverse: 0 });
    }
  });
  const outStart = new Uint32Array(nodes.count + 1);
  outLists.forEach((list, n) => {
    outStart[n + 1] = outStart[n]! + list.length;
  });
  const outFiber = new Uint32Array(outStart[nodes.count]!);
  const outReverse = new Uint8Array(outStart[nodes.count]!);
  outLists.forEach((list, n) => {
    list.forEach((entry, k) => {
      outFiber[outStart[n]! + k] = entry.fiber;
      outReverse[outStart[n]! + k] = entry.reverse;
    });
  });

  const drawOrder = Uint32Array.from({ length: fiberCount }, (_, f) => f).sort(
    (a, b) => fiberDepth[b]! - fiberDepth[a]! || a - b,
  );

  return {
    screenClass: nodes.screenClass,
    seed: nodes.seed,
    nodeCount: nodes.count,
    nodeX: nodes.nodeX,
    nodeY: nodes.nodeY,
    nodeZ: nodes.nodeZ,
    nodeR: nodes.nodeR,
    shape: nodes.shape,
    fiberCount,
    linkCount: fiberCount - dendriteCount,
    fiberStart,
    fiberSize,
    fiberOwner,
    fiberOther,
    fiberWidth,
    fiberEndWidth,
    fiberAlpha,
    fiberDepth,
    fiberLength,
    drawOrder,
    pointCount,
    points,
    cumulative,
    childStart,
    childFiber,
    childDistance,
    outStart,
    outFiber,
    outReverse,
  };
}

/**
 * Point at `distance` along a fiber, written into `out` (x, y, z). Binary
 * search on the cumulative lengths, then interpolation between two points:
 * the head of an impulse never leaves the path. No allocation.
 */
export function samplePath(network: Network, fiber: number, distance: number, out: Float32Array | Float64Array): void {
  const start = network.fiberStart[fiber]!;
  const size = network.fiberSize[fiber]!;
  const length = network.fiberLength[fiber]!;
  const d = distance < 0 ? 0 : distance > length ? length : distance;
  let lo = 1;
  let hi = size - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (network.cumulative[start + mid]! < d) lo = mid + 1;
    else hi = mid;
  }
  const a = start + lo - 1;
  const before = network.cumulative[a]!;
  const span = network.cumulative[a + 1]! - before;
  const t = span > 0 ? (d - before) / span : 0;
  const p = network.points;
  out[0] = p[a * 3]! + (p[a * 3 + 3]! - p[a * 3]!) * t;
  out[1] = p[a * 3 + 1]! + (p[a * 3 + 4]! - p[a * 3 + 1]!) * t;
  out[2] = p[a * 3 + 2]! + (p[a * 3 + 5]! - p[a * 3 + 2]!) * t;
}

/** Short fingerprint of a network (tests: « same geometry » after a resize). */
export function fingerprint(network: Network): string {
  let hash = 0x811c9dc5;
  const view = new Uint32Array(network.points.buffer, network.points.byteOffset, network.points.length);
  for (let i = 0; i < view.length; i += 7) {
    hash ^= view[i]!;
    hash = Math.imul(hash, 0x01000193);
  }
  return `${network.screenClass}:${network.nodeCount}:${network.fiberCount}:${network.pointCount}:${(hash >>> 0).toString(16)}`;
}
