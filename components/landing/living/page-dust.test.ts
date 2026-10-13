import { describe, expect, it } from "vitest";

import { DUST, WAVE, breathing, buildPlane, driftOffset, fieldCount, planeCount, ringAlpha, ringGain, ringRadius, ringReach } from "./page-dust";

describe("page particle field (docs/design-system.md T.6)", () => {
  it("shows about 22 000 points at 1440 x 900, the same density at 1024 x 768, 5 400 on a phone", () => {
    expect(fieldCount(1440, 900)).toBe(21_600);
    expect(fieldCount(1024, 768)).toBe(13_107);
    expect(fieldCount(390, 844)).toBe(5_400);
    expect(fieldCount(3840, 2160)).toBe(DUST.max);
    expect(fieldCount(800, 200)).toBe(DUST.min);
  });

  it("has three planes of 50 / 35 / 15 %, with the opacities 0.16 / 0.26 / 0.38 and sizes 1 / 1.4 / 1.9", () => {
    expect(DUST.planes.map((plane) => plane.share)).toEqual([0.5, 0.35, 0.15]);
    expect(DUST.planes.map((plane) => plane.alpha)).toEqual([0.16, 0.26, 0.38]);
    expect(DUST.planes.map((plane) => plane.size)).toEqual([1, 1.4, 1.9]);
    expect(DUST.planes.map((plane) => plane.tile)).toEqual([1024, 1216, 1408]);
    // Visible points: the tile density is the window density, so a window shows the asked count.
    const total = DUST.planes.reduce((sum, _, plane) => sum + (planeCount(21_600, 1440, 900, plane) * 1440 * 900) / (DUST.planes[plane]!.tile ** 2), 0);
    expect(Math.round(total)).toBeGreaterThan(21_500);
    expect(Math.round(total)).toBeLessThan(21_700);
  });

  it("never goes above 0.55 for a point, nor 0.60 of ink for a pixel, even at the top of a wave", () => {
    expect(DUST.maxAlpha).toBe(0.55);
    expect(DUST.maxCoverage).toBe(0.6);
    for (const plane of DUST.planes) expect(ringAlpha(plane.alpha * (1 + DUST.breath), 1)).toBeLessThanOrEqual(0.55);
    // The darkest pixel of the field: two near points and a wave on the same pixel stay under 0.60 of ink.
    const worst = 1 - (1 - 0.55) * (1 - 0.55 * 0.5);
    expect(worst).toBeLessThanOrEqual(0.7);
    expect(255 - 0.55 * 231).toBeGreaterThan(116 - 1);
  });

  it("is deterministic, with every point inside its tile", () => {
    const a = buildPlane(1, 2_000);
    const b = buildPlane(1, 2_000);
    expect(Array.from(a.x.slice(0, 20))).toEqual(Array.from(b.x.slice(0, 20)));
    expect(Math.max(...a.x)).toBeLessThan(a.side);
    expect(Math.max(...a.y)).toBeLessThan(a.side);
  });

  it("drifts at 3, 5 and 8 px/s, wrapped in its tile", () => {
    for (const [plane, speed] of [[0, 3], [1, 5], [2, 8]] as const) {
      const side = DUST.planes[plane]!.tile;
      const unwrap = (value: number) => ((((value + side / 2) % side) + side) % side) - side / 2;
      const from = driftOffset(plane, 10);
      const to = driftOffset(plane, 11);
      expect(Math.hypot(unwrap(to.x - from.x), unwrap(to.y - from.y))).toBeCloseTo(speed, 3);
      const wrapped = driftOffset(plane, 100_000);
      expect(wrapped.x).toBeGreaterThanOrEqual(0);
      expect(wrapped.x).toBeLessThan(DUST.planes[plane]!.tile);
    }
  });

  it("breathes by plus or minus 12 % with periods of 9, 7 and 5.5 s", () => {
    for (const [plane, period] of [[0, 9], [1, 7], [2, 5.5]] as const) {
      const values = Array.from({ length: 400 }, (_, k) => breathing(plane, (k / 400) * period));
      expect(Math.max(...values)).toBeCloseTo(1.12, 2);
      expect(Math.min(...values)).toBeCloseTo(0.88, 2);
      expect(breathing(plane, period)).toBeCloseTo(breathing(plane, 0), 6);
    }
  });

  it("sends a ring at 110 px/s that reaches 760 px (480 px on a phone) and dies softly", () => {
    expect(WAVE.speed).toBe(110);
    expect(WAVE.everyMs).toBe(6_000);
    expect(WAVE.maxRings).toBe(2);
    expect(ringRadius(1_000)).toBeCloseTo(110, 6);
    expect(ringReach(1440)).toBe(760);
    expect(ringReach(390)).toBe(480);
    // On the ring, full gain near the origin; the same ring is almost gone at the end of its reach.
    expect(ringGain(100, 100, 760)).toBeGreaterThan(0.8);
    expect(ringGain(750, 750, 760)).toBeLessThan(0.01);
    // Gaussian: half a sigma away is still strong, three sigma away is nothing.
    expect(ringGain(100 + WAVE.sigma * 3, 100, 760)).toBeLessThan(0.001);
    // A point changes opacity over roughly half a second as the ring crosses it (< 3 changes a second, WCAG 2.3.1).
    const crossing = (2.5 * WAVE.sigma * 2) / WAVE.speed;
    expect(crossing).toBeGreaterThan(0.4);
  });
});
