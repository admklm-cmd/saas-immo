/**
 * Geometry of the neural network background (docs/design-system.md §2.11.4),
 * after the user's reference (`docs/references/reseau-neuronal-demo.html`):
 * organic neurons spaced in depth, dendritic trees that thin out, sinuous
 * connections to the 3 nearest neighbours.
 *
 * Pure and deterministic: a seed and a screen class give the network, point
 * for point. Built once per class (never per frame); every array the frame
 * functions read is a typed array, so drawing allocates nothing.
 *
 * World units are those of the reference: x ∈ [-X, X] (X = NODE_X_RANGE of the
 * class), y ∈ [-1.25, 1.25], z ∈ [zMin(|x|), 1.5] (z grows away from the
 * viewer): no near neuron on the side edges (§2.11.4, « Composition centrée,
 * bords atténués »).
 */

import { packNetwork, type RawFiber } from "./network-pack";
import { createRandom, deriveSeed, type Random } from "./random";

export { fingerprint, samplePath } from "./network-pack";

export type ScreenClass = "large" | "medium" | "compact";

export type ClassBudget = {
  neurons: number;
  /** Hard caps (docs/design-system.md §2.11.4, « Budget »). */
  maxFibers: number;
  maxPoints: number;
  maxSignals: number;
};

export const CLASS_BUDGET: Record<ScreenClass, ClassBudget> = {
  large: { neurons: 34, maxFibers: 2900, maxPoints: 46000, maxSignals: 48 },
  medium: { neurons: 28, maxFibers: 2400, maxPoints: 38000, maxSignals: 40 },
  compact: { neurons: 20, maxFibers: 1700, maxPoints: 28000, maxSignals: 28 },
};

/** Points of the irregular outline of a cell body. */
export const SHAPE_POINTS = 14;
/** Midpoint displacement passes of a connection: 2^5 + 1 = 33 points. */
export const LINK_PASSES = 5;
/** Nearest neighbours each neuron connects to. */
export const NEIGHBOURS = 3;
/** Minimum spacing between two neurons, `hypot(dx, dy, 0.4 dz)`. */
export const MIN_SPACING = 0.3;
/** Branch steps per world unit (first fallback lowers it to 45, §2.11.4 « Replis »). */
export const STEP_DENSITY = 65;
/** Recursion depth of a dendritic tree (each root branch makes 1 + 2 + 4 fibers). */
const BRANCH_LEVELS = 2;
const PLACEMENT_ATTEMPTS = 20;

/** Half-width of the neuron field (world x), per class: 1.85 wide and medium (1.95 before 02/10), compact unchanged. */
export const NODE_X_RANGE: Record<ScreenClass, number> = { large: 1.85, medium: 1.85, compact: 1.95 };
/** Half-height of the neuron field (world y). */
export const NODE_Y_RANGE = 1.25;
/** Depth range of the neurons (world z, grows away from the viewer). */
export const NODE_Z_NEAR = -0.5;
export const NODE_Z_FAR = 1.5;
/** Raise of the nearest allowed depth at the side edges (fallback 0.45 if a contrast threshold falls). */
export const EDGE_DEPTH_LIFT = 0.6;
/** |x| from which the nearest allowed depth starts to rise. */
export const EDGE_DEPTH_FROM = 1;

/** Nearest allowed depth of a neuron at x: −0.5 + lift × smoothstep(1.0, X, |x|). */
export function minDepthAt(x: number, range: number, lift = EDGE_DEPTH_LIFT): number {
  const t = Math.min(1, Math.max(0, (Math.abs(x) - EDGE_DEPTH_FROM) / (range - EDGE_DEPTH_FROM)));
  return NODE_Z_NEAR + lift * t * t * (3 - 2 * t);
}

