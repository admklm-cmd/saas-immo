import { describe, expect, it } from "vitest";

import { flipKeyframe, flipTransform } from "./flip";
import {
  approach,
  DRAG_THRESHOLD_PX,
  FLICK_VELOCITY,
  isDragGesture,
  isSettled,
  MOMENTUM_TAU_MS,
  projectMomentum,
  releaseVelocity,
  revealOffset,
  snapStops,
  snapTarget,
} from "./track-physics";

describe("drag or click", () => {
  it("stays a click under the threshold, whatever the direction", () => {
    expect(isDragGesture(DRAG_THRESHOLD_PX - 1, 0)).toBe(false);
    expect(isDragGesture(-(DRAG_THRESHOLD_PX - 1), 0)).toBe(false);
    expect(isDragGesture(0, 40)).toBe(false);
  });

  it("becomes a drag past the threshold, only when mostly horizontal", () => {
    expect(isDragGesture(DRAG_THRESHOLD_PX, 0)).toBe(true);
    expect(isDragGesture(-20, 5)).toBe(true);
    expect(isDragGesture(20, 25)).toBe(false);
  });
});

describe("release velocity", () => {
  it("measures the recent samples only", () => {
    const samples = [
      { t: 0, x: 0 },
      { t: 400, x: 10 },
      { t: 450, x: 60 },
      { t: 480, x: 90 },
    ];
    // Only the last 90 ms count: (90 - 10) / (480 - 400).
    expect(releaseVelocity(samples, 480)).toBeCloseTo(1);
  });

  it("is zero when the pointer stayed still before the release, or with one sample", () => {
    expect(releaseVelocity([{ t: 0, x: 0 }, { t: 20, x: 40 }], 500)).toBe(0);
    expect(releaseVelocity([{ t: 10, x: 5 }], 10)).toBe(0);
    expect(releaseVelocity([], 10)).toBe(0);
  });
});

describe("momentum and snap", () => {
  const stops = snapStops([0, 220, 440, 660, 880], 700);

  it("clamps the stops to the scrollable range and keeps the end reachable", () => {
    expect(stops).toEqual([0, 220, 440, 660, 700]);
  });

  it("projects the momentum with the time constant", () => {
    expect(projectMomentum(100, 0.5)).toBe(100 + 0.5 * MOMENTUM_TAU_MS);
    expect(projectMomentum(100, 0)).toBe(100);
  });

  it("snaps a slow release to the closest stop", () => {
    expect(snapTarget(stops, 250, 0)).toBe(220);
    expect(snapTarget(stops, 350, 0)).toBe(440);
  });

  it("carries a fast release further, within the range", () => {
    expect(snapTarget(stops, 220, 1.4)).toBe(660);
    expect(snapTarget(stops, 440, -5)).toBe(0);
    expect(snapTarget(stops, 660, 5)).toBe(700);
  });

  it("moves a flick one stop at least in its direction", () => {
    const flick = FLICK_VELOCITY;
    // Projected 220 + 0.35 * 325 ≈ 334: closer to 440 anyway; a smaller flick from a stop still moves.
    expect(snapTarget(stops, 220, flick * 0.9)).toBe(220);
    expect(snapTarget(stops, 220, -flick)).toBe(0);
  });
});

describe("approach (interpolation)", () => {
  it("decays towards the target, frame-rate independent", () => {
    const oneStep = approach(0, 100, 32, 100);
    const twoSteps = approach(approach(0, 100, 16, 100), 100, 16, 100);
    expect(oneStep).toBeCloseTo(twoSteps, 6);
    expect(oneStep).toBeGreaterThan(0);
    expect(oneStep).toBeLessThan(100);
  });

  it("lands exactly on the target once settled, and never overshoots", () => {
    let position = 0;
    for (let frame = 0; frame < 200 && position !== 300; frame += 1) {
      position = approach(position, 300, 16, 140);
      expect(position).toBeLessThanOrEqual(300);
    }
    expect(position).toBe(300);
    expect(isSettled(299.6, 300)).toBe(true);
    expect(approach(50, 100, -5, 100)).toBe(50);
  });

  it("starts at the release velocity when the target is the projection", () => {
    const velocity = 0.8;
    const target = projectMomentum(0, velocity);
    const first = approach(0, target, 1, MOMENTUM_TAU_MS);
    expect(first).toBeCloseTo(velocity, 1);
  });
});

describe("reveal an item", () => {
  const view = { position: 200, size: 600 };

  it("does not move when the item is fully visible", () => {
    expect(revealOffset({ start: 300, end: 500 }, view, 1000, 24)).toBe(200);
  });

  it("moves as little as possible, clear of the faded edges", () => {
    expect(revealOffset({ start: 100, end: 300 }, view, 1000, 24)).toBe(76);
    expect(revealOffset({ start: 700, end: 900 }, view, 1000, 24)).toBe(324);
  });

  it("stays in the scrollable range", () => {
    expect(revealOffset({ start: 10, end: 200 }, view, 1000, 24)).toBe(0);
    expect(revealOffset({ start: 1500, end: 1700 }, view, 1000, 24)).toBe(1000);
  });
});

describe("flip (open the app)", () => {
  it("puts the header tile back on the module tile", () => {
    const transform = flipTransform({ left: 900, top: 120, width: 56, height: 56 }, { left: 100, top: 400, width: 72, height: 72 });
    expect(transform).toEqual({ x: 800, y: -280, scaleX: 56 / 72, scaleY: 56 / 72 });
    expect(flipKeyframe({ x: 800, y: -280, scaleX: 0.5, scaleY: 0.5 })).toBe("translate(800px, -280px) scale(0.5, 0.5)");
  });

  it("refuses an empty box (hidden element)", () => {
    expect(flipTransform({ left: 0, top: 0, width: 0, height: 0 }, { left: 0, top: 0, width: 72, height: 72 })).toBeNull();
  });
});
