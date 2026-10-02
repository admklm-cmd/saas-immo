import { describe, expect, it } from "vitest";

import { REPLAY_COOLDOWN_MS, REPLAY_SAFETY_MS, canReplay, isReplayPointer, type ReplayRequest } from "./accent-replay";

const READY: ReplayRequest = {
  pointerType: "mouse",
  running: false,
  entryRunning: false,
  revealHidden: false,
  now: 10_000,
  lastEnd: null,
};

describe("hover replay rules (docs/design-system.md §2.11.2 D)", () => {
  it("uses the spec delays", () => {
    expect(REPLAY_COOLDOWN_MS).toBe(800);
    expect(REPLAY_SAFETY_MS).toBe(1600);
  });

  it("replays for a mouse or a pen only, never for a touch", () => {
    expect(isReplayPointer("mouse")).toBe(true);
    expect(isReplayPointer("pen")).toBe(true);
    expect(isReplayPointer("touch")).toBe(false);
    expect(isReplayPointer("")).toBe(false);
    expect(canReplay({ ...READY, pointerType: "touch" })).toBe(false);
    expect(canReplay(READY)).toBe(true);
  });

  it("never interrupts nor stacks a replay in progress", () => {
    expect(canReplay({ ...READY, running: true })).toBe(false);
  });

  it("waits for the entry effect: running animation or Reveal still hidden", () => {
    expect(canReplay({ ...READY, entryRunning: true })).toBe(false);
    expect(canReplay({ ...READY, revealHidden: true })).toBe(false);
  });

  it("waits 800 ms after the end of the previous replay", () => {
    const lastEnd = READY.now;
    expect(canReplay({ ...READY, lastEnd, now: lastEnd + 300 })).toBe(false);
    expect(canReplay({ ...READY, lastEnd, now: lastEnd + 799 })).toBe(false);
    expect(canReplay({ ...READY, lastEnd, now: lastEnd + 800 })).toBe(true);
    expect(canReplay({ ...READY, lastEnd, now: lastEnd + 900 })).toBe(true);
  });
});
