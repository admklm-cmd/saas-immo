import { describe, expect, it } from "vitest";

import { MAX_PARTICLES } from "../engine/layout";
import { createSeeds } from "../engine/prng";
import { AGENTS_CYCLE, agentFormPoint, agentsSplit } from "./agents";
import { CURRENT_EDGE_FADE } from "./current";
import { PARTICLE_PRESETS, POINT_STRIDE, SHAPES, type ParticlePreset } from "./index";
import { MAX_ALPHA } from "./types";
import { reliefAmplitude, terrainHeight, VORTEX_CYCLE, VORTEX_INNER_RADIUS, VORTEX_TILT, vortexMorph } from "./vortex";

/** Outline and empty centre of a vortex frame, measured on the particles actually drawn. */
function vortexOutline(t: number): { halfWidth: number; hole: number } {
  const out = evaluate("vortex", t);
  let halfWidth = 0;
  let hole = Number.POSITIVE_INFINITY;
  for (let i = 0; i < COUNT; i++) {
    const x = at(out, i * POINT_STRIDE);
    const y = at(out, i * POINT_STRIDE + 1);
    halfWidth = Math.max(halfWidth, Math.abs(x));
    // The vortex and the terrain disk share the same centre (0, 0).
    hole = Math.min(hole, Math.hypot(x, y / VORTEX_TILT));
  }
  return { halfWidth, hole };
}

const COUNT = 2_600;
const seeds = createSeeds(COUNT);
const fullSeeds = createSeeds(MAX_PARTICLES);

function evaluate(preset: ParticlePreset, t: number, count = COUNT, seedBuffer = seeds): Float32Array {
  const out = new Float32Array(count * POINT_STRIDE);
  const { shape } = SHAPES[preset];
  for (let i = 0; i < count; i++) shape(i, count, t, seedBuffer, out);
  return out;
}

function at(buffer: Float32Array, index: number): number {
  return buffer[index] ?? Number.NaN;
}

/** Time span covering a full loop (or a long stretch for endless drifts). */
function span(preset: ParticlePreset): number {
  return SHAPES[preset].cycle ?? 40;
}

describe("determinism and identity", () => {
  it("gives the same positions for the same seed, and different ones for another seed", () => {
    for (const preset of PARTICLE_PRESETS) {
      expect(evaluate(preset, 7.3)).toEqual(evaluate(preset, 7.3));
      if (preset !== "grid") expect(evaluate(preset, 7.3, COUNT, createSeeds(COUNT, 42))).not.toEqual(evaluate(preset, 7.3));
    }
  });

  it("keeps each particle's seeds whatever the buffer capacity", () => {
    expect(createSeeds(13_500).subarray(0, COUNT * 4)).toEqual(seeds);
  });

  it("computes a particle from its own index only (stable identity)", () => {
    for (const preset of PARTICLE_PRESETS) {
      const batch = evaluate(preset, 9.1);
      const single = new Float32Array(COUNT * POINT_STRIDE);
      for (const index of [0, 1, 2, 3, 517, COUNT - 1]) {
        SHAPES[preset].shape(index, COUNT, 9.1, seeds, single);
        for (let k = 0; k < POINT_STRIDE; k++) expect(at(single, index * POINT_STRIDE + k)).toBe(at(batch, index * POINT_STRIDE + k));
      }
    }
  });
});

