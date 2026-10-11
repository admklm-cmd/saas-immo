import { describe, expect, it } from "vitest";

import { LANDING_TEXTS } from "@/components/landing-texts";

import { terminalSchedule, type ScheduledLine } from "./terminal-script";

const TERMINAL = LANDING_TEXTS.hero.terminal;
const schedule = terminalSchedule(TERMINAL.lines);

type Typed = Exclude<ScheduledLine, { kind: "static" }>;
const typed = (index: number) => schedule.lines[index] as Typed;
const firstAt = (index: number) => typed(index).chars[0]!.at;

describe("hero terminal schedule (docs/design-system.md §2.11.4 bis E)", () => {
  it("keeps line 0 static and types the seven other lines", () => {
    expect(schedule.lines).toHaveLength(8);
    expect(schedule.lines[0]).toEqual({ kind: "static", text: "# exemple fictif — simulation" });
    expect(schedule.lines.slice(1).map((line) => line.kind)).toEqual(["agent", "agent", "agent", "human", "agent", "agent", "closing"]);
  });

  it("hits the reference instants of the spec (L1 1 600 → 2 272 … L7 10 848 → 12 180)", () => {
    const marks = [1, 2, 3, 4, 5, 6, 7].map((index) => [typed(index).promptAt ?? firstAt(index), typed(index).end]);
    expect(marks).toEqual([
      [1_600, 2_272],
      [2_792, 3_560],
      [4_080, 4_872],
      [5_392, 7_236],
      [8_036, 8_732],
      [9_252, 9_948],
      [10_848, 12_180],
    ]);
    // The human hesitates 700 ms before the first character.
    expect(typed(4).hesitation).toEqual({ at: 5_392, ms: 700 });
    expect(firstAt(4)).toBe(6_092);
    expect(schedule.doneAt).toBe(12_180);
    expect(schedule.settledAt).toBe(15_360);
  });

  it("types at fixed rates: 24 ms (machine), 52 ms (human), 36 ms (closing)", () => {
    const step = (index: number) => typed(index).chars[1]!.at - typed(index).chars[0]!.at;
    expect([1, 2, 3, 5, 6].map(step)).toEqual([24, 24, 24, 24, 24]);
    expect(step(4)).toBe(52);
    expect(step(7)).toBe(36);
    // The prompt of an agent line appears at once, with the first character.
    expect(typed(1).promptAt).toBe(firstAt(1));
    expect(typed(7).promptAt).toBeNull();
  });

  it("moves one cursor without gap or overlap: each character hands it to the next, through the pauses", () => {
    const slots = schedule.lines.flatMap((line) => (line.kind === "static" ? [] : line.chars.map((char) => [char.at, char.at + char.cursorMs] as const)));
    for (let index = 1; index < slots.length; index += 1) {
      const previousEnd = slots[index - 1]![1];
      const start = slots[index]![0];
      // The hesitation of line 4 is the only gap: its own blinking cursor fills it.
      if (start === 6_092) expect(start - previousEnd).toBe(700);
      else expect(start).toBe(previousEnd);
    }
    expect(slots.at(-1)![1]).toBe(12_180);
  });

  it("is deterministic (no random): two schedules are identical", () => {
    expect(terminalSchedule(TERMINAL.lines)).toEqual(schedule);
  });
});
