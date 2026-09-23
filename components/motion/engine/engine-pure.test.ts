import { describe, expect, it } from "vitest";

import { SHAPES } from "../shapes";
import { POINT_STRIDE } from "../shapes/types";
import {
  backgroundBudget,
  capPixelRatio,
  computeFit,
  computeRegionFit,
  createFit,
  MAX_PARTICLES,
  nextAdaptiveCount,
  resolveParticleCount,
} from "./layout";
import { smoothstep, wrap } from "./math";
import { Morph } from "./morph";
import { createPrng, createSeeds } from "./prng";
import { projectShape } from "./project";
import { BACKGROUND_OPACITY, mapOpacity, ZONE_OPACITY } from "./renderer";

describe("math and PRNG", () => {
  it("implements the smoothstep of the spec", () => {
    expect(smoothstep(-1)).toBe(0);
    expect(smoothstep(0.5)).toBe(0.5);
    expect(smoothstep(2)).toBe(1);
  });

  it("wraps into [min, max)", () => {
    expect(wrap(125, -120, 120)).toBeCloseTo(-115);
    expect(wrap(-125, -120, 120)).toBeCloseTo(115);
  });

  it("produces a reproducible uniform sequence", () => {
    const a = createPrng(7);
    const b = createPrng(7);
    const values = Array.from({ length: 1_000 }, () => a());
    expect(values).toEqual(Array.from({ length: 1_000 }, () => b()));
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
    expect(values.reduce((sum, value) => sum + value, 0) / values.length).toBeCloseTo(0.5, 1);
  });
});

describe("fit and density", () => {
  it("fits every shape inside the zone with its padding, for desktop and mobile zones", () => {
    const fit = createFit();
    for (const [width, height] of [
      [320, 180],
      [460, 205],
      [1200, 600],
      [358, 155],
      [300, 400],
    ] as const) {
      for (const definition of Object.values(SHAPES)) {
        const { bounds } = definition;
        computeFit(bounds, definition.maxStretch, width, height, 6, fit);
        const left = (bounds.minX * fit.scaleX + fit.offsetX) * width;
        const right = (bounds.maxX * fit.scaleX + fit.offsetX) * width;
        const top = (bounds.minY * fit.scaleY + fit.offsetY) * height;
        const bottom = (bounds.maxY * fit.scaleY + fit.offsetY) * height;
        expect(left).toBeGreaterThanOrEqual(6 - 1e-6);
        expect(right).toBeLessThanOrEqual(width - 6 + 1e-6);
        expect(top).toBeGreaterThanOrEqual(6 - 1e-6);
        expect(bottom).toBeLessThanOrEqual(height - 6 + 1e-6);
        // Proportions: never stretched beyond what the shape allows.
        const ratio = (fit.scaleX * width) / (fit.scaleY * height);
        expect(Math.max(ratio, 1 / ratio)).toBeLessThanOrEqual(definition.maxStretch + 1e-6);
      }
    }
  });

  it("uses about 2 600 particles in a preview, 6 000–13 500 in a large zone, fewer on mobile", () => {
    expect(resolveParticleCount("auto", 380, 200, false)).toBe(2_600);
    expect(resolveParticleCount("auto", 600, 400, false)).toBe(6_720);
    expect(resolveParticleCount("auto", 1_400, 700, false)).toBe(MAX_PARTICLES);
    expect(resolveParticleCount("auto", 380, 200, true)).toBeLessThan(2_600);
    expect(resolveParticleCount("auto", 1_400, 700, true)).toBeLessThanOrEqual(4_000);
    expect(resolveParticleCount(50_000, 100, 100, false)).toBe(MAX_PARTICLES);
  });
});

