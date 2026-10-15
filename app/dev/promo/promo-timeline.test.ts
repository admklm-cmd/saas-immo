import { describe, expect, it } from "vitest";

import { PROMO_TEXTS } from "./promo-texts";
import {
  blinkOn,
  cubicBezier,
  DOSSIER_KEYS,
  dossierStation,
  DURATION_MS,
  easeInOut,
  easeOut,
  frameCount,
  frameTimeMs,
  requiredReadingMs,
  sweepEdge,
  sweepTint,
  T,
  TERMINAL_LINES,
  terminalView,
  TEXT_BEATS,
  title1Chars,
  title2Chars,
  typedCount,
} from "./promo-timeline";

describe("frame times", () => {
  it("has 990 frames at 30 fps and 1 980 at 60 fps over 33 s", () => {
    expect(DURATION_MS).toBe(33_000);
    expect(frameCount(30)).toBe(990);
    expect(frameCount(60)).toBe(1980);
    expect(frameTimeMs(0, 30)).toBe(0);
    expect(frameTimeMs(989, 30)).toBeLessThan(DURATION_MS);
  });
});

describe("easings", () => {
  it("start at 0, end at 1 and never go back (no rebound)", () => {
    for (const ease of [easeOut, easeInOut, cubicBezier(0.55, 0, 1, 0.45)]) {
      expect(ease(0)).toBe(0);
      expect(ease(1)).toBe(1);
      let previous = 0;
      for (let k = 1; k <= 100; k++) {
        const value = ease(k / 100);
        expect(value).toBeGreaterThanOrEqual(previous - 1e-9);
        previous = value;
      }
    }
  });

  it("is deterministic", () => {
    expect(easeInOut(0.37)).toBe(easeInOut(0.37));
  });
});

describe("reading time (criterion 5)", () => {
  it.each(TEXT_BEATS)("shows « $id » fully for at least words / 3 + 0.5 s", (beat) => {
    expect(beat.fullTo - beat.fullFrom).toBeGreaterThanOrEqual(requiredReadingMs(beat.words));
  });

  it("covers every title of the film", () => {
    expect(TEXT_BEATS.map((beat) => beat.id)).toEqual(["title1", "title2", "main4", "title5", "signature"]);
  });
});

describe("typing", () => {
  it("types title 1 at 36 ms per character, then erases it by backspace", () => {
    expect(title1Chars(0)).toBe(0);
    expect(title1Chars(T.title1TypeFrom)).toBe(1);
    expect(title1Chars(T.title1EraseFrom - 1)).toBe(PROMO_TEXTS.title1.length);
    expect(title1Chars(T.title1EraseFrom + 14 * PROMO_TEXTS.title1.length + 50)).toBe(0);
  });

  it("types title 2 and erases it before the sweep starts", () => {
    expect(title2Chars(T.title2TypeFrom - 1)).toBe(0);
    expect(title2Chars(T.title2EraseFrom - 1)).toBe(PROMO_TEXTS.title2.length);
    expect(title2Chars(T.sweepFrom)).toBe(0);
  });

  it("caps the typed count", () => {
    expect(typedCount(10_000, 0, 24, 5)).toBe(5);
    expect(typedCount(-5, 0, 24, 5)).toBe(0);
  });

  it("shows at most three terminal lines, the human line typed slower than the machine", () => {
    for (let t = 0; t <= DURATION_MS; t += 250) expect(terminalView(t).length).toBeLessThanOrEqual(3);
    const human = TERMINAL_LINES.find((line) => line.kind === "human")!;
    const machine = TERMINAL_LINES.find((line) => line.kind === "machine")!;
    expect(human.msPerChar).toBe(52);
    expect(machine.msPerChar).toBe(24);
  });

  it("blinks the cursor", () => {
    expect(blinkOn(0)).toBe(true);
    expect(blinkOn(600)).toBe(false);
  });
});

describe("dossier", () => {
  it("reaches the stations at the times of the storyboard", () => {
    expect(dossierStation(10_300)).toBeCloseTo(0, 5);
    expect(dossierStation(11_500)).toBeCloseTo(1, 5);
    expect(dossierStation(12_700)).toBeCloseTo(2, 5);
  });

  it("waits still in front of the barrier until it opens, then never reaches the mandate", () => {
    expect(dossierStation(14_500)).toBe(dossierStation(17_000));
    expect(dossierStation(14_500)).toBeLessThan(3);
    expect(dossierStation(20_000)).toBeLessThan(6);
    expect(dossierStation(25_000)).toBe(dossierStation(20_000));
  });

  it("never goes backwards", () => {
    let previous = -Infinity;
    for (let t = DOSSIER_KEYS[0]![0]; t <= 21_000; t += 50) {
      const s = dossierStation(t);
      expect(s).toBeGreaterThanOrEqual(previous);
      previous = s;
    }
  });
});

describe("sweep", () => {
  it("crosses the stage with a 300 px front", () => {
    expect(sweepEdge(T.sweepFrom - 1, T.sweepFrom, T.sweepTo, 1920)).toBe(0);
    expect(sweepEdge(T.sweepTo, T.sweepFrom, T.sweepTo, 1920)).toBe(2220);
    expect(sweepTint(100, 100)).toBe(0);
    expect(sweepTint(100, 400)).toBe(1);
    expect(sweepTint(100, 250)).toBeCloseTo(0.5, 5);
  });
});
