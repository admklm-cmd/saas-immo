import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { LANDING_TEXTS } from "@/components/landing-texts";

import {
  capDrag,
  createSpecks,
  cubicBezier,
  distanceToWord,
  DRAG_LIMIT_EM,
  letterAt,
  letterLabel,
  nearestLetter,
  outlineAmount,
  simulateSpring,
  speckAlpha,
  speckCount,
  specksDuration,
  SWEEP_DELAY_MS,
  sweepAt,
  sweepDuration,
  sweepStops,
} from "./tech-accent";

/** « décide »: the accented word of the control title (docs/design-system.md §2.11.8.2). */
const WORD = LANDING_TEXTS.control.titleAccent;
const LETTERS = Array.from(WORD).length;

describe("tech-accent: sweep (docs/design-system.md §2.11.8.2)", () => {
  it("is the word « décide », six letters", () => {
    expect(WORD).toBe("décide");
    expect(LETTERS).toBe(6);
  });

  it("starts 760 ms after the entry and lasts at most 1 600 ms (end ≤ 2 360 ms after the entry)", () => {
    expect(SWEEP_DELAY_MS).toBe(760);
    expect(sweepDuration(LETTERS)).toBeLessThanOrEqual(1600);
    expect(SWEEP_DELAY_MS + sweepDuration(LETTERS)).toBeLessThanOrEqual(2360);
    expect(sweepAt(sweepDuration(LETTERS), LETTERS)).toMatchObject({ done: true, opacity: 0 });
  });

  it("stops on the six letters, in order: d, é, c, i, d, e", () => {
    const stops = sweepStops(LETTERS);
    expect(stops.map((stop) => stop.letter)).toEqual([0, 1, 2, 3, 4, 5]);
    for (let i = 1; i < stops.length; i++) expect(stops[i]!.at).toBeGreaterThan(stops[i - 1]!.at);
    for (const stop of stops) expect(sweepAt(stop.at + 1, LETTERS).position).toBe(stop.letter);
  });

  it("only moves forward, fades in and out, and never comes back", () => {
    let previous = -1;
    for (let t = 0; t < sweepDuration(LETTERS); t += 10) {
      const frame = sweepAt(t, LETTERS);
      expect(frame.position).toBeGreaterThanOrEqual(previous - 1e-9);
      expect(frame.opacity).toBeGreaterThanOrEqual(0);
      expect(frame.opacity).toBeLessThanOrEqual(1);
      previous = frame.position;
    }
    expect(sweepAt(0, LETTERS).opacity).toBe(0);
    expect(sweepAt(sweepDuration(LETTERS) + 5_000, LETTERS).done).toBe(true);
  });
});

describe("tech-accent: drag and spring", () => {
  it("caps the drag below 0.6 em with a progressive brake (80 px at 64 px → < 38.4 px)", () => {
    for (const em of [38, 64, 68]) {
      for (const distance of [10, 60, 80, 400, 5_000]) {
        const offset = capDrag(distance, 0, em);
        expect(Math.hypot(offset.x, offset.y)).toBeLessThanOrEqual(DRAG_LIMIT_EM * em);
        expect(offset.x).toBeLessThanOrEqual(distance);
      }
    }
    const diagonal = capDrag(300, -300, 64);
    expect(diagonal.x).toBeCloseTo(-diagonal.y, 6);
    expect(capDrag(0, 0, 64)).toEqual({ x: 0, y: 0 });
  });

  it("brings the letter back within 0.5 px in ≤ 700 ms, overshoot ≤ 6 px", () => {
    // Title sizes 36 / 60 / 64 px, accent at 1.06 ×.
    for (const em of [38.2, 63.6, 67.8]) {
      const start = DRAG_LIMIT_EM * em;
      const { settleMs, overshoot } = simulateSpring(start);
      expect(settleMs, `from ${start} px`).toBeLessThanOrEqual(700);
      expect(overshoot, `from ${start} px`).toBeLessThanOrEqual(6);
    }
  });
});

describe("tech-accent: specks", () => {
  it("are 10 on a large screen with a fine pointer, 6 otherwise", () => {
    expect(speckCount(true)).toBe(10);
    expect(speckCount(false)).toBe(6);
    expect(createSpecks(speckCount(true), 0)).toHaveLength(10);
    expect(createSpecks(speckCount(false), 0)).toHaveLength(6);
  });

  it("land at the same place for the same seed, elsewhere for another seed; half cobalt, half ink", () => {
    expect(createSpecks(10, 2)).toEqual(createSpecks(10, 2));
    expect(createSpecks(10, 2, 1)).not.toEqual(createSpecks(10, 2, 2));
    for (const speck of createSpecks(10, 3)) {
      expect(speck.size).toBeGreaterThanOrEqual(2);
      expect(speck.size).toBeLessThanOrEqual(4);
      expect(speck.u).toBeGreaterThanOrEqual(0);
      expect(speck.u).toBeLessThan(1);
    }
    expect(createSpecks(10, 0).filter((speck) => speck.tone === "accent")).toHaveLength(5);
  });

  it("blink twice then stay off", () => {
    expect(speckAlpha(0, 0)).toBe(0);
    expect(speckAlpha(180, 0)).toBeCloseTo(1, 6);
    expect(speckAlpha(540, 0)).toBeCloseTo(1, 6);
    expect(speckAlpha(720, 0)).toBe(0);
    expect(speckAlpha(specksDuration(10) + 1, 9)).toBe(0);
  });
});

