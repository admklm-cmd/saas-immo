import { describe, expect, it } from "vitest";

import { poseFromProgress } from "./camera";
import { CENTER_OFFSET_CAP, centerOffset, EDGE_FADE, EDGE_FADE_BAND, edgeFade, edgeFadeAt, inkProfile } from "./composition";
import { buildNetwork, EDGE_DEPTH_LIFT, minDepthAt, NODE_X_RANGE, NODE_Z_FAR, type Network, type ScreenClass } from "./network";
import { DEFAULT_SEED } from "./random";

/** Centred composition, softened sides (docs/design-system.md §2.11.4; criterion §2.11.7 n° 7 bis). */

const SCREENS: { width: number; height: number; screenClass: ScreenClass }[] = [
  { width: 1440, height: 900, screenClass: "large" },
  { width: 1280, height: 800, screenClass: "large" },
  { width: 1024, height: 768, screenClass: "medium" },
  { width: 390, height: 844, screenClass: "compact" },
];
const networks = new Map<ScreenClass, Network>();
function networkOf(screenClass: ScreenClass): Network {
  let network = networks.get(screenClass);
  if (!network) {
    network = buildNetwork({ seed: DEFAULT_SEED, screenClass });
    networks.set(screenClass, network);
  }
  return network;
}

describe("edge fade f(u)", () => {
  it("is 0.80 at the edge, 1 from 15 % of W inwards, and increasing in between", () => {
    expect(EDGE_FADE).toBe(0.2);
    expect(EDGE_FADE_BAND).toBe(0.15);
    expect(edgeFade(0)).toBeCloseTo(0.8, 10);
    expect(edgeFade(-0.1)).toBeCloseTo(0.8, 10);
    for (const u of [0.15, 0.2, 0.5]) expect(edgeFade(u)).toBe(1);
    let previous = edgeFade(0);
    for (let u = 0.005; u <= 0.15; u += 0.005) {
      const value = edgeFade(u);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
    // Symmetric: by the distance to the nearest side edge.
    expect(edgeFadeAt(10, 1440)).toBeCloseTo(edgeFadeAt(1430, 1440), 10);
    expect(edgeFadeAt(720, 1440)).toBe(1);
  });
});

describe("placement: narrower field, no near neuron on the side edges", () => {
  it("draws x in ± 1.85 (wide, medium), ± 1.95 (compact), z ≥ zMin(|x|), and no z < 0.1 for |x| ≥ X", () => {
    expect(NODE_X_RANGE).toEqual({ large: 1.85, medium: 1.85, compact: 1.95 });
    expect(EDGE_DEPTH_LIFT).toBe(0.6);
    expect(minDepthAt(0.9, 1.85)).toBe(-0.5);
    expect(minDepthAt(1.85, 1.85)).toBeCloseTo(0.1, 10);
    for (const screenClass of ["large", "medium", "compact"] as const) {
      const network = networkOf(screenClass);
      const range = NODE_X_RANGE[screenClass];
      for (let n = 0; n < network.nodeCount; n++) {
        const x = network.nodeX[n]!;
        const z = network.nodeZ[n]!;
        expect(Math.abs(x)).toBeLessThanOrEqual(range + 1e-6);
        expect(z).toBeGreaterThanOrEqual(minDepthAt(x, range) - 1e-6);
        expect(z).toBeLessThanOrEqual(NODE_Z_FAR);
        if (Math.abs(x) >= range - 1e-6) expect(z).toBeGreaterThanOrEqual(0.1 - 1e-6);
      }
    }
  });
});

describe("recentring and side bands (criterion 7 bis)", () => {
  for (const { width, height, screenClass } of SCREENS) {
    it(`${width} × ${height}: centre of mass in [0.47, 0.53] W, side bands 8–20 %, extreme deciles ≥ 3 %`, () => {
      const network = networkOf(screenClass);
      const offset = centerOffset(network, width, height, screenClass);
      // Deterministic and capped.
      expect(centerOffset(network, width, height, screenClass)).toBe(offset);
      expect(Math.abs(offset)).toBeLessThanOrEqual(CENTER_OFFSET_CAP * width + 1e-9);

      const ink = inkProfile(network, width, height, screenClass, { offsetX: offset });
      expect(ink.center).toBeGreaterThanOrEqual(0.47);
      expect(ink.center).toBeLessThanOrEqual(0.53);
      const left = (ink.deciles[0]! + ink.deciles[1]!) / ink.total;
      const right = (ink.deciles[8]! + ink.deciles[9]!) / ink.total;
      for (const band of [left, right]) {
        expect(band).toBeLessThanOrEqual(0.2);
        expect(band).toBeGreaterThanOrEqual(0.08);
      }
      // The edges stay inhabited, lighter.
      expect(ink.deciles[0]! / ink.total).toBeGreaterThanOrEqual(0.03);
      expect(ink.deciles[9]! / ink.total).toBeGreaterThanOrEqual(0.03);

      // Top and bottom of the page: the yaw still turns the composition, around the centre.
      for (const progress of [0, 1]) {
        const posed = inkProfile(network, width, height, screenClass, { pose: poseFromProgress(progress), offsetX: offset });
        expect(posed.center, `p = ${progress}`).toBeGreaterThanOrEqual(0.42);
        expect(posed.center, `p = ${progress}`).toBeLessThanOrEqual(0.58);
      }
    });
  }

  it("is capped at 10 % of W", () => {
    const network = networkOf("large");
    expect(Math.abs(centerOffset(network, 1440, 900, "large", { cap: 0.001 }))).toBeLessThanOrEqual(1.44 + 1e-9);
  });
});