describe("bounds", () => {
  it.each(PARTICLE_PRESETS)("%s keeps every point inside its declared bounds over the whole cycle, at full density", (preset) => {
    const { bounds } = SHAPES[preset];
    const reach = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minAlpha: Infinity, maxAlpha: -Infinity };
    const out = new Float32Array(MAX_PARTICLES * POINT_STRIDE);
    const { shape } = SHAPES[preset];
    for (let t = 0; t <= span(preset); t += 0.1) {
      for (let i = 0; i < MAX_PARTICLES; i++) {
        shape(i, MAX_PARTICLES, t, fullSeeds, out);
        const o = i * POINT_STRIDE;
        const x = at(out, o);
        const y = at(out, o + 1);
        const alpha = at(out, o + 2);
        if (x < reach.minX) reach.minX = x;
        if (x > reach.maxX) reach.maxX = x;
        if (y < reach.minY) reach.minY = y;
        if (y > reach.maxY) reach.maxY = y;
        if (alpha < reach.minAlpha) reach.minAlpha = alpha;
        if (alpha > reach.maxAlpha) reach.maxAlpha = alpha;
      }
    }
    expect(reach.minX).toBeGreaterThanOrEqual(bounds.minX);
    expect(reach.maxX).toBeLessThanOrEqual(bounds.maxX);
    expect(reach.minY).toBeGreaterThanOrEqual(bounds.minY);
    expect(reach.maxY).toBeLessThanOrEqual(bounds.maxY);
    expect(reach.minAlpha).toBeGreaterThanOrEqual(0);
    expect(reach.maxAlpha).toBeLessThanOrEqual(MAX_ALPHA + 1e-6);
    // Bounds are tight enough for the shape to fill its zone (>= 88 % of each side).
    expect(reach.minX / bounds.minX).toBeGreaterThan(0.88);
    expect(reach.maxX / bounds.maxX).toBeGreaterThan(0.88);
    expect(reach.minY / bounds.minY).toBeGreaterThan(0.88);
    expect(reach.maxY / bounds.maxY).toBeGreaterThan(0.88);
  }, 60_000);

  it("keeps opacities of visible points within .12–.60 (the current fades to 0 only at its ends)", () => {
    for (const preset of PARTICLE_PRESETS) {
      const out = evaluate(preset, 8.5);
      for (let i = 0; i < COUNT; i++) {
        const alpha = at(out, i * POINT_STRIDE + 2);
        if (preset === "current" || (preset === "grid" && alpha === 0)) continue;
        expect(alpha).toBeGreaterThanOrEqual(0.12 - 1e-6);
      }
    }
  });
});

describe("loops and continuity", () => {
  it.each([
    ["agents", AGENTS_CYCLE],
    ["vortex", VORTEX_CYCLE],
  ] as const)("%s closes its %i s loop exactly", (preset, cycle) => {
    const start = evaluate(preset, 0);
    const end = evaluate(preset, cycle);
    const nearEnd = evaluate(preset, cycle - 1e-4);
    for (let k = 0; k < start.length; k++) {
      expect(Math.abs(at(start, k) - at(end, k))).toBeLessThan(1e-5);
      expect(Math.abs(at(start, k) - at(nearEnd, k))).toBeLessThan(1e-3);
    }
    // Several loops later, the same instant gives the same picture.
    const later = evaluate(preset, cycle * 3 + 6.5);
    const reference = evaluate(preset, 6.5);
    for (let k = 0; k < later.length; k++) expect(Math.abs(at(later, k) - at(reference, k))).toBeLessThan(1e-3);
  });

  it.each(PARTICLE_PRESETS)("%s never jumps between two frames (60 fps) over its whole cycle", (preset) => {
    const { bounds } = SHAPES[preset];
    const size = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
    const step = 1 / 60;
    let previous = evaluate(preset, 0);
    let largest = 0;
    for (let t = step; t <= span(preset) + step; t += step) {
      const next = evaluate(preset, t);
      for (let i = 0; i < COUNT; i++) {
        const o = i * POINT_STRIDE;
        const move = Math.hypot(at(next, o) - at(previous, o), at(next, o + 1) - at(previous, o + 1));
        if (preset === "current" && move > size / 4) {
          // Recycling from the right edge to the left one: invisible on both sides.
          expect(at(previous, o + 2)).toBeLessThan(0.01);
          expect(at(next, o + 2)).toBeLessThan(0.01);
          continue;
        }
        largest = Math.max(largest, move / size);
      }
      previous = next;
    }
    // At most 1 % of the zone per frame: smooth motion, no teleport.
    expect(largest).toBeLessThan(0.01);
  }, 60_000);

  it("fades the current out at both ends so recycling never shows", () => {
    const { bounds } = SHAPES.current;
    for (let t = 0; t < 30; t += 0.37) {
      const out = evaluate("current", t);
      for (let i = 0; i < COUNT; i++) {
        const x = at(out, i * POINT_STRIDE);
        const edgeDistance = Math.min(x - bounds.minX, bounds.maxX - x);
        if (edgeDistance < 1) expect(at(out, i * POINT_STRIDE + 2)).toBeLessThan(0.01);
        if (edgeDistance > CURRENT_EDGE_FADE) expect(at(out, i * POINT_STRIDE + 2)).toBeGreaterThan(0.1);
      }
    }
  });
});

