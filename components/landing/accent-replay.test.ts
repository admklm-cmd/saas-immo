import { describe, expect, it } from "vitest";

import {
  REPLAY_COOLDOWN_MS,
  REPLAY_SAFETY_MS,
  TAP_MAX_MS,
  TAP_SLOP_PX,
  canReplay,
  isHoverPointer,
  isReplayPointer,
  isTap,
  type ReplayRequest,
} from "./accent-replay";

const READY: ReplayRequest = {
  pointerType: "mouse",
  running: false,
  entryRunning: false,
  revealHidden: false,
  now: 10_000,
  lastEnd: null,
};

describe("title replay rules (docs/design-system.md §2.11.2 D, §2.11.8.8 L4-C)", () => {
  it("uses the spec delays", () => {
    expect(REPLAY_COOLDOWN_MS).toBe(800);
    expect(REPLAY_SAFETY_MS).toBe(1600);
    expect(TAP_SLOP_PX).toBe(10);
    expect(TAP_MAX_MS).toBe(600);
  });

  it("replays for a mouse, a pen (hover) or a finger (tap)", () => {
    expect(isReplayPointer("mouse")).toBe(true);
    expect(isReplayPointer("pen")).toBe(true);
    expect(isReplayPointer("touch")).toBe(true);
    expect(isReplayPointer("")).toBe(false);
    expect(isHoverPointer("touch")).toBe(false);
    expect(isHoverPointer("mouse")).toBe(true);
    expect(canReplay({ ...READY, pointerType: "touch" })).toBe(true);
    expect(canReplay({ ...READY, pointerType: "" })).toBe(false);
    expect(canReplay(READY)).toBe(true);
  });

  it("recognises a brief tap: 10 px, 600 ms, never cancelled", () => {
    expect(isTap({ dx: 0, dy: 0, duration: 120, cancelled: false })).toBe(true);
    expect(isTap({ dx: 6, dy: 8, duration: 600, cancelled: false })).toBe(true);
    expect(isTap({ dx: 8, dy: 8, duration: 100, cancelled: false })).toBe(false);
    expect(isTap({ dx: 0, dy: 200, duration: 300, cancelled: false })).toBe(false);
    expect(isTap({ dx: 0, dy: 0, duration: 601, cancelled: false })).toBe(false);
    expect(isTap({ dx: 0, dy: 0, duration: 100, cancelled: true })).toBe(false);
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
