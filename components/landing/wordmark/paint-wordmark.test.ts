import { describe, expect, it } from "vitest";

import { OUTLINE_PX, paintLetters, type LetterPaint, type MeasuredLetter, type Palette } from "./paint-wordmark";

type Call = { op: string; char?: string; lineWidth: number; dash: number[]; composite: string; alpha: number };

/** Minimal 2D context that records every text operation with its state. */
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
  const snapshot = (op: string, char?: string): Call => ({
    op,
    char,
    lineWidth: state.lineWidth,
    dash: [...dash],
    composite: state.globalCompositeOperation,
    alpha: state.globalAlpha,
  });
  const context = Object.assign(state, {
    setLineDash: (segments: number[]) => {
      dash = [...segments];
    },
    strokeText: (char: string) => calls.push(snapshot("strokeText", char)),
    fillText: (char: string) => calls.push(snapshot("fillText", char)),
  });
  return { context: context as unknown as CanvasRenderingContext2D, calls, state };
}

const palette: Palette = { ink: "#111", accent: "#24c", surface: "#fff", labelFont: "11px mono" };

function letter(char: string, x: number): MeasuredLetter {
  const box = { x, y: 0, width: 10, height: 20 };
  return { char, box, x, baseline: 16, ink: box };
}

const letters = [letter("A", 0), letter("s", 20), letter("c", 40)];

describe("paintLetters — outer contour only", () => {
  it("strokes dashed at 2 × OUTLINE_PX, cuts the glyph out, then fills plain letters", () => {
    const { context, calls, state } = recordingContext();
    const paints: LetterPaint[] = [
      { outline: 1, dx: 0, dy: 0 },
      { outline: 0.4, dx: 0, dy: 0 },
      { outline: 0, dx: 0, dy: 0 },
    ];
    paintLetters(context, letters, paints, "700 100px sans-serif", palette);

    expect(OUTLINE_PX).toBe(1.5);
    expect(calls.map((call) => `${call.op}:${call.char}:${call.composite}`)).toEqual([
      "strokeText:A:source-over",
      "strokeText:s:source-over",
      "fillText:A:destination-out",
      "fillText:s:destination-out",
      "fillText:s:source-over",
      "fillText:c:source-over",
    ]);
    for (const call of calls.filter((entry) => entry.op === "strokeText")) {
      expect(call.lineWidth).toBe(3);
      expect(call.dash).toEqual([4, 2]);
    }
    for (const call of calls.filter((entry) => entry.composite === "destination-out")) {
      expect(call.alpha).toBe(1);
    }
    expect(calls[1]?.alpha).toBe(0.4);
    expect(calls[4]?.alpha).toBeCloseTo(0.6);
    // Back to normal state for the frame and the specks.
    expect(state.globalCompositeOperation).toBe("source-over");
    expect(state.globalAlpha).toBe(1);
  });

  it("never cuts anything when no letter is outlined", () => {
    const { context, calls } = recordingContext();
    paintLetters(context, letters, [], "700 100px sans-serif", palette);
    expect(calls.every((call) => call.op === "fillText" && call.composite === "source-over")).toBe(true);
    expect(calls).toHaveLength(3);
  });
});
