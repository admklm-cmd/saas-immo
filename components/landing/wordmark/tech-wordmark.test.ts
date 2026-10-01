import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { BRAND } from "@/components/brand";

import {
  capDrag,
  createSpecks,
  cubicBezier,
  DRAG_LIMIT_EM,
  letterAt,
  letterLabel,
  nearestLetter,
  outlineAmount,
  simulateSpring,
  speckAlpha,
  speckCount,
  specksDuration,
  sweepAt,
  sweepDuration,
  sweepStops,
} from "./tech-wordmark";

const LETTERS = BRAND.shortName.length;

describe("tech-wordmark: sweep, played once (docs/design-system.md §2.11.3)", () => {
  it("lasts at most 1 600 ms", () => {
    expect(sweepDuration(LETTERS)).toBeLessThanOrEqual(1600);
    expect(sweepAt(sweepDuration(LETTERS), LETTERS)).toMatchObject({ done: true, opacity: 0 });
  });

  it("stops on the six letters, in order, A then s, c, e, n, d", () => {
    const stops = sweepStops(LETTERS);
    expect(stops.map((stop) => stop.letter)).toEqual([0, 1, 2, 3, 4, 5]);
    for (let i = 1; i < stops.length; i++) expect(stops[i]!.at).toBeGreaterThan(stops[i - 1]!.at);
    // The frame really sits on each letter at its stop.
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

describe("tech-wordmark: drag and spring", () => {
  it("caps the drag below 0.6 em with a progressive brake", () => {
    const em = 200;
    for (const distance of [10, 60, 120, 400, 5_000]) {
      const offset = capDrag(distance, 0, em);
      expect(Math.hypot(offset.x, offset.y)).toBeLessThanOrEqual(DRAG_LIMIT_EM * em);
      expect(offset.x).toBeLessThanOrEqual(distance);
    }
    // Direction kept.
    const diagonal = capDrag(300, -300, em);
    expect(diagonal.x).toBeCloseTo(-diagonal.y, 6);
    expect(capDrag(0, 0, em)).toEqual({ x: 0, y: 0 });
  });

  it("brings the letter back within 0.5 px in ≤ 700 ms, overshoot ≤ 6 px", () => {
    for (const em of [64, 160, 207, 240]) {
      const start = DRAG_LIMIT_EM * em;
      const { settleMs, overshoot } = simulateSpring(start);
      expect(settleMs, `from ${start} px`).toBeLessThanOrEqual(700);
      expect(overshoot, `from ${start} px`).toBeLessThanOrEqual(6);
    }
  });
});

describe("tech-wordmark: specks", () => {
  it("are 15 on a large screen with a fine pointer, 8 otherwise", () => {
    expect(speckCount(true)).toBe(15);
    expect(speckCount(false)).toBe(8);
    expect(createSpecks(speckCount(true), 0)).toHaveLength(15);
    expect(createSpecks(speckCount(false), 0)).toHaveLength(8);
  });

  it("land at the same place for the same seed, elsewhere for another seed", () => {
    expect(createSpecks(15, 2)).toEqual(createSpecks(15, 2));
    expect(createSpecks(15, 2, 1)).not.toEqual(createSpecks(15, 2, 2));
    for (const speck of createSpecks(15, 3)) {
      expect(speck.size).toBeGreaterThanOrEqual(2);
      expect(speck.size).toBeLessThanOrEqual(4);
      expect(speck.u).toBeGreaterThanOrEqual(0);
      expect(speck.u).toBeLessThan(1);
    }
    const tones = createSpecks(14, 0).map((speck) => speck.tone);
    expect(tones.filter((tone) => tone === "accent")).toHaveLength(7);
  });

  it("blink twice then stay off", () => {
    expect(speckAlpha(0, 0)).toBe(0);
    expect(speckAlpha(180, 0)).toBeCloseTo(1, 6);
    expect(speckAlpha(540, 0)).toBeCloseTo(1, 6);
    expect(speckAlpha(720, 0)).toBe(0);
    expect(speckAlpha(specksDuration(15) + 1, 14)).toBe(0);
  });
});

describe("tech-wordmark: reach, letters, label, easing", () => {
  it("turns the letters near the pointer into an outline, softly", () => {
    expect(outlineAmount(0, 150)).toBe(1);
    expect(outlineAmount(150 * 0.65, 150)).toBe(1);
    expect(outlineAmount(150, 150)).toBe(0);
    const middle = outlineAmount(150 * 0.82, 150);
    expect(middle).toBeGreaterThan(0);
    expect(middle).toBeLessThan(1);
  });

  it("finds the letter under and nearest to a point", () => {
    const boxes = [0, 100, 200].map((x) => ({ x, y: 0, width: 90, height: 100 }));
    expect(letterAt(150, 50, boxes)).toBe(1);
    expect(letterAt(95, 50, boxes)).toBe(-1);
    expect(nearestLetter(260, 400, boxes)).toBe(2);
  });

  it("labels a letter with the size of its ink", () => {
    expect(letterLabel("A", 117.6, 152.2)).toBe("A  118 × 152");
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

describe("wordmark sources", () => {
  const read = (name: string) => readFileSync(join(process.cwd(), "components/landing/wordmark", name), "utf8");
  /** The code only: comments say what is NOT done (« no preventDefault »). */
  const code = (name: string) =>
    read(name)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");

  it("credit React Bits, never use Math.random, glow, filters nor loops", () => {
    for (const name of ["tech-wordmark.ts", "paint-wordmark.ts", "wordmark-engine.ts", "TechWordmark.tsx", "TechWordmark.module.css"]) {
      const source = code(name);
      expect(source, name).not.toMatch(/Math\.random|shadowBlur|drop-shadow|\.filter\s*=|infinite/);
    }
    expect(read("tech-wordmark.ts")).toMatch(/Adapted from React Bits — TechText \(https:\/\/reactbits\.dev\)/);
    expect(read("TechWordmark.tsx")).toMatch(/Adapted from React Bits — TechText \(https:\/\/reactbits\.dev\)/);
  });

  it("keeps the React Bits copyright and licence notice (MIT + Commons Clause)", () => {
    for (const name of ["tech-wordmark.ts", "paint-wordmark.ts", "wordmark-engine.ts", "TechWordmark.tsx", "TechWordmark.module.css"]) {
      const source = read(name);
      expect(source, name).toMatch(/Copyright \(c\) 2026 David Haz/);
      expect(source, name).toMatch(/THIRD_PARTY_NOTICES\.md/);
    }
    const notices = readFileSync(join(process.cwd(), "THIRD_PARTY_NOTICES.md"), "utf8");
    expect(notices).toMatch(/MIT \+ Commons Clause License Condition v1\.0/);
    expect(notices).toMatch(/Copyright \(c\) 2026 David Haz/);
    expect(notices).toMatch(/The above copyright notice and this permission notice shall be included in all/);
    expect(notices).toMatch(/do not sell, sublicense, or redistribute the components themselves/);
    expect(notices).toMatch(/THE SOFTWARE IS PROVIDED "AS IS"/);
  });

  it("never blocks the scroll on touch", () => {
    const css = read("TechWordmark.module.css");
    expect(css).toMatch(/touch-action:\s*pan-y pinch-zoom/);
    expect(code("TechWordmark.tsx")).not.toMatch(/preventDefault/);
    expect(code("wordmark-engine.ts")).not.toMatch(/preventDefault/);
  });
});