export type Network = {
  screenClass: ScreenClass;
  seed: number;
  nodeCount: number;
  nodeX: Float32Array;
  nodeY: Float32Array;
  nodeZ: Float32Array;
  nodeR: Float32Array;
  /** SHAPE_POINTS × (x, y, z) per node. */
  shape: Float32Array;

  fiberCount: number;
  /** Connections between two neurons (the last `linkCount` fibers). */
  linkCount: number;
  /** First point of each fiber, and its number of points. */
  fiberStart: Uint32Array;
  fiberSize: Uint16Array;
  fiberOwner: Int16Array;
  /** Other neuron of a connection, -1 for a dendrite or an axon. */
  fiberOther: Int16Array;
  fiberWidth: Float32Array;
  fiberEndWidth: Float32Array;
  fiberAlpha: Float32Array;
  fiberDepth: Float32Array;
  fiberLength: Float64Array;
  /** Fibers sorted from the farthest to the nearest (drawing order). */
  drawOrder: Uint32Array;

  pointCount: number;
  /** (x, y, z) per point. */
  points: Float32Array;
  /** Length of the path from the first point of its fiber, per point. */
  cumulative: Float64Array;

  /** Branches leaving a fiber (CSR: childStart[f] .. childStart[f + 1]). */
  childStart: Uint32Array;
  childFiber: Uint32Array;
  /** Distance along the parent at which the child leaves. */
  childDistance: Float64Array;

  /** Fibers a neuron can send an impulse into (CSR by node). */
  outStart: Uint32Array;
  outFiber: Uint32Array;
  /** 1 when the impulse runs the fiber backwards (connection owned by the other neuron). */
  outReverse: Uint8Array;
};

export type BuildOptions = {
  seed: number;
  screenClass: ScreenClass;
  /** Branch steps per world unit (fallback). */
  stepDensity?: number;
  /** Neuron count override (fallback « large : 34 → 30 »). */
  neurons?: number;
  /** Raise of the nearest depth on the edges (fallback 0.6 → 0.45). */
  edgeDepthLift?: number;
};

/** Builds the network of a screen class. Same options → same arrays. */
export function buildNetwork({
  seed,
  screenClass,
  stepDensity = STEP_DENSITY,
  neurons,
  edgeDepthLift = EDGE_DEPTH_LIFT,
}: BuildOptions): Network {
  const random = createRandom(deriveSeed(seed, screenClass));
  const count = neurons ?? CLASS_BUDGET[screenClass].neurons;
  const range = NODE_X_RANGE[screenClass];

  const nodeX = new Float32Array(count);
  const nodeY = new Float32Array(count);
  const nodeZ = new Float32Array(count);
  const nodeR = new Float32Array(count);
  const shape = new Float32Array(count * SHAPE_POINTS * 3);

  // Cellular tissue, not a sphere: irregular neurons in several depth planes.
  for (let i = 0; i < count; i++) {
    let x = 0;
    let y = 0;
    let z = 0;
    for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS; attempt++) {
      x = random.range(-range, range);
      y = random.range(-NODE_Y_RANGE, NODE_Y_RANGE);
      z = random.range(minDepthAt(x, range, edgeDepthLift), NODE_Z_FAR);
      let clear = true;
      for (let j = 0; j < i; j++) {
        if (Math.hypot(nodeX[j]! - x, nodeY[j]! - y, (nodeZ[j]! - z) * 0.4) <= MIN_SPACING) {
          clear = false;
          break;
        }
      }
      if (clear) break;
    }
    nodeX[i] = x;
    nodeY[i] = y;
    nodeZ[i] = z;
    const r = random.range(0.011, 0.023);
    nodeR[i] = r;
    const rotation = random.range(0, Math.PI * 2);
    for (let j = 0; j < SHAPE_POINTS; j++) {
      const angle = rotation + (j / SHAPE_POINTS) * Math.PI * 2;
      const radius = r * random.range(0.55, 1.7);
      const offset = (i * SHAPE_POINTS + j) * 3;
      shape[offset] = x + Math.cos(angle) * radius;
      shape[offset + 1] = y + Math.sin(angle) * radius * 0.75;
      shape[offset + 2] = z;
    }
  }

  const fibers: RawFiber[] = [];

  function branch(
    owner: number,
    origin: [number, number, number],
    heading: number,
    length: number,
    width: number,
    level: number,
    parent: number,
    parentPoint: number,
  ) {
    const points: number[] = [origin[0], origin[1], origin[2]];
    let [x, y, z] = origin;
    let angle = heading;
    const steps = Math.max(8, Math.round(length * stepDensity));
    const lean = random.range(-0.045, 0.045);
    const phase = random.range(0, 6);
    for (let s = 1; s <= steps; s++) {
      angle += random.range(-0.28, 0.28) + lean + Math.sin(s * 0.65 + phase) * 0.095;
      x += (Math.cos(angle) * length) / steps;
      y += (Math.sin(angle) * length) / steps;
      z += random.range(-0.016, 0.016);
      points.push(x, y, z);
    }
    const index = fibers.length;
    fibers.push({
      owner,
      other: -1,
      points,
      width,
      endWidth: width * 0.25,
      alpha: random.range(0.65, 1),
      depth: origin[2],
      parent,
      parentPoint,
    });
    if (level > 0) {
      const fork = Math.floor(steps * random.range(0.45, 0.72));
      const p = pointOf(points, fork);
      const before = pointOf(points, fork - 1);
      const tangent = Math.atan2(p[1] - before[1], p[0] - before[0]);
      const side = random.next() > 0.5 ? 1 : -1;
      branch(owner, p, tangent + side * random.range(0.55, 1.25), length * random.range(0.4, 0.65), width * 0.5, level - 1, index, fork);
      branch(owner, pointOf(points, steps), angle + random.range(-0.5, 0.5), length * random.range(0.48, 0.72), width * 0.48, level - 1, index, steps);
    }
  }

  for (let n = 0; n < count; n++) {
    const center: [number, number, number] = [nodeX[n]!, nodeY[n]!, nodeZ[n]!];
    const arms = Math.round(random.range(7, 11));
    const offset = random.range(0, 6);
    for (let j = 0; j < arms; j++) {
      branch(n, center, offset + (j / arms) * Math.PI * 2 + random.range(-0.25, 0.25), random.range(0.25, 0.56), random.range(0.8, 1.65), BRANCH_LEVELS, -1, 0);
    }
    // One longer axon gives each neuron a directional silhouette.
    branch(n, center, random.range(0, Math.PI * 2), random.range(0.7, 1.2), 1.5, BRANCH_LEVELS, -1, 0);
  }
  const dendriteCount = fibers.length;

  // Connections to the 3 nearest neighbours, each pair once: permanent,
  // irregular nerve paths (midpoint displacement).
  const seen = new Set<number>();
  const distances: { j: number; d: number }[] = [];
  for (let i = 0; i < count; i++) {
    distances.length = 0;
    for (let j = 0; j < count; j++) {
      if (j === i) continue;
      distances.push({ j, d: Math.hypot(nodeX[i]! - nodeX[j]!, nodeY[i]! - nodeY[j]!, (nodeZ[i]! - nodeZ[j]!) * 0.7) });
    }
    distances.sort((a, b) => a.d - b.d || a.j - b.j);
    for (const { j } of distances.slice(0, NEIGHBOURS)) {
      const key = Math.min(i, j) * 1024 + Math.max(i, j);
      if (seen.has(key)) continue;
      seen.add(key);
      fibers.push(linkFiber(random, i, j, nodeX, nodeY, nodeZ));
    }
  }

  return packNetwork(fibers, dendriteCount, { screenClass, seed, count, nodeX, nodeY, nodeZ, nodeR, shape });
}