describe("agents IA — sphere, division, four forms, recomposition", () => {
  it("follows the 14 s phases: sphere, division 2–5 s, four forms 5–11 s, recomposition 11–14 s", () => {
    expect(agentsSplit(0)).toBe(0);
    expect(agentsSplit(2)).toBe(0);
    expect(agentsSplit(3.5)).toBeGreaterThan(0.3);
    expect(agentsSplit(3.5)).toBeLessThan(0.7);
    for (const cycle of [5, 8, 11]) expect(agentsSplit(cycle)).toBe(1);
    expect(agentsSplit(12.5)).toBeGreaterThan(0.3);
    expect(agentsSplit(12.5)).toBeLessThan(0.7);
    expect(agentsSplit(14)).toBe(0);
  });

  it("draws four clearly different forms", () => {
    type Signature = { aspect: number; hollow: number; lobes3: number; lobes5: number };
    const signatures: Signature[] = [];
    const point = new Float32Array(3);
    for (let group = 0; group < 4; group++) {
      const xs: number[] = [];
      const ys: number[] = [];
      for (let i = group; i < MAX_PARTICLES; i += 4) {
        agentFormPoint(group, at(fullSeeds, i * 4), at(fullSeeds, i * 4 + 1), at(fullSeeds, i * 4 + 2), 8, point, 0);
        xs.push(at(point, 0));
        ys.push(at(point, 1));
      }
      const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
      const cx = mean(xs);
      const cy = mean(ys);
      const std = (values: number[], centre: number) => Math.sqrt(mean(values.map((value) => (value - centre) ** 2)));
      const radii = xs.map((x, k) => Math.hypot(x - cx, (ys[k] ?? 0) - cy));
      const harmonic = (order: number) => {
        let re = 0;
        let im = 0;
        let total = 0;
        radii.forEach((radius, k) => {
          const angle = Math.atan2((ys[k] ?? 0) - cy, (xs[k] ?? 0) - cx);
          re += radius * Math.cos(order * angle);
          im += radius * Math.sin(order * angle);
          total += radius;
        });
        return Math.hypot(re, im) / total;
      };
      signatures.push({
        aspect: std(ys, cy) / std(xs, cx),
        hollow: radii.filter((radius) => radius < 0.05).length / radii.length,
        lobes3: harmonic(3),
        lobes5: harmonic(5),
      });
    }
    const [trilobe, torus, helix, star] = signatures as [Signature, Signature, Signature, Signature];
    // Helix: the only tall form.
    expect(helix.aspect).toBeGreaterThan(2);
    for (const other of [trilobe, torus, star]) expect(other.aspect).toBeLessThan(1.2);
    // Torus: the only form with an empty centre.
    expect(torus.hollow).toBe(0);
    for (const other of [trilobe, star]) expect(other.hollow).toBeGreaterThan(0.004);
    // Filled masses: three lobes on one side, five on the other.
    expect(trilobe.lobes3).toBeGreaterThan(0.05);
    expect(trilobe.lobes3).toBeGreaterThan(3 * trilobe.lobes5);
    expect(trilobe.lobes3).toBeGreaterThan(3 * star.lobes3);
    expect(star.lobes5).toBeGreaterThan(0.05);
    expect(star.lobes5).toBeGreaterThan(3 * star.lobes3);
    expect(star.lobes5).toBeGreaterThan(3 * trilobe.lobes5);
  });

  it("keeps each particle in the group index % 4 during the four-form phase", () => {
    const out = evaluate("agents", 8);
    const centres = [-1.9, -0.63, 0.63, 1.9];
    for (let i = 0; i < COUNT; i++) {
      const x = at(out, i * POINT_STRIDE);
      const nearest = centres.reduce((best, centre, k) => (Math.abs(x - centre) < Math.abs(x - (centres[best] ?? 0)) ? k : best), 0);
      expect(nearest).toBe(i % 4);
    }
  });
});

