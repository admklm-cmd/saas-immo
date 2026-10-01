import { describe, expect, it } from "vitest";

import { addQuietRect, bodyFactor, createQuietZones, distanceToQuiet, MAX_QUIET_RECTS, QUIET_FADE, signalFactor } from "./quiet";

describe("quiet zones", () => {
  const zones = createQuietZones();
  addQuietRect(zones, 100, 100, 300, 200);

  it("silences impulses inside a text block and restores them 16 px away", () => {
    expect(signalFactor(zones, 150, 150)).toBe(0);
    expect(signalFactor(zones, 300, 150)).toBe(0);
    expect(signalFactor(zones, 300 + QUIET_FADE, 150)).toBe(1);
    expect(signalFactor(zones, 300 + 40, 260)).toBe(1);
    const halfway = signalFactor(zones, 308, 150);
    expect(halfway).toBeGreaterThan(0);
    expect(halfway).toBeLessThan(1);
  });

  it("keeps half of a cell body inside a text block", () => {
    expect(bodyFactor(zones, 150, 150)).toBe(0.5);
    expect(bodyFactor(zones, 400, 150)).toBe(1);
  });

  it("measures the distance to the nearest rectangle (corner included)", () => {
    expect(distanceToQuiet(zones, 200, 150)).toBe(0);
    expect(distanceToQuiet(zones, 303, 204)).toBeCloseTo(5, 9);
    expect(distanceToQuiet(createQuietZones(), 0, 0)).toBe(Infinity);
    expect(signalFactor(createQuietZones(), 0, 0)).toBe(1);
  });

  it("reads at most 40 rectangles", () => {
    const many = createQuietZones();
    let added = 0;
    for (let i = 0; i < 50; i++) if (addQuietRect(many, i, i, i + 1, i + 1)) added++;
    expect(added).toBe(MAX_QUIET_RECTS);
    expect(many.count).toBe(40);
  });
});
