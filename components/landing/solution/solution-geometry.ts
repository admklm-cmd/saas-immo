/**
 * Geometry of the drawings of block B (docs/design-system.md §2.11.8.4), kept
 * pure so it can be unit-tested and rendered on the server. Units: px on the
 * vertical axis, percent of the drawing on the horizontal axis.
 */

/** Roadmap (tile 1): first card top, card height, vertical gap. */
export const ROADMAP = { top: 52, card: 52, gap: 12 } as const;

/** Top of the step card `index` (px). */
export function roadmapTop(index: number): number {
  return ROADMAP.top + index * (ROADMAP.card + ROADMAP.gap);
}

/** Height of the roadmap drawing for `count` steps (px). */
export function roadmapHeight(count: number): number {
  return roadmapTop(count - 1) + ROADMAP.card;
}

/**
 * The dotted path through the tiles of the steps. Odd steps (01, 03…) sit on
 * the left with their tile at x = 0, even ones on the right with their tile at
 * x = 100 (the SVG spans exactly from one tile column to the other). Each
 * segment leaves a tile horizontally, runs out of its card, then turns down
 * into the next one: the path shows beside the cards, never under a word.
 */
export function roadmapPath(count: number): string {
  const centre = (index: number) => roadmapTop(index) + ROADMAP.card / 2;
  const x = (index: number) => (index % 2 === 0 ? 0 : 100);
  let d = `M ${x(0)} ${centre(0)}`;
  for (let index = 0; index < count - 1; index += 1) {
    const from = x(index);
    const to = x(index + 1);
    const y0 = centre(index);
    const y1 = centre(index + 1);
    const bend = from + (to - from) * 0.78;
    d += ` C ${bend} ${y0} ${to} ${y0 + 14} ${to} ${y1}`;
  }
  return d;
}

/**
 * Progress chart (tile 2): six stages at regular x, a rising shape with NO
 * value (fictitious, no y axis). y in percent of the plot, 0 = top.
 */
export const PROGRESS_SHAPE: readonly number[] = [84, 74, 62, 46, 30, 12];

export function progressPoints(shape: readonly number[] = PROGRESS_SHAPE): { x: number; y: number }[] {
  const last = Math.max(shape.length - 1, 1);
  return shape.map((y, index) => ({ x: (index / last) * 100, y }));
}

/** A smooth curve through the points (Catmull-Rom turned into cubic Béziers), in a 100 × 100 box. */
export function smoothPath(points: readonly { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  const at = (index: number) => points[Math.min(Math.max(index, 0), points.length - 1)]!;
  let d = `M ${at(0).x} ${at(0).y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = at(index - 1);
    const p1 = at(index);
    const p2 = at(index + 1);
    const p3 = at(index + 2);
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${round(c1.x)} ${round(c1.y)} ${round(c2.x)} ${round(c2.y)} ${round(p2.x)} ${round(p2.y)}`;
  }
  return d;
}

/** The area under the curve, closed on the bottom of the box. */
export function areaPath(points: readonly { x: number; y: number }[]): string {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return "";
  return `${smoothPath(points)} L ${last.x} 100 L ${first.x} 100 Z`;
}

/**
 * Time at which an eased progress reaches `share` of its run, for
 * `cubic-bezier(x1, y1, x2, y2)` (bisection on the curve parameter): the stage
 * dots of tile 2 appear when the drawn curve reaches them.
 */
export function easedTime(share: number, [x1, y1, x2, y2]: readonly [number, number, number, number]): number {
  const target = Math.min(Math.max(share, 0), 1);
  const bezier = (t: number, a: number, b: number) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3;
  let low = 0;
  let high = 1;
  for (let step = 0; step < 40; step += 1) {
    const mid = (low + high) / 2;
    if (bezier(mid, y1, y2) < target) low = mid;
    else high = mid;
  }
  return bezier((low + high) / 2, x1, x2);
}

/** `--ease-draw` of app/globals.css. */
export const EASE_DRAW = [0.65, 0, 0.35, 1] as const;

/**
 * Team (tile 3): the five agents on an ellipse around « Vous » — the three
 * that prepare (Léa, Hugo, Emma) on the left, the two that follow (Louis,
 * Sarah) on the right, in the order of the journey. Angles in degrees (0 =
 * right, clockwise, y down); radii: 44 % of the width, 38 % of the height.
 */
export const TEAM_ANGLES: readonly number[] = [220, 180, 140, 335, 25];
export const TEAM_CENTRE = { x: 50, yPx: 112 } as const;
export const TEAM_RADII = { x: 44, y: 38 } as const;

/** Position of the agent `index`: x in % of the width, y in % of the height (frame of 200 px). */
export function teamPosition(index: number, frameHeight = 200): { x: number; y: number } {
  const angle = ((TEAM_ANGLES[index] ?? 0) * Math.PI) / 180;
  const centreY = (TEAM_CENTRE.yPx / frameHeight) * 100;
  return {
    x: round(TEAM_CENTRE.x + TEAM_RADII.x * Math.cos(angle)),
    y: round(centreY + TEAM_RADII.y * Math.sin(angle)),
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