function pointOf(points: readonly number[], index: number): [number, number, number] {
  return [points[index * 3]!, points[index * 3 + 1]!, points[index * 3 + 2]!];
}

function linkFiber(random: Random, a: number, b: number, nodeX: Float32Array, nodeY: Float32Array, nodeZ: Float32Array): RawFiber {
  let points: number[] = [nodeX[a]!, nodeY[a]!, nodeZ[a]!, nodeX[b]!, nodeY[b]!, nodeZ[b]!];
  for (let pass = 0; pass < LINK_PASSES; pass++) {
    const refined: number[] = [points[0]!, points[1]!, points[2]!];
    for (let k = 1; k < points.length / 3; k++) {
      const px = points[(k - 1) * 3]!;
      const py = points[(k - 1) * 3 + 1]!;
      const pz = points[(k - 1) * 3 + 2]!;
      const qx = points[k * 3]!;
      const qy = points[k * 3 + 1]!;
      const qz = points[k * 3 + 2]!;
      const size = Math.hypot(px - qx, py - qy) * 0.17;
      refined.push(
        (px + qx) / 2 + random.range(-size, size),
        (py + qy) / 2 + random.range(-size, size),
        (pz + qz) / 2 + random.range(-size * 0.5, size * 0.5),
        qx,
        qy,
        qz,
      );
    }
    points = refined;
  }
  return {
    owner: a,
    other: b,
    points,
    width: random.range(0.8, 1.9),
    endWidth: 0.65,
    alpha: 0.9,
    depth: (nodeZ[a]! + nodeZ[b]!) / 2,
    parent: -1,
    parentPoint: 0,
  };
}