describe("messages à valider — vortex and relief", () => {
  it("follows the 18 s phases", () => {
    for (const cycle of [0, 1.5, 3]) expect(vortexMorph(cycle)).toBe(0);
    expect(vortexMorph(5)).toBeGreaterThan(0.3);
    expect(vortexMorph(5)).toBeLessThan(0.7);
    for (const cycle of [7, 10, 14]) expect(vortexMorph(cycle)).toBe(1);
    expect(vortexMorph(16)).toBeGreaterThan(0.3);
    expect(vortexMorph(16)).toBeLessThan(0.7);
    expect(vortexMorph(18)).toBe(0);
  });

  it("keeps the centre of the vortex empty", () => {
    for (let t = 0; t <= 3; t += 0.25) {
      const out = evaluate("vortex", t);
      for (let i = 0; i < COUNT; i++) {
        const x = at(out, i * POINT_STRIDE);
        const y = at(out, i * POINT_STRIDE + 1) / VORTEX_TILT;
        expect(Math.hypot(x, y)).toBeGreaterThan(VORTEX_INNER_RADIUS * 0.9);
      }
    }
  });

  it("orbits faster near the centre", () => {
    const early = evaluate("vortex", 0);
    const later = evaluate("vortex", 0.5);
    const inner: number[] = [];
    const outer: number[] = [];
    for (let i = 0; i < COUNT; i++) {
      const o = i * POINT_STRIDE;
      const radius = Math.hypot(at(early, o), at(early, o + 1) / VORTEX_TILT);
      const turn = Math.abs(
        Math.atan2(at(later, o + 1) / VORTEX_TILT, at(later, o)) - Math.atan2(at(early, o + 1) / VORTEX_TILT, at(early, o)),
      );
      const angle = Math.min(turn, 2 * Math.PI - turn);
      if (radius < 0.4) inner.push(angle);
      if (radius > 1.1) outer.push(angle);
    }
    const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
    expect(mean(inner)).toBeGreaterThan(mean(outer) * 2);
  });

  it("raises a relief with at least three distinct peaks during 7–14 s", () => {
    const size = 61;
    for (const cycle of [7.5, 9, 10.5, 12, 13.5]) {
      expect(reliefAmplitude(cycle)).toBeGreaterThan(0.5);
      const heights: number[] = [];
      for (let row = 0; row < size; row++) {
        for (let column = 0; column < size; column++) heights.push(terrainHeight((column / (size - 1)) * 2 - 1, (row / (size - 1)) * 2 - 1, cycle));
      }
      let peaks = 0;
      for (let row = 1; row < size - 1; row++) {
        for (let column = 1; column < size - 1; column++) {
          const u = (column / (size - 1)) * 2 - 1;
          const v = (row / (size - 1)) * 2 - 1;
          // The terrain is the vortex disk: only points of the unit disk exist.
          if (u * u + v * v > 1) continue;
          const h = heights[row * size + column] ?? 0;
          if (h < 0.2) continue;
          let isMax = true;
          for (let dr = -1; dr <= 1 && isMax; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if ((dr || dc) && (heights[(row + dr) * size + column + dc] ?? 0) >= h) isMax = false;
            }
          }
          if (isMax) peaks++;
        }
      }
      expect(peaks).toBeGreaterThanOrEqual(3);
      expect(peaks).toBeLessThanOrEqual(4);
    }
  });

  it("never contracts while the relief rises (3–7 s) or sinks back into the vortex (14–18 s)", () => {
    // Regression: a terrain narrower than the vortex at mid-depth made the
    // reforming vortex shrink to 90 % of its width around 16 s, then widen again.
    const vortexWidth = vortexOutline(0).halfWidth;
    for (const [from, to] of [
      [3, 7],
      [14, 18],
    ] as const) {
      for (let t = from; t <= to + 1e-9; t += 0.05) expect(vortexOutline(t).halfWidth).toBeGreaterThan(vortexWidth * 0.98);
    }
    // While sinking, the outline only narrows back towards the vortex: no dip, no bounce.
    let previous = vortexOutline(14).halfWidth;
    for (let t = 14.25; t <= 18 + 1e-9; t += 0.25) {
      const { halfWidth } = vortexOutline(t);
      expect(halfWidth).toBeLessThanOrEqual(previous + 0.02);
      previous = halfWidth;
    }
  });

  it("reopens the empty centre steadily between 16 and 18 s, as it was at t = 0", () => {
    let previous = 0;
    for (let t = 16; t <= 18 + 1e-9; t += 0.05) {
      const { hole } = vortexOutline(t);
      expect(hole).toBeGreaterThanOrEqual(previous - 0.01);
      previous = hole;
    }
    expect(previous).toBeCloseTo(vortexOutline(0).hole, 5);
    expect(previous).toBeGreaterThan(VORTEX_INNER_RADIUS * 0.9);
  });

  it("is flat while it is a vortex: no relief outside the terrain phase", () => {
    expect(reliefAmplitude(0)).toBe(0);
    expect(reliefAmplitude(3)).toBe(0);
    expect(reliefAmplitude(17)).toBe(0);
  });
});
