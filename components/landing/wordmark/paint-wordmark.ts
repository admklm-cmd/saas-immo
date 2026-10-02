/**
 * Adapted from React Bits — TechText (https://reactbits.dev)
 * Copyright (c) 2026 David Haz — MIT + Commons Clause License Condition v1.0:
 * full notice in THIRD_PARTY_NOTICES.md (keep it; never sell or redistribute
 * this component on its own).
 *
 * Canvas painting of the brand wordmark (`BRAND.shortName`) (docs/design-system.md §2.11.3):
 * letters in ink (plain or dashed outline), the cobalt selection frame with
 * its four handles and its mono label, the specks. Called only while an
 * effect plays; the caller clears the canvas when it returns to rest.
 * No glow, no filter, no gradient.
 */

import { FRAME_PAD_PX, HANDLE_PX, SPECK_SPREAD_EM, letterLabel, speckAlpha, type LetterBox, type Speck } from "./tech-wordmark";

/** A letter measured from its HTML span, in CSS px of the canvas box. */
export type MeasuredLetter = {
  char: string;
  /** Span box (hit testing). */
  box: LetterBox;
  /** Pen position: left of the span, on the baseline. */
  x: number;
  baseline: number;
  /** Ink box of the glyph. */
  ink: LetterBox;
};

/** Visible width of the dashed outer contour (the stroke is drawn at twice this). */
export const OUTLINE_PX = 1.5;

export type Palette = { ink: string; accent: string; surface: string; labelFont: string };

export type LetterPaint = {
  /** 0 = plain ink, 1 = dashed outline. */
  outline: number;
  dx: number;
  dy: number;
};

/** Measures every letter span against the canvas box (fonts must be ready). */
export function measureLetters(
  context: CanvasRenderingContext2D,
  spans: readonly HTMLElement[],
  canvasRect: DOMRect,
): { letters: MeasuredLetter[]; font: string; em: number } {
  const first = spans[0];
  if (!first) return { letters: [], font: "", em: 0 };
  const style = getComputedStyle(first);
  const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const em = parseFloat(style.fontSize);
  context.font = font;
  context.letterSpacing = "0px";
  context.textBaseline = "alphabetic";
  // The real baseline of the HTML letters, read from a zero-size probe: CSS
  // rounds the half-leading its own way (measured: 198.53 → 198 at 206 px).
  const probe = document.createElement("span");
  probe.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline";
  first.appendChild(probe);
  const htmlBaseline = probe.getBoundingClientRect().top - canvasRect.top;
  probe.remove();
  const letters = spans.map((span) => {
    const char = span.textContent ?? "";
    const rect = span.getBoundingClientRect();
    const metrics = context.measureText(char);
    const x = rect.left - canvasRect.left;
    const top = rect.top - canvasRect.top;
    // One line: every letter shares the baseline of the first.
    const baseline = htmlBaseline;
    const inkLeft = x - metrics.actualBoundingBoxLeft;
    const inkTop = baseline - metrics.actualBoundingBoxAscent;
    return {
      char,
      box: { x, y: top, width: rect.width, height: rect.height },
      x,
      baseline,
      ink: {
        x: inkLeft,
        y: inkTop,
        width: metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight,
        height: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent,
      },
    };
  });
  return { letters, font, em };
}

export function paintLetters(
  context: CanvasRenderingContext2D,
  letters: readonly MeasuredLetter[],
  paints: readonly LetterPaint[],
  font: string,
  palette: Palette,
): void {
  context.font = font;
  context.letterSpacing = "0px";
  context.textBaseline = "alphabetic";
  context.fillStyle = palette.ink;
  context.strokeStyle = palette.ink;
  const placed = letters.map((letter, index) => {
    const paint = paints[index] ?? { outline: 0, dx: 0, dy: 0 };
    return { char: letter.char, x: letter.x + paint.dx, y: letter.baseline + paint.dy, outline: paint.outline };
  });
  const outlined = placed.filter((letter) => letter.outline > 0);
  if (outlined.length > 0) {
    // Outer contour only (docs/design-system.md §2.11.3): the variable font
    // draws overlapping contours (bar of the « e », terminals of the « c »),
    // so a plain stroke shows inner traces. The dashed stroke is drawn at
    // twice the visible width, then the glyph itself is cut out: only the
    // outer half (OUTLINE_PX) stays. The cut happens before any plain fill,
    // frame or speck is painted, so it can only remove outline ink.
    context.lineWidth = OUTLINE_PX * 2;
    context.setLineDash([4, 2]);
    for (const letter of outlined) {
      context.globalAlpha = letter.outline;
      context.strokeText(letter.char, letter.x, letter.y);
    }
    context.setLineDash([]);
    context.globalAlpha = 1;
    context.globalCompositeOperation = "destination-out";
    for (const letter of outlined) {
      context.fillText(letter.char, letter.x, letter.y);
    }
    context.globalCompositeOperation = "source-over";
  }
  for (const letter of placed) {
    if (letter.outline >= 1) continue;
    context.globalAlpha = 1 - letter.outline;
    context.fillText(letter.char, letter.x, letter.y);
  }
  context.globalAlpha = 1;
}

