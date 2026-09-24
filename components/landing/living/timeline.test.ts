import { describe, expect, it } from "vitest";

import { GATE_STOP, SCENES, STOP_COUNT } from "./scenes";
import {
  buildSchedule,
  clamp01,
  DWELL_SECONDS,
  ease,
  haltTime,
  hash01,
  HALT_AT,
  progressAt,
  SEGMENT_SECONDS,
  smoothstep,
  valueAt,
} from "./timeline";

const HERO = SCENES.hero;

describe("valueAt", () => {
  it("reads an index, and falls back instead of producing NaN", () => {
    expect(valueAt([4, 5], 1)).toBe(5);
    expect(valueAt([4, 5], 7)).toBe(0);
    expect(valueAt([4, 5], -1, 9)).toBe(9);
  });
});

describe("buildSchedule", () => {
  const schedule = buildSchedule(HERO);

  it("has one arrival and one departure per stop, in increasing order", () => {
    expect(schedule.arrive).toHaveLength(STOP_COUNT);
    expect(schedule.depart).toHaveLength(STOP_COUNT);
    for (let stop = 1; stop < STOP_COUNT; stop++) {
      expect(valueAt(schedule.arrive, stop)).toBeGreaterThan(valueAt(schedule.depart, stop - 1));
    }
    expect(schedule.end).toBe(valueAt(schedule.arrive, STOP_COUNT - 1));
  });

  it("holds the file longer in front of the human validation", () => {
    const gateWait = valueAt(schedule.depart, GATE_STOP) - valueAt(schedule.arrive, GATE_STOP);
    expect(gateWait).toBeCloseTo(HERO.gateHold, 9);
    expect(valueAt(schedule.depart, 1) - valueAt(schedule.arrive, 1)).toBeCloseTo(DWELL_SECONDS, 9);
  });
});

describe("progressAt", () => {
  const schedule = buildSchedule(HERO);

  it("leaves the entry at once, rests on the first agent, then arrives at the mandate", () => {
    expect(progressAt(schedule, 0)).toMatchObject({ kind: "moving", segment: 0 });
    expect(progressAt(schedule, valueAt(schedule.arrive, 1) + DWELL_SECONDS / 2)).toMatchObject({ kind: "resting", stop: 1 });
    expect(progressAt(schedule, SEGMENT_SECONDS / 2)).toMatchObject({ kind: "moving", segment: 0 });
    expect(progressAt(schedule, schedule.end + 1)).toEqual({ kind: "arrived", since: 1 });
  });

  it("waits at the gate while the human validation is pending", () => {
    const atGate = valueAt(schedule.arrive, GATE_STOP) + HERO.gateHold / 2;
    expect(progressAt(schedule, atGate)).toMatchObject({ kind: "resting", stop: GATE_STOP });
  });

  it("is a pure function of time", () => {
    expect(progressAt(schedule, 7.3)).toEqual(progressAt(schedule, 7.3));
  });

  it("halts a blocked impulse partway along its link", () => {
    const halt = haltTime(schedule, 2);
    expect(halt).toBeGreaterThan(valueAt(schedule.depart, 2));
    expect(halt).toBeLessThan(valueAt(schedule.arrive, 3));
    const progress = progressAt(schedule, halt);
    expect(progress.kind).toBe("moving");
    if (progress.kind === "moving") expect(progress.u).toBeCloseTo(HALT_AT, 5);
  });
});

describe("easing helpers", () => {
  it("stay within [0, 1]", () => {
    for (const value of [-1, 0, 0.25, 0.5, 0.75, 1, 2]) {
      for (const fn of [clamp01, smoothstep, ease]) {
        expect(fn(value)).toBeGreaterThanOrEqual(0);
        expect(fn(value)).toBeLessThanOrEqual(1);
      }
    }
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
  });

  it("hash01 is deterministic and in [0, 1)", () => {
    const value = hash01(3, 4, 5, 42);
    expect(value).toBe(hash01(3, 4, 5, 42));
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
  });
});
