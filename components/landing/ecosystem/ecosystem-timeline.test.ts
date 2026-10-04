import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LANDING_TEXTS } from "@/components/landing-texts";

import {
  AGENT_CADENCE_MS,
  CHECKS,
  CURSOR_MOVES,
  CYCLE_MS,
  ECOSYSTEM_LAYOUT,
  EcosystemLoop,
  MISSING,
  MISSING_TRACE_AT,
  PRESSES,
  PRESS_DOWN_MS,
  RINGS,
  STEP_TIMES,
  TILE_STORIES,
  blockLines,
  checkKey,
  finalFrame,
  frameAt,
  pillFull,
  stepDelay,
  type CheckRef,
  type LoopSnapshot,
} from "./ecosystem-timeline";

const BLOCKS = LANDING_TEXTS.journey.blocks;
const byOf = (ref: CheckRef) => ECOSYSTEM_LAYOUT[ref.block]![ref.group]![ref.line];

describe("ecosystem timeline (docs/design-system.md §2.11.8.8 L4-A)", () => {
  it("follows the blocks of the texts: blocks → groups → who checks each line", () => {
    expect(ECOSYSTEM_LAYOUT).toEqual(BLOCKS.map((block) => block.groups.map((group) => group.lines.map((line) => line.by))));
    expect(BLOCKS.map((block) => block.name)).toEqual(["Acquisition", "Validation humaine", "Suivi"]);
    const all = [0, 1, 2].flatMap(blockLines);
    expect(all).toHaveLength(16);
    expect(all.filter((line) => line.by === "agent")).toHaveLength(12);
    expect(all.filter((line) => line.by === "missing")).toHaveLength(1);
    expect(all.filter((line) => line.by === "you")).toHaveLength(3);
  });

  it("lasts 24 000 ms; its steps start at 0 (the reset) and stay inside the cycle", () => {
    expect(CYCLE_MS).toBe(24000);
    expect(AGENT_CADENCE_MS).toBe(700);
    expect(MISSING_TRACE_AT).toBe(5100);
    expect(PRESS_DOWN_MS).toBe(150);
    expect(STEP_TIMES[0]).toBe(0);
    expect(STEP_TIMES.every((time, index) => index === 0 || time > STEP_TIMES[index - 1]!)).toBe(true);
    expect(STEP_TIMES.at(-1)!).toBeLessThan(CYCLE_MS);
    expect(STEP_TIMES.reduce((sum, _time, index) => sum + stepDelay(index), 0)).toBe(CYCLE_MS);
  });

  it("checks the 15 boxes at the 15 instants of the spec: 12 by the agents, 3 by you", () => {
    expect(CHECKS.map((check) => [checkKey(check), check.at])).toEqual([
      ["0:0:0", 1600],
      ["0:0:1", 2300],
      ["0:0:2", 3000],
      ["0:1:0", 3700],
      ["0:1:1", 4400],
      ["0:2:0", 5800],
      ["0:2:1", 6500],
      ["1:0:0", 8750],
      ["1:0:1", 9850],
      ["2:0:0", 11000],
      ["2:0:1", 11700],
      ["2:1:0", 12400],
      ["2:1:1", 13100],
      ["2:1:2", 13800],
      ["1:1:0", 15950],
    ]);
    const by = CHECKS.map(byOf);
    expect(by.filter((who) => who === "agent")).toHaveLength(12);
    expect(by.filter((who) => who === "you")).toHaveLength(3);
    expect(new Set(CHECKS.map(checkKey)).size).toBe(15);
    // The cadence of an agent block is one box every 700 ms (the missing line takes its slot).
    for (const block of [0, 2]) {
      const times = CHECKS.filter((check) => check.block === block).map((check) => check.at);
      const slots = block === 0 ? [...times.slice(0, 5), MISSING_TRACE_AT, ...times.slice(5)] : times;
      for (let i = 1; i < slots.length; i++) expect(slots[i]! - slots[i - 1]!).toBe(AGENT_CADENCE_MS);
    }
  });

  it("orders the work: Acquisition → Validation (2) → Suivi → Validation (1)", () => {
    expect(CHECKS.map((check) => check.block)).toEqual([0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 2, 2, 2, 1]);
  });

  it("confirms the mandate only after Sarah has flagged it", () => {
    const flagged = CHECKS.find((check) => BLOCKS[check.block]!.groups[check.group]!.lines[check.line]!.label === "Mandat signalé")!;
    const confirmed = CHECKS.find((check) => BLOCKS[check.block]!.groups[check.group]!.lines[check.line]!.label === "Mandat confirmé")!;
    expect(byOf(flagged)).toBe("agent");
    expect(byOf(confirmed)).toBe("you");
    expect(confirmed.at).toBeGreaterThan(flagged.at);
  });

  it("never lets an agent check a human box: a « you » box is checked only after the cursor has arrived on it", () => {
    for (const check of CHECKS.filter((entry) => byOf(entry) === "you")) {
      const move = CURSOR_MOVES.find((entry) => entry.target !== "park" && checkKey(entry.target) === checkKey(check));
      expect(move, checkKey(check)).toBeDefined();
      expect(move!.at + move!.ms, `cursor on ${checkKey(check)} before its check`).toBeLessThan(check.at);
      // Checked when the press of the cursor is released, the cursor still on that box.
      expect(PRESSES.some((at) => at + PRESS_DOWN_MS === check.at)).toBe(true);
      expect(frameAt(check.at).cursor).toEqual({ block: check.block, group: check.group, line: check.line });
      expect(frameAt(move!.at + move!.ms - 1).checked.has(checkKey(check))).toBe(false);
    }
    // No cursor move ever targets an agent line.
    for (const move of CURSOR_MOVES) if (move.target !== "park") expect(byOf(move.target)).toBe("you");
  });

  it("never checks « Motivation »: traced at 5 100 ms, then empty until the end", () => {
    expect(byOf(MISSING)).toBe("missing");
    expect(BLOCKS[MISSING.block]!.groups[MISSING.group]!.lines[MISSING.line]!.label).toBe("Motivation");
    for (let t = 0; t < CYCLE_MS; t += 25) expect(frameAt(t).checked.has(checkKey(MISSING))).toBe(false);
    expect(frameAt(5099).missingTraced).toBe(false);
    expect(frameAt(5100).missingTraced).toBe(true);
  });

  it("rings one block at a time (4 ranges), plays each tile story once at the start of its first ring", () => {
    expect(RINGS).toEqual([
      { block: 0, from: 1600, to: 7200 },
      { block: 1, from: 7200, to: 10400 },
      { block: 2, from: 10800, to: 14400 },
      { block: 1, from: 14400, to: 17000 },
    ]);
    for (let t = 0; t < CYCLE_MS; t += 25) {
      expect(RINGS.filter((ring) => ring.from <= t && t < ring.to).length).toBeLessThanOrEqual(1);
    }
    expect(TILE_STORIES).toEqual([
      { block: 0, at: 1600 },
      { block: 1, at: 7200 },
      { block: 2, at: 10800 },
    ]);
    expect(frameAt(1600).story).toBe(0);
    expect(frameAt(7200).story).toBe(1);
    expect(frameAt(10800).story).toBe(2);
    // Second ring of Validation: no new story.
    expect(frameAt(14400).ring).toBe(1);
    expect(frameAt(14400).story).toBeNull();
    expect(frameAt(17000).ring).toBeNull();
  });

  it("starts each cycle with a reset: nothing checked, the cursor back to its park in 1 400 ms", () => {
    const start = frameAt(0);
    expect(start.checked.size).toBe(0);
    expect(start.cursor).toBe("park");
    expect(start.cursorMs).toBe(1400);
    expect(start.missingTraced).toBe(false);
    expect(CURSOR_MOVES.map((move) => [move.at, move.target === "park" ? "park" : checkKey(move.target), move.ms])).toEqual([
      [0, "park", 1400],
      [7400, "1:0:0", 1200],
      [9100, "1:0:1", 600],
      [10200, "park", 1000],
      [14600, "1:1:0", 1200],
    ]);
  });

  it("ends on the final state = server HTML: 15 boxes, the « Vous » pill full, cursor on « Mandat confirmé »", () => {
    const final = finalFrame();
    expect(final.checked.size).toBe(15);
    expect(final.missingTraced).toBe(true);
    expect(final.ring).toBeNull();
    expect(final.story).toBeNull();
    expect(final.pressed).toBe(false);
    expect(final.cursor).toEqual({ block: 1, group: 1, line: 0 });
    expect(pillFull(final, 1)).toBe(true);
    expect(pillFull(final, 0)).toBe(false);
    // The held end of a cycle (16 100 → 24 000 ms) is that same state.
    for (const t of [16100, 20000, CYCLE_MS - 1]) {
      const frame = frameAt(t);
      expect([...frame.checked].sort()).toEqual([...final.checked].sort());
      expect(frame.cursor).toEqual(final.cursor);
    }
    expect(pillFull(frameAt(15949), 1)).toBe(false);
    expect(pillFull(frameAt(15950), 1)).toBe(true);
  });
});

