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
  RINGS,
  STEP_TIMES,
  checkKey,
  finalFrame,
  frameAt,
  pillFull,
  stepDelay,
  type LoopSnapshot,
} from "./ecosystem-timeline";

const CARDS = LANDING_TEXTS.journey.cards;

describe("ecosystem timeline (docs/design-system.md §2.11.8.3)", () => {
  it("follows the cards of the texts: who checks each line", () => {
    expect(ECOSYSTEM_LAYOUT).toEqual(CARDS.map((card) => card.lines.map((line) => line.by)));
    expect(CARDS.map((card) => card.name)).toEqual(LANDING_TEXTS.journey.steps.map((step) => step.actor));
  });

  it("lasts 9 800 ms; its steps start at 0 (the reset) and stay inside the cycle", () => {
    expect(CYCLE_MS).toBe(9800);
    expect(STEP_TIMES[0]).toBe(0);
    expect(STEP_TIMES.every((time, index) => index === 0 || time > STEP_TIMES[index - 1]!)).toBe(true);
    expect(STEP_TIMES.at(-1)!).toBeLessThan(CYCLE_MS);
    expect(STEP_TIMES.reduce((sum, _time, index) => sum + stepDelay(index), 0)).toBe(CYCLE_MS);
  });

  it("checks the 15 boxes at the instants of the spec: 12 by the agents, 3 by you", () => {
    expect(CHECKS.map((check) => [checkKey(check), check.at])).toEqual([
      ["0:0", 900],
      ["0:1", 1180],
      ["0:2", 1460],
      ["1:0", 1740],
      ["1:1", 2020],
      ["2:0", 2580],
      ["2:1", 2860],
      ["3:0", 3700],
      ["3:1", 4220],
      ["4:0", 4500],
      ["4:1", 4780],
      ["5:0", 5060],
      ["5:1", 5340],
      ["5:2", 5620],
      ["6:0", 6700],
    ]);
    const by = CHECKS.map((check) => ECOSYSTEM_LAYOUT[check.card]![check.line]);
    expect(by.filter((who) => who === "agent")).toHaveLength(12);
    expect(by.filter((who) => who === "you")).toHaveLength(3);
    // Every agent line and every human line is checked once per cycle; the cadence of an agent is 280 ms.
    expect(new Set(CHECKS.map(checkKey)).size).toBe(15);
    for (const card of [0, 1, 2, 4, 5]) {
      const times = CHECKS.filter((check) => check.card === card).map((check) => check.at);
      for (let i = 1; i < times.length; i++) expect(times[i]! - times[i - 1]!).toBe(AGENT_CADENCE_MS);
      expect(AGENT_CADENCE_MS).toBe(280);
    }
  });

  it("checks the boxes in the order of the dossier: Léa, Hugo, Emma, you, Louis, Sarah, you", () => {
    const cards = CHECKS.map((check) => check.card);
    expect(cards).toEqual([...cards].sort((a, b) => a - b));
  });

  it("never lets an agent check a human box: a « you » box is checked only after the cursor has arrived on it", () => {
    for (const check of CHECKS.filter((entry) => ECOSYSTEM_LAYOUT[entry.card]![entry.line] === "you")) {
      const move = CURSOR_MOVES.find((entry) => entry.target !== "park" && checkKey(entry.target) === checkKey(check));
      expect(move, checkKey(check)).toBeDefined();
      expect(move!.at + move!.ms, `cursor on ${checkKey(check)} before its check`).toBeLessThan(check.at);
      // At the instant of the check, the cursor is still on that box.
      const frame = frameAt(check.at);
      expect(frame.cursor).toEqual({ card: check.card, line: check.line });
      // Just before the cursor arrives, the box is empty.
      expect(frameAt(move!.at + move!.ms - 1).checked.has(checkKey(check))).toBe(false);
    }
    // No « you » box is checked by any other event: every check of a human card follows a cursor move.
    for (const [card, lines] of ECOSYSTEM_LAYOUT.entries()) {
      lines.forEach((who, line) => {
        if (who !== "agent") return;
        expect(CURSOR_MOVES.some((move) => move.target !== "park" && checkKey(move.target) === checkKey({ card, line }))).toBe(false);
      });
    }
  });

  it("never checks « Motivation »: traced at 2 300 ms, then empty until the end", () => {
    expect(ECOSYSTEM_LAYOUT[MISSING.card]![MISSING.line]).toBe("missing");
    expect(CARDS[MISSING.card]!.lines[MISSING.line]!.label).toBe("Motivation");
    for (let t = 0; t < CYCLE_MS; t += 20) expect(frameAt(t).checked.has(checkKey(MISSING))).toBe(false);
    expect(frameAt(2299).missingTraced).toBe(false);
    expect(frameAt(2300).missingTraced).toBe(true);
  });

  it("rings one card at a time, in order, and none in the held final state", () => {
    expect(RINGS.map((ring) => ring.card)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    for (let t = 0; t < CYCLE_MS; t += 20) {
      const active = RINGS.filter((ring) => ring.from <= t && t < ring.to);
      expect(active.length).toBeLessThanOrEqual(1);
    }
    expect(frameAt(7200).ring).toBeNull();
  });

  it("starts each cycle with a reset: nothing checked, the cursor back to its park in 900 ms", () => {
    const start = frameAt(0);
    expect(start.checked.size).toBe(0);
    expect(start.cursor).toBe("park");
    expect(start.cursorMs).toBe(900);
    expect(start.missingTraced).toBe(false);
  });

  it("ends on the final state = server HTML: 12 agent boxes, 3 « you » boxes, 2 full pills, cursor on the mandate", () => {
    const final = finalFrame();
    expect(final.checked.size).toBe(15);
    expect(final.missingTraced).toBe(true);
    expect(final.ring).toBeNull();
    expect(final.pressed).toBe(false);
    expect(final.cursor).toEqual({ card: 6, line: 0 });
    expect(pillFull(final, 3)).toBe(true);
    expect(pillFull(final, 6)).toBe(true);
    expect(pillFull(final, 0)).toBe(false);
    // The held end of a cycle is that same state.
    for (const t of [6740, 8000, CYCLE_MS - 1]) {
      const frame = frameAt(t);
      expect([...frame.checked].sort()).toEqual([...final.checked].sort());
      expect(frame.cursor).toEqual(final.cursor);
    }
    expect(pillFull(frameAt(4219), 3)).toBe(false);
    expect(pillFull(frameAt(4220), 3)).toBe(true);
  });
});

describe("EcosystemLoop: play, pause, resume, reduced motion", () => {
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
    expect(vi.getTimerCount()).toBe(0);
    loop.setOnScreen(true);
    expect(last()).toEqual({ status: "playing", index: 0, cycles: 1 });
    expect(vi.getTimerCount()).toBe(1);
  });

  it("walks the steps on time and starts cycle 2 at 9 800 ms", () => {
    loop.setOnScreen(true);
    vi.advanceTimersByTime(3700);
    expect(timeOfStep()).toBe(3700);
    expect(frameAt(timeOfStep()).checked.has("3:0")).toBe(true);
    vi.advanceTimersByTime(CYCLE_MS - 3700 - 1);
    expect(last().cycles).toBe(1);
    vi.advanceTimersByTime(1);
    expect(last()).toEqual({ status: "playing", index: 0, cycles: 2 });
    // Never more than one timer armed.
    expect(vi.getTimerCount()).toBe(1);
  });

  it("pauses off screen and in a hidden tab (no timer), then resumes at the same step with the time it had left", () => {
    loop.setOnScreen(true);
    vi.advanceTimersByTime(3000); // step 2 860, next at 3 140
    expect(timeOfStep()).toBe(2860);
    loop.setOnScreen(false);
    expect(last().status).toBe("paused");
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(60_000);
    expect(timeOfStep()).toBe(2860);
    loop.setOnScreen(true);
    expect(last()).toMatchObject({ status: "playing", cycles: 1 });
    expect(timeOfStep()).toBe(2860);
    vi.advanceTimersByTime(139);
    expect(timeOfStep()).toBe(2860);
    vi.advanceTimersByTime(1);
    expect(timeOfStep()).toBe(3140);

    loop.setPageVisible(false);
    expect(last().status).toBe("paused");
    expect(vi.getTimerCount()).toBe(0);
    loop.setPageVisible(true);
    expect(last().status).toBe("playing");
    // Visible tab but off screen: still paused.
    loop.setOnScreen(false);
    loop.setPageVisible(true);
    expect(last().status).toBe("paused");
  });

  it("reduced motion: the final state, no timer; switched back on, a fresh reset when on screen", () => {
    loop.setOnScreen(true);
    vi.advanceTimersByTime(4000);
    loop.setReduced(true);
    expect(last()).toMatchObject({ status: "reduced", index: null });
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(30_000);
    loop.setOnScreen(true);
    expect(last().status).toBe("reduced");
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

  it("never uses requestAnimationFrame nor an infinite animation; moves with transform and opacity only", () => {
    for (const name of ["HeroEcosystem.tsx", "ecosystem-timeline.ts", "ecosystem-geometry.ts", "EcosystemCard.tsx", "CursorYou.tsx", "ConvergingLines.tsx", "ecosystem.module.css"]) {
      expect(code(name), name).not.toMatch(/requestAnimationFrame|infinite|@keyframes/);
    }
    const css = code("ecosystem.module.css");
    // The loop (cards, boxes, cursor) only transitions transform and opacity; the dots are user controls.
    const loopTransitions = css.split("@media (prefers-reduced-motion: no-preference)")[1]!.split(".dotMark")[0]!;
    for (const property of loopTransitions.matchAll(/transition:\s*([^;]+);/g)) {
      for (const part of property[1]!.split(",")) {
        expect(part.trim().split(/\s+/)[0], part).toMatch(/^(transform|opacity|stroke-dashoffset|none)$/);
      }
    }
    expect(css).not.toMatch(/\bred\b|#f00\b|rgb\(2[0-9]{2} 0 0/i);
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
    // Every timer fires 5 ms late; after a whole cycle, cycle 2 still starts at 9 800 ms (+ the last lateness only).
    let cycleTwoAt = -1;
    for (let guard = 0; guard < 200 && cycleTwoAt < 0; guard++) {
      const next = pending.shift()!;
      now = next.at + 5;
      next.callback();
      if (loop.snapshot().cycles === 2) cycleTwoAt = now;
    }
    expect(cycleTwoAt).toBe(CYCLE_MS + 5);
  });
});