describe("tech-accent: reach, letters, label, easing", () => {
  it("turns the letters near the pointer into an outline, softly", () => {
    expect(outlineAmount(0, 50)).toBe(1);
    expect(outlineAmount(50 * 0.65, 50)).toBe(1);
    expect(outlineAmount(50, 50)).toBe(0);
    const middle = outlineAmount(50 * 0.82, 50);
    expect(middle).toBeGreaterThan(0);
    expect(middle).toBeLessThan(1);
  });

  it("finds the letter under, nearest to, and the distance to the word", () => {
    const boxes = [0, 30, 60].map((x) => ({ x, y: 0, width: 28, height: 40 }));
    expect(letterAt(45, 20, boxes)).toBe(1);
    expect(letterAt(29, 20, boxes)).toBe(-1);
    expect(nearestLetter(80, 200, boxes)).toBe(2);
    expect(distanceToWord(74, 20, boxes)).toBe(0);
    expect(distanceToWord(74, 120, boxes)).toBe(100);
    expect(distanceToWord(0, 0, [])).toBe(Infinity);
  });

  it("labels a letter with the size of its ink", () => {
    expect(letterLabel("d", 27.6, 46.2)).toBe("d  28 × 46");
  });

  it("matches the CSS cubic-bezier at its ends and is monotonic", () => {
    const ease = cubicBezier(0.16, 1, 0.3, 1);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    let previous = 0;
    for (let x = 0.05; x < 1; x += 0.05) {
      expect(ease(x)).toBeGreaterThanOrEqual(previous);
      previous = ease(x);
    }
    expect(cubicBezier(0.25, 0.25, 0.75, 0.75)(0.4)).toBeCloseTo(0.4, 4);
  });
});

describe("tech-accent sources", () => {
  const FILES = ["tech-accent.ts", "paint-tech-accent.ts", "tech-accent-engine.ts", "TechAccent.tsx", "TechAccent.module.css"];
  const read = (name: string) => readFileSync(join(process.cwd(), "components/ui/tech-accent", name), "utf8");
  /** The code only: comments say what is NOT done (« no preventDefault »). */
  const code = (name: string) =>
    read(name)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");

  it("credit React Bits — TechText, never use Math.random, glow, filters nor infinite animations", () => {
    for (const name of FILES) {
      expect(code(name), name).not.toMatch(/Math\.random|shadowBlur|drop-shadow|\.filter\s*=|infinite/);
      expect(read(name), name).toMatch(/Adapted from React Bits — TechText \(https:\/\/reactbits\.dev\)/);
      expect(read(name), name).toMatch(/Copyright \(c\) 2026 David Haz/);
      expect(read(name), name).toMatch(/THIRD_PARTY_NOTICES\.md/);
    }
  });

  it("keeps the React Bits licence notice verbatim and cites the new files (T4)", () => {
    const notices = readFileSync(join(process.cwd(), "THIRD_PARTY_NOTICES.md"), "utf8");
    expect(notices).toMatch(/## React Bits — TechText/);
    expect(notices).toMatch(/MIT \+ Commons Clause License Condition v1\.0/);
    expect(notices).toMatch(/Copyright \(c\) 2026 David Haz/);
    expect(notices).toMatch(/The above copyright notice and this permission notice shall be included in all/);
    expect(notices).toMatch(/do not sell, sublicense, or redistribute the components themselves/);
    expect(notices).toMatch(/THE SOFTWARE IS PROVIDED "AS IS"/);
    for (const name of FILES) expect(notices).toContain(name);
    expect(notices).toContain("components/ui/tech-accent/");
    expect(notices).not.toMatch(/components\/landing\/wordmark/);
  });

  it("never blocks the scroll: no preventDefault, no touch-action change", () => {
    for (const name of FILES) expect(code(name), name).not.toMatch(/preventDefault|touch-action/);
  });

  it("only runs requestAnimationFrame while painting (never at rest)", () => {
    const engine = code("tech-accent-engine.ts");
    expect(engine).toMatch(/if \(this\.raf === null && this\.painting\) this\.raf = requestAnimationFrame/);
    expect(code("TechAccent.tsx")).not.toMatch(/requestAnimationFrame/);
  });
});
