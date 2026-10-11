import { describe, expect, it } from "vitest";

import { LABEL_GAP_PX } from "./tech-accent";
import { OUTLINE_PX, labelTop, paintFrame, paintLetters, type LetterPaint, type MeasuredLetter, type Palette } from "./paint-tech-accent";

type Call = { op: string; char?: string; lineWidth: number; dash: number[]; composite: string; alpha: number; y?: number };

/** Minimal 2D context that records every drawing operation with its state. */
function recordingContext() {
  const calls: Call[] = [];
  let dash: number[] = [];
  const state = {
    font: "",
    letterSpacing: "0px",
    textBaseline: "alphabetic",
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
  };
  const snapshot = (op: string, char?: string, y?: number): Call => ({
    op,
    char,
    lineWidth: state.lineWidth,
    dash: [...dash],
    composite: state.globalCompositeOperation,
    alpha: state.globalAlpha,
    y,
  });
  const context = Object.assign(state, {
    setLineDash: (segments: number[]) => {
      dash = [...segments];
    },
    strokeText: (char: string) => calls.push(snapshot("strokeText", char)),
    fillText: (char: string, _x: number, y: number) => calls.push(snapshot("fillText", char, y)),
    strokeRect: (_x: number, y: number) => calls.push(snapshot("strokeRect", undefined, y)),
    fillRect: () => calls.push(snapshot("fillRect")),
    measureText: (text: string) => ({ width: text.length * 7 }),
    beginPath: () => {},
    roundRect: (_x: number, y: number) => calls.push(snapshot("roundRect", undefined, y)),
    fill: () => {},
  });
  return { context: context as unknown as CanvasRenderingContext2D, calls, state };
}

const palette: Palette = { ink: "#111", accent: "#24c", surface: "#fff", labelFont: "11px mono" };

function letter(char: string, x: number): MeasuredLetter {
  const box = { x, y: 0, width: 10, height: 20 };
  return { char, box, x, baseline: 16, ink: box };
}

const letters = [letter("d", 0), letter("é", 20), letter("c", 40)];

describe("paintLetters — outer contour only (docs/design-system.md §2.11.3, §2.11.8.2)", () => {
  it("strokes dashed at 2 × OUTLINE_PX, cuts the glyph out, then fills plain letters", () => {
    const { context, calls, state } = recordingContext();
    const paints: LetterPaint[] = [
      { outline: 1, dx: 0, dy: 0 },
      { outline: 0.4, dx: 0, dy: 0 },
      { outline: 0, dx: 0, dy: 0 },
    ];
    paintLetters(context, letters, paints, "italic 400 68px serif", palette);

    expect(OUTLINE_PX).toBe(1.5);
    expect(calls.map((call) => `${call.op}:${call.char}:${call.composite}`)).toEqual([
      "strokeText:d:source-over",
      "strokeText:é:source-over",
      "fillText:d:destination-out",
      "fillText:é:destination-out",
      "fillText:é:source-over",
      "fillText:c:source-over",
    ]);
    for (const call of calls.filter((entry) => entry.op === "strokeText")) {
      expect(call.lineWidth).toBe(3);
      expect(call.dash).toEqual([4, 2]);
    }
    for (const call of calls.filter((entry) => entry.composite === "destination-out")) expect(call.alpha).toBe(1);
    expect(calls[1]?.alpha).toBe(0.4);
    expect(calls[4]?.alpha).toBeCloseTo(0.6);
    expect(state.globalCompositeOperation).toBe("source-over");
    expect(state.globalAlpha).toBe(1);
  });

  it("never cuts anything when no letter is outlined", () => {
    const { context, calls } = recordingContext();
    paintLetters(context, letters, [], "italic 400 68px serif", palette);
    expect(calls.every((call) => call.op === "fillText" && call.composite === "source-over")).toBe(true);
    expect(calls).toHaveLength(3);
  });
});

describe("paintFrame — the label sits 6 px UNDER the frame", () => {
  it("places the label below the bottom edge of the frame, never above", () => {
    expect(LABEL_GAP_PX).toBe(6);
    expect(labelTop(10.5, 40)).toBe(56.5);
    const { context, calls } = recordingContext();
    paintFrame(context, { x: 20, y: 10, width: 30, height: 40 }, { letter: letters[0]! }, 1, palette);
    const frame = calls.find((call) => call.op === "strokeRect");
    const tag = calls.find((call) => call.op === "roundRect");
    expect(frame?.y).toBe(10.5);
    expect(tag?.y).toBe(10.5 + 40 + 6);
  });

  it("paints nothing at opacity 0", () => {
    const { context, calls } = recordingContext();
    paintFrame(context, { x: 0, y: 0, width: 10, height: 10 }, { letter: letters[0]! }, 0, palette);
    expect(calls).toHaveLength(0);
  });
});
