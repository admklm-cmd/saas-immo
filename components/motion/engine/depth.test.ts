import { describe, expect, it } from "vitest";

import { BACKGROUND_LAYOUT } from "../background-layout";
import { SHAPES } from "../shapes";
import { MAX_ALPHA, MIN_ALPHA, POINT_STRIDE } from "../shapes/types";
import {
  computePlaneOffsets,
  createDepthPlanes,
  DEPTH_PLANES,
  depthInkFactor,
  PARALLAX_MAX_PX,
  PLANE_FAR,
  PLANE_MID,
  PLANE_NEAR,
  planeForDraw,
} from "./depth";
import { computeRegionFit, createFit, FULL_REGION } from "./layout";
import { createSeeds } from "./prng";
import { projectShape } from "./project";
import { BACKGROUND_OPACITY, mapOpacity, planeOpacity, planeSize } from "./renderer";

/** The flat background range before 26/09/2026, to measure the visibility gain. */
const OLD_BACKGROUND = { min: 0.08, max: 0.35 };

describe("depth planes of the background (26/09/2026)", () => {
  it("defines three planes whose shares sum to 1, from far to near", () => {
    expect(DEPTH_PLANES.map((plane) => plane.name)).toEqual(["far", "mid", "near"]);
    expect(DEPTH_PLANES.reduce((sum, plane) => sum + plane.share, 0)).toBeCloseTo(1, 10);
    // Near: bigger, more opaque, widest drift. Far: smaller, paler, calmest.
    const [far, mid, near] = DEPTH_PLANES;
    expect(far.size).toBeLessThan(mid.size);
    expect(mid.size).toBeLessThan(near.size);
    expect(far.opacity).toBeLessThan(mid.opacity);
    expect(mid.opacity).toBeLessThan(near.opacity);
    expect(near.opacity).toBe(1);
    expect(far.drift).toBeLessThan(mid.drift);
    expect(mid.drift).toBeLessThan(near.drift);
  });

  it("assigns a plane from a uniform draw at the declared boundaries", () => {
    expect(planeForDraw(0)).toBe(PLANE_FAR);
    expect(planeForDraw(0.399)).toBe(PLANE_FAR);
    expect(planeForDraw(0.4)).toBe(PLANE_MID);
    expect(planeForDraw(0.749)).toBe(PLANE_MID);
    expect(planeForDraw(0.75)).toBe(PLANE_NEAR);
    expect(planeForDraw(0.999)).toBe(PLANE_NEAR);
  });

  it("is deterministic, independent of the capacity and close to the declared shares", () => {
    const a = createDepthPlanes(6_000);
    const b = createDepthPlanes(13_500);
    expect(Array.from(a)).toEqual(Array.from(b.subarray(0, 6_000)));
    const counts = [0, 0, 0];
    for (const plane of a) counts[plane] = (counts[plane] ?? 0) + 1;
    DEPTH_PLANES.forEach((plane, index) => expect((counts[index] ?? 0) / a.length).toBeCloseTo(plane.share, 1));
    // A different seed gives a different (but valid) distribution.
    expect(Array.from(createDepthPlanes(200, 1))).not.toEqual(Array.from(a.subarray(0, 200)));
  });

  it("never exceeds the output ceiling, and pales towards the far plane", () => {
    for (let alpha = 0; alpha <= 1; alpha += 0.02) {
      const near = planeOpacity(alpha, BACKGROUND_OPACITY, PLANE_NEAR);
      const mid = planeOpacity(alpha, BACKGROUND_OPACITY, PLANE_MID);
      const far = planeOpacity(alpha, BACKGROUND_OPACITY, PLANE_FAR);
      expect(near).toBeLessThanOrEqual(BACKGROUND_OPACITY.max);
      expect(mid).toBeLessThanOrEqual(near);
      expect(far).toBeLessThanOrEqual(mid);
    }
    expect(planeOpacity(MAX_ALPHA, BACKGROUND_OPACITY, PLANE_NEAR)).toBeCloseTo(0.46);
    expect(planeOpacity(0.3, BACKGROUND_OPACITY, null)).toBe(mapOpacity(0.3, BACKGROUND_OPACITY));
    expect(planeSize(null)).toBe(1);
    expect(planeSize(PLANE_NEAR)).toBeGreaterThan(planeSize(PLANE_FAR));
  });

  it("raises the ink (opacity x area) of the background by about 30 %", () => {
    const seeds = createSeeds(6_000);
    const planes = createDepthPlanes(6_000);
    let before = 0;
    let after = 0;
    for (let i = 0; i < 6_000; i++) {
      const alpha = MIN_ALPHA + (seeds[i * 4] ?? 0) * (MAX_ALPHA - MIN_ALPHA);
      const size = 0.55 + (seeds[i * 4 + 2] ?? 0) * 0.55;
      const plane = planes[i] ?? 0;
      before += mapOpacity(alpha, OLD_BACKGROUND) * size * size;
      const depthSize = size * planeSize(plane);
      after += planeOpacity(alpha, BACKGROUND_OPACITY, plane) * depthSize * depthSize;
    }
    const gain = after / before;
    expect(gain).toBeGreaterThan(1.2);
    expect(gain).toBeLessThan(1.45);
    expect(depthInkFactor()).toBeGreaterThan(0.95);
    expect(depthInkFactor()).toBeLessThan(1.1);
  });

  it("offsets each plane along the same path, the near plane the most, within the drift budget", () => {
    const offsets = new Float32Array(6);
    let maxNear = 0;
    for (let t = 0; t < 120; t += 0.5) {
      computePlaneOffsets(t, 1_440, 900, offsets);
      const [farX, farY, midX, midY, nearX, nearY] = Array.from(offsets) as [number, number, number, number, number, number];
      expect(Math.abs(nearX) * 1_440).toBeLessThanOrEqual(PARALLAX_MAX_PX + 1e-3);
      expect(Math.abs(nearY) * 900).toBeLessThanOrEqual(PARALLAX_MAX_PX + 1e-3);
      expect(Math.abs(farX)).toBeLessThanOrEqual(Math.abs(midX) + 1e-9);
      expect(Math.abs(midX)).toBeLessThanOrEqual(Math.abs(nearX) + 1e-9);
      expect(Math.abs(farY)).toBeLessThanOrEqual(Math.abs(midY) + 1e-9);
      expect(Math.abs(midY)).toBeLessThanOrEqual(Math.abs(nearY) + 1e-9);
      maxNear = Math.max(maxNear, Math.abs(nearX) * 1_440);
    }
    // The sway is perceptible (several px), never a jolt.
    expect(maxNear).toBeGreaterThan(PARALLAX_MAX_PX * 0.8);
    // Frozen time (reduced motion) gives a frozen offset.
    const a = Array.from(computePlaneOffsets(2.4, 1_440, 900, new Float32Array(6)));
    const b = Array.from(computePlaneOffsets(2.4, 1_440, 900, new Float32Array(6)));
    expect(a).toEqual(b);
  });

  it("keeps every point of every shape on the full-viewport canvas with the parallax padding", () => {
    const count = 2_000;
    const seeds = createSeeds(count);
    const planes = createDepthPlanes(count);
    const offsets = new Float32Array(6);
    const out = new Float32Array(count * POINT_STRIDE);
    const fit = createFit();
    const [width, height] = [1_440, 900];
    for (const definition of Object.values(SHAPES)) {
      computeRegionFit(definition.bounds, definition.maxStretch, width, height, 6 + PARALLAX_MAX_PX, FULL_REGION, fit);
      for (const t of [0, 3.7, 9.1, 16.5]) {
        computePlaneOffsets(t, width, height, offsets);
        projectShape(definition, count, t, seeds, fit, out, { planes, offsets });
        for (let i = 0; i < count; i++) {
          const x = (out[i * POINT_STRIDE] ?? 0) * width;
          const y = (out[i * POINT_STRIDE + 1] ?? 0) * height;
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(width);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThanOrEqual(height);
        }
      }
    }
  });

  it("uses the full viewport as the background region on every viewport class", () => {
    for (const layout of Object.values(BACKGROUND_LAYOUT)) expect(layout.region).toEqual(FULL_REGION);
  });
});
