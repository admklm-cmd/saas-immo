import { describe, expect, it } from "vitest";

import { createProjector, poseFromProgress, projectInto, setProjector } from "./camera";
import { buildNetwork, CLASS_BUDGET, fingerprint, LINK_PASSES, MIN_SPACING, samplePath, SHAPE_POINTS, type Network, type ScreenClass } from "./network";
import { createRandom, DEFAULT_SEED } from "./random";

const CLASSES: ScreenClass[] = ["large", "medium", "compact"];
const networks = Object.fromEntries(CLASSES.map((screenClass) => [screenClass, buildNetwork({ seed: DEFAULT_SEED, screenClass })])) as Record<ScreenClass, Network>;

describe("seeded randomness", () => {
  it("repeats the same draws for the same seed, and differs for another", () => {
    const a = createRandom(7);
    const b = createRandom(7);
    const c = createRandom(8);
    const first = Array.from({ length: 5 }, () => a.next());
    expect(Array.from({ length: 5 }, () => b.next())).toEqual(first);
    expect(Array.from({ length: 5 }, () => c.next())).not.toEqual(first);
    for (const value of first) expect(value >= 0 && value < 1).toBe(true);
  });
});

describe("network: determinism", () => {
  it("gives the same points for the same seed and class, other points for another seed", () => {
    for (const screenClass of CLASSES) {
      const again = buildNetwork({ seed: DEFAULT_SEED, screenClass });
      expect(Array.from(again.points)).toEqual(Array.from(networks[screenClass].points));
      expect(fingerprint(again)).toBe(fingerprint(networks[screenClass]));
    }
    const other = buildNetwork({ seed: DEFAULT_SEED + 1, screenClass: "large" });
    expect(fingerprint(other)).not.toBe(fingerprint(networks.large));
  });
});

describe("network: budget", () => {
  it("has 34 / 28 / 20 neurons, 7 × Σ (branches + 1) dendritic fibers, ≤ 3 N connections without duplicate, under the caps", () => {
    const expected = { large: 34, medium: 28, compact: 20 } as const;
    for (const screenClass of CLASSES) {
      const network = networks[screenClass];
      const budget = CLASS_BUDGET[screenClass];
      expect(network.nodeCount).toBe(expected[screenClass]);

      // Root fibers of each neuron = branches + axon; each one is a tree of 7 fibers.
      let roots = 0;
      for (let n = 0; n < network.nodeCount; n++) {
        let own = 0;
        for (let o = network.outStart[n]!; o < network.outStart[n + 1]!; o++) if (network.fiberOther[network.outFiber[o]!]! < 0) own++;
        expect(own - 1).toBeGreaterThanOrEqual(7);
        expect(own - 1).toBeLessThanOrEqual(11);
        roots += own;
      }
      const dendrites = network.fiberCount - network.linkCount;
      expect(dendrites).toBe(7 * roots);

      expect(network.linkCount).toBeLessThanOrEqual(3 * network.nodeCount);
      const pairs = new Set<string>();
      for (let f = network.fiberCount - network.linkCount; f < network.fiberCount; f++) {
        const a = network.fiberOwner[f]!;
        const b = network.fiberOther[f]!;
        expect(b).toBeGreaterThanOrEqual(0);
        pairs.add(`${Math.min(a, b)}-${Math.max(a, b)}`);
      }
      expect(pairs.size).toBe(network.linkCount);

      expect(network.fiberCount).toBeLessThanOrEqual(budget.maxFibers);
      expect(network.pointCount).toBeLessThanOrEqual(budget.maxPoints);
    }
  });
});

describe("network: spacing", () => {
  it("keeps every pair of neurons more than 0.30 apart (hypot(dx, dy, 0.4 dz)) in the three classes", () => {
    for (const screenClass of CLASSES) {
      const network = networks[screenClass];
      let minimum = Infinity;
      for (let i = 0; i < network.nodeCount; i++) {
        for (let j = i + 1; j < network.nodeCount; j++) {
          minimum = Math.min(
            minimum,
            Math.hypot(network.nodeX[i]! - network.nodeX[j]!, network.nodeY[i]! - network.nodeY[j]!, 0.4 * (network.nodeZ[i]! - network.nodeZ[j]!)),
          );
        }
      }
      expect(minimum, screenClass).toBeGreaterThan(MIN_SPACING);
    }
  });
});