/** Ink box of a letter + 4 px, moved by its drag offset. */
export function frameBoxOf(letter: MeasuredLetter, paint: LetterPaint | undefined): LetterBox {
  return {
    x: letter.ink.x - FRAME_PAD_PX + (paint?.dx ?? 0),
    y: letter.ink.y - FRAME_PAD_PX + (paint?.dy ?? 0),
    width: letter.ink.width + FRAME_PAD_PX * 2,
    height: letter.ink.height + FRAME_PAD_PX * 2,
  };
}

/** Cobalt 1 px rectangle, four white 5 × 5 handles, white-on-cobalt mono label. */
export function paintFrame(
  context: CanvasRenderingContext2D,
  box: LetterBox,
  label: { letter: MeasuredLetter } | null,
  opacity: number,
  palette: Palette,
): void {
  if (opacity <= 0) return;
  context.globalAlpha = opacity;
  context.lineWidth = 1;
  context.strokeStyle = palette.accent;
  const left = Math.round(box.x) + 0.5;
  const top = Math.round(box.y) + 0.5;
  const width = Math.round(box.width);
  const height = Math.round(box.height);
  context.strokeRect(left, top, width, height);

  const half = HANDLE_PX / 2;
  context.fillStyle = palette.surface;
  for (const [cx, cy] of [
    [left, top],
    [left + width, top],
    [left, top + height],
    [left + width, top + height],
  ] as const) {
    context.fillRect(cx - half, cy - half, HANDLE_PX, HANDLE_PX);
    context.strokeRect(cx - half, cy - half, HANDLE_PX, HANDLE_PX);
  }

  if (label) {
    const text = letterLabel(label.letter.char, label.letter.ink.width, label.letter.ink.height);
    context.font = palette.labelFont;
    context.letterSpacing = "0px";
    context.textBaseline = "middle";
    const padX = 6;
    const padY = 2;
    const textHeight = 11;
    const tagWidth = context.measureText(text).width + padX * 2;
    const tagHeight = textHeight + padY * 2 + 2;
    let tagTop = top - 6 - tagHeight;
    // No room above (top of the canvas): below the frame.
    if (tagTop < 0) tagTop = top + height + 6;
    context.fillStyle = palette.accent;
    context.beginPath();
    context.roundRect(left - 0.5, tagTop, tagWidth, tagHeight, 4);
    context.fill();
    context.fillStyle = palette.surface;
    context.fillText(text, left - 0.5 + padX, tagTop + tagHeight / 2);
  }
  context.globalAlpha = 1;
}

/** Specks around a letter, blinking twice from `elapsedMs`. Returns whether any is still on. */
export function paintSpecks(
  context: CanvasRenderingContext2D,
  letter: MeasuredLetter,
  specks: readonly Speck[],
  elapsedMs: number,
  em: number,
  palette: Palette,
): void {
  const spread = SPECK_SPREAD_EM * em;
  const x0 = letter.ink.x - spread;
  const y0 = letter.ink.y - spread;
  const width = letter.ink.width + spread * 2;
  const height = letter.ink.height + spread * 2;
  specks.forEach((speck, index) => {
    const blink = speckAlpha(elapsedMs, index);
    if (blink <= 0) return;
    context.globalAlpha = blink * speck.alpha;
    context.fillStyle = speck.tone === "accent" ? palette.accent : palette.ink;
    context.fillRect(Math.round(x0 + speck.u * width), Math.round(y0 + speck.v * height), speck.size, speck.size);
  });
  context.globalAlpha = 1;
}