describe("EcosystemLoop: play, pause, resume, restart, reduced motion", () => {
  let snapshots: LoopSnapshot[];
  let loop: EcosystemLoop;

  beforeEach(() => {
    vi.useFakeTimers();
    snapshots = [];
    loop = new EcosystemLoop(
      {
        now: () => Date.now(),
        setTimeout: (callback, ms) => setTimeout(callback, ms) as unknown as number,
        clearTimeout: (id) => clearTimeout(id),
      },
      (snapshot) => snapshots.push(snapshot),
    );
  });

  afterEach(() => {
    loop.dispose();
    vi.useRealTimers();
  });

  const last = () => snapshots.at(-1)!;
  const timeOfStep = () => STEP_TIMES[last().index ?? 0]!;

  it("waits on the final state until it is on screen, then starts with a reset", () => {
    expect(loop.snapshot()).toEqual({ status: "paused", index: null, cycles: 0 });
    vi.advanceTimersByTime(20_000);
    expect(loop.snapshot().index).toBeNull();
    loop.setOnScreen(true);
    expect(last()).toEqual({ status: "playing", index: 0, cycles: 1 });
  });

  it("walks the steps on time and starts cycle 2 at 24 000 ms", () => {
    loop.setOnScreen(true);
    vi.advanceTimersByTime(8750);
    expect(timeOfStep()).toBe(8750);
    expect(frameAt(timeOfStep()).checked.has("1:0:0")).toBe(true);
    vi.advanceTimersByTime(CYCLE_MS - 8750 - 1);
    expect(last().cycles).toBe(1);
    vi.advanceTimersByTime(1);
    expect(last()).toEqual({ status: "playing", index: 0, cycles: 2 });
    expect(vi.getTimerCount()).toBe(1);
  });

  it("pauses off screen and in a hidden tab (no timer), then resumes at the same step with the time it had left", () => {
    loop.setOnScreen(true);
    vi.advanceTimersByTime(6000); // step 5 800, next at 6 500
    expect(timeOfStep()).toBe(5800);
    loop.setOnScreen(false);
    expect(last().status).toBe("paused");
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(60_000);
    expect(timeOfStep()).toBe(5800);
    loop.setOnScreen(true);
    expect(last()).toMatchObject({ status: "playing", cycles: 1 });
    vi.advanceTimersByTime(499);
    expect(timeOfStep()).toBe(5800);
    vi.advanceTimersByTime(1);
    expect(timeOfStep()).toBe(6500);

    loop.setPageVisible(false);
    expect(last().status).toBe("paused");
    expect(vi.getTimerCount()).toBe(0);
    loop.setPageVisible(true);
    expect(last().status).toBe("playing");
  });

  it("restart (« Rejouer les animations »): back to t = 0 now on screen, or on return off screen", () => {
    loop.setOnScreen(true);
    vi.advanceTimersByTime(12_000);
    loop.restart();
    expect(last()).toEqual({ status: "playing", index: 0, cycles: 2 });
    expect(vi.getTimerCount()).toBe(1);

    loop.setOnScreen(false);
    loop.restart();
    expect(last()).toEqual({ status: "paused", index: null, cycles: 2 });
    expect(vi.getTimerCount()).toBe(0);
    loop.setOnScreen(true);
    expect(last()).toEqual({ status: "playing", index: 0, cycles: 3 });
  });

  it("reduced motion: the final state, no timer; restart does nothing; switched back on, a fresh reset", () => {
    loop.setOnScreen(true);
    vi.advanceTimersByTime(4000);
    loop.setReduced(true);
    expect(last()).toMatchObject({ status: "reduced", index: null });
    expect(vi.getTimerCount()).toBe(0);
    const count = snapshots.length;
    loop.restart();
    expect(snapshots.length).toBe(count);
    loop.setReduced(false);
    expect(last()).toEqual({ status: "playing", index: 0, cycles: 2 });
  });
});