describe("network: coverage (spaced neurons, not a carpet)", () => {
  const cases = [
    { screenClass: "large" as const, width: 1440, height: 900, cols: 3, rows: 3 },
    { screenClass: "compact" as const, width: 390, height: 844, cols: 2, rows: 3 },
  ];
  for (const { screenClass, width, height, cols, rows } of cases) {
    it(`${width} × ${height}: a body in every cell of a ${cols} × ${rows} grid at p = 0, 0.5, 1`, () => {
      const network = networks[screenClass];
      const out = new Float64Array(4);
      for (const progress of [0, 0.5, 1]) {
        const pose = poseFromProgress(progress);
        const projector = setProjector(createProjector(), pose.yaw, pose.pitch, width, height, screenClass);
        const cells = new Array<number>(cols * rows).fill(0);
        for (let n = 0; n < network.nodeCount; n++) {
          projectInto(projector, network.nodeX[n]!, network.nodeY[n]!, network.nodeZ[n]!, out, 0);
          const cx = Math.floor(out[0]! / (width / cols));
          const cy = Math.floor(out[1]! / (height / rows));
          if (cx >= 0 && cx < cols && cy >= 0 && cy < rows) cells[cy * cols + cx]! += 1;
        }
        expect(cells.every((count) => count > 0), `p = ${progress}: ${cells.join(",")}`).toBe(true);
      }
    });
  }

  it("1440 × 900: every 240 × 240 px tile is crossed by a fiber at p = 0, 0.5, 1", () => {
    const network = networks.large;
    const out = new Float64Array(4);
    for (const progress of [0, 0.5, 1]) {
      const pose = poseFromProgress(progress);
      const projector = setProjector(createProjector(), pose.yaw, pose.pitch, 1440, 900, "large");
      const tiles = new Array<number>(6 * 4).fill(0);
      for (let i = 0; i < network.pointCount; i++) {
        projectInto(projector, network.points[i * 3]!, network.points[i * 3 + 1]!, network.points[i * 3 + 2]!, out, 0);
        const tx = Math.floor(out[0]! / 240);
        const ty = Math.floor(out[1]! / 240);
        if (tx >= 0 && tx < 6 && ty >= 0 && ty < 4) tiles[ty * 6 + tx]! += 1;
      }
      expect(tiles.every((count) => count > 0), `p = ${progress}`).toBe(true);
    }
  });
});

describe("network: shape", () => {
  const network = networks.large;

  it("branches have ≥ 8 steps and end at 0.25 × their width; connections have 2⁵ + 1 points; bodies 14 points", () => {
    const dendrites = network.fiberCount - network.linkCount;
    for (let f = 0; f < dendrites; f++) {
      expect(network.fiberSize[f]! - 1).toBeGreaterThanOrEqual(8);
      expect(network.fiberEndWidth[f]).toBeCloseTo(network.fiberWidth[f]! * 0.25, 5);
    }
    for (let f = dendrites; f < network.fiberCount; f++) {
      expect(network.fiberSize[f]).toBe(2 ** LINK_PASSES + 1);
      expect(network.fiberEndWidth[f]).toBeCloseTo(0.65, 5);
    }
    expect(network.shape.length).toBe(network.nodeCount * SHAPE_POINTS * 3);
    expect(SHAPE_POINTS).toBe(14);
  });

  it("connections run from one neuron centre to the other; children leave from a point of their parent", () => {
    for (let f = network.fiberCount - network.linkCount; f < network.fiberCount; f++) {
      const start = network.fiberStart[f]!;
      const end = start + network.fiberSize[f]! - 1;
      const owner = network.fiberOwner[f]!;
      const other = network.fiberOther[f]!;
      expect(network.points[start * 3]).toBe(network.nodeX[owner]);
      expect(network.points[end * 3 + 1]).toBe(network.nodeY[other]);
    }
    const out = new Float64Array(3);
    for (let parent = 0; parent < network.fiberCount; parent++) {
      for (let c = network.childStart[parent]!; c < network.childStart[parent + 1]!; c++) {
        const child = network.childFiber[c]!;
        samplePath(network, parent, network.childDistance[c]!, out);
        const first = network.fiberStart[child]! * 3;
        expect(Math.hypot(out[0]! - network.points[first]!, out[1]! - network.points[first + 1]!, out[2]! - network.points[first + 2]!)).toBeLessThan(1e-6);
      }
    }
  });
});
