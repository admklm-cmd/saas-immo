import { QUIET } from "./hero-config";
import type { Rect } from "./layout";

/**
 * Quiet zone in front of the texts of the hero (docs/design-system.md T.3): the points that fall in
 * the (grown) rectangle of a text block are drawn at 25 % of their opacity, those in the 24 px ring around
 * it at 60 %, the others untouched. The sphere seems to have a calm window in front of the text, with
 * soft edges, never a hard hole. Pure: rectangles in, a level out (0 outside, 1 ring, 2 inside).
 */
export type QuietBox = { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number };

/** Opacity multiplier by level (outside, ring, inside). */
export const QUIET_MULT = [1, QUIET.around, QUIET.inside] as const;

/** Grows each text rectangle by 32 px at the sides and 20 px above and below. */
export function growQuiet(rects: readonly Rect[]): QuietBox[] {
  return rects.map((rect) => ({ x0: rect.x - QUIET.growX, y0: rect.y - QUIET.growY, x1: rect.x + rect.w + QUIET.growX, y1: rect.y + rect.h + QUIET.growY }));
}

/** 0 = outside, 1 = in the ring, 2 = inside a box. Rounded ring: the distance to the box, not a bigger box. */
export function quietLevel(boxes: readonly QuietBox[], x: number, y: number): 0 | 1 | 2 {
  let level: 0 | 1 | 2 = 0;
  const ring = QUIET.ring;
  for (let k = 0; k < boxes.length; k++) {
    const box = boxes[k]!;
    if (x < box.x0 - ring || x > box.x1 + ring || y < box.y0 - ring || y > box.y1 + ring) continue;
    const dx = x < box.x0 ? box.x0 - x : x > box.x1 ? x - box.x1 : 0;
    const dy = y < box.y0 ? box.y0 - y : y > box.y1 ? y - box.y1 : 0;
    if (dx === 0 && dy === 0) return 2;
    if (dx * dx + dy * dy <= ring * ring) level = 1;
  }
  return level;
}
