/**
 * Labels of the path stops (agent names, human validation, mandate) and the
 * room they take on screen. The renderer paints them next to their node; the
 * mesh keeps its hairlines (and the impulses running along them) away from
 * these boxes, so no line ever crosses or touches a label.
 *
 * The model has no canvas to measure text: the width is a generous estimate of
 * the 11 px label font (measured in Chromium: 5.2 to 7.7 px per character).
 */

import { LANDING_TEXTS } from "@/components/landing-texts";

import { smoothstep } from "./timeline";

const TEXTS = LANDING_TEXTS.living;

/** Agents with a label drawn next to them (decorative, aria-hidden canvas). */
export const STOP_LABEL: readonly (string | null)[] = [
  null,
  TEXTS.agents[0],
  TEXTS.agents[1],
  TEXTS.agents[2],
  TEXTS.gate,
  TEXTS.agents[3],
  TEXTS.agents[4],
  TEXTS.goal,
];

/** Geometry of a label, CSS px (kept in step with `drawNode` in renderer.ts). */
export const LABEL = {
  /** Distance between the node centre and the text. */
  offset: 10,
  /** Right margin under which the label switches to the left of its node. */
  edge: 8,
  /** Estimated width: per character, plus a fixed allowance. */
  charWidth: 6.4,
  extraWidth: 8,
  /** Half the height of the text box around its middle line. */
  halfHeight: 7,
  /** No mesh line comes closer than this to a label. */
  clearance: 4,
  /** Lines fade out over this distance before reaching the clearance. */
  fade: 6,
} as const;

export type Rect = { x0: number; y0: number; x1: number; y1: number };

/**
 * Box of a label drawn next to a node at (x, y). When the estimate cannot tell
 * on which side the renderer will put it (close to the right edge), the box
 * covers both sides.
 */
export function labelRect(x: number, y: number, text: string, viewportWidth: number): Rect {
  const width = text.length * LABEL.charWidth + LABEL.extraWidth;
  const limit = viewportWidth - LABEL.edge;
  const right: Rect = { x0: x + LABEL.offset, y0: y - LABEL.halfHeight, x1: x + LABEL.offset + width, y1: y + LABEL.halfHeight };
  const left: Rect = { x0: x - LABEL.offset - width, y0: right.y0, x1: x - LABEL.offset, y1: right.y1 };
  // The renderer measures the real text: the side is certain only far from the limit.
  if (x + LABEL.offset + width * 1.25 <= limit) return right;
  if (x + LABEL.offset + width * 0.5 > limit) return left;
  return { x0: left.x0, y0: right.y0, x1: right.x1, y1: right.y1 };
}

/** Shortest distance between a segment and a rectangle (0 when they meet). */
export function segmentRectDistance(x1: number, y1: number, x2: number, y2: number, rect: Rect): number {
  if (segmentHitsRect(x1, y1, x2, y2, rect)) return 0;
  const corners: [number, number][] = [
    [rect.x0, rect.y0],
    [rect.x1, rect.y0],
    [rect.x1, rect.y1],
    [rect.x0, rect.y1],
  ];
  let best = Math.min(pointRectDistance(x1, y1, rect), pointRectDistance(x2, y2, rect));
  for (const [cx, cy] of corners) best = Math.min(best, pointSegmentDistance(cx, cy, x1, y1, x2, y2));
  return best;
}

function pointRectDistance(x: number, y: number, rect: Rect): number {
  const dx = Math.max(rect.x0 - x, 0, x - rect.x1);
  const dy = Math.max(rect.y0 - y, 0, y - rect.y1);
  return Math.hypot(dx, dy);
}

function pointSegmentDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const span = dx * dx + dy * dy;
  const t = span === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / span));
  return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
}

function segmentHitsRect(x1: number, y1: number, x2: number, y2: number, rect: Rect): boolean {
  return clipSegment(x1, y1, x2, y2, rect) !== null;
}

/** Liang–Barsky clipping: the part of the segment inside the rectangle, as shares (0..1), or null. */
function clipSegment(x1: number, y1: number, x2: number, y2: number, rect: Rect): [number, number] | null {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let low = 0;
  let high = 1;
  const edges: [number, number][] = [
    [-dx, x1 - rect.x0],
    [dx, rect.x1 - x1],
    [-dy, y1 - rect.y0],
    [dy, rect.y1 - y1],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const t = q / p;
    if (p < 0) low = Math.max(low, t);
    else high = Math.min(high, t);
    if (low > high) return null;
  }
  return [low, high];
}

/**
 * Parts of a segment (as [from, to] shares of its length, 0..1) lying outside
 * every rectangle grown by `margin`. Pieces shorter than 1.5 px are left out.
 */
export function outsideRects(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rects: readonly Rect[],
  margin: number,
): [number, number][] {
  const inside: [number, number][] = [];
  for (const rect of rects) {
    const grown = { x0: rect.x0 - margin, y0: rect.y0 - margin, x1: rect.x1 + margin, y1: rect.y1 + margin };
    const span = clipSegment(x1, y1, x2, y2, grown);
    if (span) inside.push(span);
  }
  if (inside.length === 0) return [[0, 1]];
  inside.sort((left, right) => left[0] - right[0]);
  const length = Math.hypot(x2 - x1, y2 - y1);
  const minimum = length > 0 ? 1.5 / length : 1;
  const parts: [number, number][] = [];
  let cursor = 0;
  for (const [from, to] of inside) {
    if (from - cursor >= minimum) parts.push([cursor, from]);
    cursor = Math.max(cursor, to);
  }
  if (1 - cursor >= minimum) parts.push([cursor, 1]);
  return parts;
}

/**
 * 1 for an impulse well away from every label, fading to 0 at
 * `LABEL.clearance` px: an impulse fades out while it passes a label, then
 * comes back, without any jump.
 */
export function labelClearance(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  labels: readonly Rect[],
  reach = 0,
): number {
  let clear = 1;
  for (const rect of labels) {
    const distance = segmentRectDistance(x1, y1, x2, y2, rect) - reach;
    clear = Math.min(clear, smoothstep((distance - LABEL.clearance) / LABEL.fade));
    if (clear === 0) break;
  }
  return clear;
}

