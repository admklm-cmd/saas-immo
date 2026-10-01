import { describe, expect, it } from "vitest";

import {
  approach,
  createProjector,
  nearness,
  PITCH_ARC,
  poseFromProgress,
  projectInto,
  REDUCED_POSE,
  SEQUENCE_DRIFT,
  sequenceDrift,
  SETTLE_EPSILON,
  setProjector,
  YAW_RANGE,
} from "./camera";

describe("camera pose from the scroll progress", () => {
  it("is (−0.16, 0) at the top, (0, 0.055) in the middle, (0.16, 0) at the bottom", () => {
    const top = poseFromProgress(0);
    const middle = poseFromProgress(0.5);
    const bottom = poseFromProgress(1);
    expect(top.yaw).toBeCloseTo(-0.16, 6);
    expect(top.pitch).toBeCloseTo(0, 6);
    expect(middle.yaw).toBeCloseTo(0, 6);
    expect(middle.pitch).toBeCloseTo(0.055, 6);
    expect(bottom.yaw).toBeCloseTo(0.16, 6);
    expect(bottom.pitch).toBeCloseTo(0, 6);
    expect(YAW_RANGE).toBe(0.16);
    expect(PITCH_ARC).toBe(0.055);
  });

  it("clamps out-of-range progress and keeps the reduced pose constant", () => {
    expect(poseFromProgress(-3)).toEqual(poseFromProgress(0));
    expect(poseFromProgress(9)).toEqual(poseFromProgress(1));
    expect(REDUCED_POSE).toEqual({ yaw: 0, pitch: 0.055 });
    expect(Object.isFrozen(REDUCED_POSE)).toBe(true);
  });
});

describe("camera smoothing", () => {
  it("lands within 0.0005 rad in ≤ 1.2 s after any jump of the target (60 and 30 frames per second)", () => {
    for (const fps of [60, 30]) {
      for (const jump of [0.32, 0.16, 0.055, 0.01, 0.0004]) {
        let current = 0;
        let time = 0;
        while (Math.abs(jump - current) >= SETTLE_EPSILON && time < 5) {
          current = approach(current, jump, 1 / fps);
          time += 1 / fps;
        }
        expect(time, `${jump} rad @ ${fps} fps`).toBeLessThanOrEqual(1.2);
        // And it then snaps exactly onto the target (the loop can stop).
        for (let i = 0; i < 3; i++) current = approach(current, jump, 1 / fps);
        expect(current).toBe(jump);
      }
    }
  });

  it("never overshoots and moves monotonically toward the target", () => {
    let current = 0.16;
    let previous = current;
    for (let i = 0; i < 120; i++) {
      current = approach(current, -0.16, 1 / 60);
      expect(current).toBeLessThanOrEqual(previous);
      expect(current).toBeGreaterThanOrEqual(-0.16);
      previous = current;
    }
  });
});

describe("drift during a sequence", () => {
  it("is zero at its start and its end, at most 0.012 rad, and zero once disabled (first fallback)", () => {
    expect(sequenceDrift(0, 4800)).toBe(0);
    expect(sequenceDrift(4800, 4800)).toBe(0);
    expect(sequenceDrift(6000, 4800)).toBe(0);
    expect(sequenceDrift(2400, 4800)).toBeCloseTo(SEQUENCE_DRIFT, 9);
    expect(SEQUENCE_DRIFT).toBe(0.012);
    expect(sequenceDrift(2400, 4800, 0)).toBe(0);
  });
});

describe("projection", () => {
  it("follows the reference: centre at (W/2, 0.46 H), perspective 4.5 / (4.5 + depth)", () => {
    const projector = setProjector(createProjector(), 0, 0, 1440, 900, "large");
    const out = new Float64Array(4);
    projectInto(projector, 0, 0, 0, out, 0);
    expect(out[0]).toBeCloseTo(720, 9);
    expect(out[1]).toBeCloseTo(414, 9);
    expect(out[3]).toBeCloseTo(1, 9);
    projectInto(projector, 1, 0, 0.5, out, 0);
    // size = max(0.29 W, 0.43 H) = 417.6
    expect(out[0]).toBeCloseTo(720 + 417.6 * (4.5 / 5), 6);
    expect(out[2]).toBeCloseTo(0.5, 9);
    expect(setProjector(createProjector(), 0, 0, 390, 844, "compact").size).toBeCloseTo(Math.max(0.38 * 390, 0.3 * 844), 9);
    expect(nearness(1.55)).toBe(0);
    expect(nearness(-0.55)).toBe(1);
  });
});