describe("ecosystem sources", () => {
  const DIR = join(process.cwd(), "components/landing/ecosystem");
  const code = (name: string) =>
    readFileSync(join(DIR, name), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
  const FILES = [
    "HeroEcosystem.tsx",
    "ecosystem-timeline.ts",
    "ecosystem-geometry.ts",
    "EcosystemBlock.tsx",
    "AppTile.tsx",
    "CursorYou.tsx",
    "ConvergingLines.tsx",
    "ecosystem.module.css",
    "app-tile.module.css",
  ];

  it("never uses requestAnimationFrame, anime.js nor an infinite animation; moves with transform and opacity only", () => {
    for (const name of FILES) {
      expect(code(name), name).not.toMatch(/requestAnimationFrame|infinite|@keyframes|animejs/);
    }
    const css = code("ecosystem.module.css");
    // The loop (blocks, boxes, cursor) only transitions transform and opacity; the dots are user controls.
    const loopTransitions = css.split("@media (prefers-reduced-motion: no-preference)")[1]!.split(".dotMark")[0]!;
    for (const property of loopTransitions.matchAll(/transition:\s*([^;]+);/g)) {
      for (const part of property[1]!.split(",")) {
        expect(part.trim().split(/\s+/)[0], part).toMatch(/^(transform|opacity|stroke-dashoffset|none)$/);
      }
    }
    expect(css).not.toMatch(/\bred\b|#f00\b|rgb\(2[0-9]{2} 0 0/i);
  });

  it("keeps the timings of L4-A: checks 400 / 320 / 120 ms, press 150 ms, ring 440 ms, reset 600 ms", () => {
    const css = code("ecosystem.module.css");
    expect(css).toMatch(/opacity 400ms var\(--ease-emphasis\)/);
    expect(css).toMatch(/stroke-dashoffset 320ms var\(--ease-standard\) 120ms/);
    expect(css).toMatch(/\.figure \.cursorBody \{\s*transition: transform 150ms/);
    expect(css).toMatch(/\.block::after \{\s*transition: opacity 440ms/);
    expect(css).toMatch(/opacity 600ms var\(--ease-exit\)/);
  });
});

describe("EcosystemLoop: no drift", () => {
  it("does not add up the latency of its timers: a late timer shortens the next wait", () => {
    let now = 0;
    const pending: { callback: () => void; at: number; id: number }[] = [];
    let id = 0;
    const loop = new EcosystemLoop(
      {
        now: () => now,
        setTimeout: (callback, ms) => {
          pending.push({ callback, at: now + ms, id: ++id });
          return id;
        },
        clearTimeout: (cleared) => {
          const index = pending.findIndex((entry) => entry.id === cleared);
          if (index >= 0) pending.splice(index, 1);
        },
      },
      () => {},
    );
    loop.setOnScreen(true);
    // Every timer fires 5 ms late; after a whole cycle, cycle 2 still starts at 24 000 ms (+ the last lateness only).
    let cycleTwoAt = -1;
    for (let guard = 0; guard < 400 && cycleTwoAt < 0; guard++) {
      const next = pending.shift()!;
      now = next.at + 5;
      next.callback();
      if (loop.snapshot().cycles === 2) cycleTwoAt = now;
    }
    expect(cycleTwoAt).toBe(CYCLE_MS + 5);
  });
});