describe("transition between presets", () => {
  const count = 1_000;
  const seeds = createSeeds(count);
  const fit = createFit();
  const frame = (preset: keyof typeof SHAPES, t: number) => {
    const out = new Float32Array(count * POINT_STRIDE);
    computeFit(SHAPES[preset].bounds, SHAPES[preset].maxStretch, 460, 205, 6, fit);
    projectShape(SHAPES[preset], count, t, seeds, fit, out);
    return out;
  };
  const distance = (a: Float32Array, b: Float32Array) => {
    let total = 0;
    for (let i = 0; i < count; i++) total += Math.hypot((a[i * 3] ?? 0) - (b[i * 3] ?? 0), (a[i * 3 + 1] ?? 0) - (b[i * 3 + 1] ?? 0));
    return total / count;
  };

  it("starts from the displayed positions, disperses deterministically and converges to the target", () => {
    const displayed = frame("sphere", 3);
    const target = frame("agents", 0.5);
    const morph = new Morph(count);
    const out = new Float32Array(count * POINT_STRIDE);
    morph.begin(displayed, count, 1_000, 850);

    expect(morph.blend(target, seeds, count, 1_000, 0.01, 0.01, out)).toBe(true);
    expect(distance(out, displayed)).toBeLessThan(1e-6);

    const middle = new Float32Array(count * POINT_STRIDE);
    morph.blend(target, seeds, count, 1_425, 0.01, 0.01, middle);
    const again = new Morph(count);
    again.begin(displayed, count, 1_000, 850);
    const replay = new Float32Array(count * POINT_STRIDE);
    again.blend(target, seeds, count, 1_425, 0.01, 0.01, replay);
    expect(replay).toEqual(middle);

    let previous = Number.POSITIVE_INFINITY;
    for (let now = 1_425; now <= 1_850; now += 85) {
      morph.blend(target, seeds, count, now, 0.01, 0.01, out);
      const remaining = distance(out, target);
      expect(remaining).toBeLessThanOrEqual(previous + 1e-9);
      previous = remaining;
    }
    expect(morph.active).toBe(false);
    expect(distance(out, target)).toBeLessThan(1e-6);
  });

  it("redirects from what is on screen towards the latest destination without a jump", () => {
    const morph = new Morph(count);
    const out = new Float32Array(count * POINT_STRIDE);
    morph.begin(frame("veil", 0), count, 0, 850);
    morph.blend(frame("sphere", 0), seeds, count, 300, 0.01, 0.01, out);
    const onScreen = out.slice();

    morph.begin(onScreen, count, 300, 850);
    const grid = frame("grid", 0);
    morph.blend(grid, seeds, count, 300, 0.01, 0.01, out);
    expect(distance(out, onScreen)).toBeLessThan(1e-6);
    morph.blend(grid, seeds, count, 1_150, 0.01, 0.01, out);
    expect(distance(out, grid)).toBeLessThan(1e-6);
  });

  it("keeps dispersed points inside the zone", () => {
    const morph = new Morph(count);
    const out = new Float32Array(count * POINT_STRIDE);
    morph.begin(frame("current", 0), count, 0, 850);
    for (let now = 0; now <= 850; now += 50) {
      morph.blend(frame("vortex", 0), seeds, count, now, 0.02, 0.03, out);
      for (let i = 0; i < count; i++) {
        expect(out[i * 3]).toBeGreaterThanOrEqual(0.02 - 1e-6);
        expect(out[i * 3]).toBeLessThanOrEqual(0.98 + 1e-6);
        expect(out[i * 3 + 1]).toBeGreaterThanOrEqual(0.03 - 1e-6);
        expect(out[i * 3 + 1]).toBeLessThanOrEqual(0.97 + 1e-6);
      }
    }
  });
});

describe("background mode (spec §9)", () => {
  it("follows the confirmed budget: 6 000 from 1 280 px, 4 000 from 768 px, 1 800 below", () => {
    expect(backgroundBudget(1_920)).toBe(6_000);
    expect(backgroundBudget(1_440)).toBe(6_000);
    expect(backgroundBudget(1_280)).toBe(6_000);
    expect(backgroundBudget(1_279)).toBe(4_000);
    expect(backgroundBudget(768)).toBe(4_000);
    expect(backgroundBudget(767)).toBe(1_800);
    expect(backgroundBudget(390)).toBe(1_800);
  });

  it("caps the device pixel ratio at 2, and at 1.5 on mobile viewports", () => {
    expect(capPixelRatio(3, 1_440)).toBe(2);
    expect(capPixelRatio(1, 1_440)).toBe(1);
    expect(capPixelRatio(3, 390)).toBe(1.5);
    expect(capPixelRatio(2, 767)).toBe(1.5);
    expect(capPixelRatio(0, 390)).toBe(1);
  });

  it("lowers the density by steps of 25 %, never below 30 % of the budget", () => {
    expect(nextAdaptiveCount(6_000, 6_000)).toBe(4_500);
    expect(nextAdaptiveCount(4_500, 6_000)).toBe(3_375);
    let count = 6_000;
    for (let step = 0; step < 20; step++) count = nextAdaptiveCount(count, 6_000);
    expect(count).toBe(1_800);
  });

  it("maps shape opacities into .08–.35 continuously, keeping 0 at 0", () => {
    expect(mapOpacity(0, BACKGROUND_OPACITY)).toBe(0);
    expect(mapOpacity(0.12, BACKGROUND_OPACITY)).toBeCloseTo(0.08);
    expect(mapOpacity(0.6, BACKGROUND_OPACITY)).toBeCloseTo(0.35);
    expect(mapOpacity(2, BACKGROUND_OPACITY)).toBeCloseTo(0.35);
    expect(mapOpacity(0.06, BACKGROUND_OPACITY)).toBeCloseTo(0.04);
    expect(mapOpacity(0.36, ZONE_OPACITY)).toBeCloseTo(0.36);
    for (let a = 0; a <= 0.6; a += 0.01) {
      expect(mapOpacity(a + 0.01, BACKGROUND_OPACITY)).toBeGreaterThanOrEqual(mapOpacity(a, BACKGROUND_OPACITY));
      expect(mapOpacity(a, BACKGROUND_OPACITY)).toBeLessThanOrEqual(0.35);
    }
  });

  it("fits a shape inside a region of the canvas, with its padding", () => {
    const fit = createFit();
    const region = { x: 0.5, y: 0.1, width: 0.45, height: 0.6 };
    for (const definition of Object.values(SHAPES)) {
      const { bounds } = definition;
      computeRegionFit(bounds, definition.maxStretch, 1_440, 900, 6, region, fit);
      expect((bounds.minX * fit.scaleX + fit.offsetX) * 1_440).toBeGreaterThanOrEqual(0.5 * 1_440 + 6 - 1e-6);
      expect((bounds.maxX * fit.scaleX + fit.offsetX) * 1_440).toBeLessThanOrEqual(0.95 * 1_440 - 6 + 1e-6);
      expect((bounds.minY * fit.scaleY + fit.offsetY) * 900).toBeGreaterThanOrEqual(0.1 * 900 + 6 - 1e-6);
      expect((bounds.maxY * fit.scaleY + fit.offsetY) * 900).toBeLessThanOrEqual(0.7 * 900 - 6 + 1e-6);
    }
  });
});
