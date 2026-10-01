/**
 * Quiet zones of the network background (docs/design-system.md §2.11.4):
 * the rectangles of the text blocks posed outside an opaque surface
 * (`[data-network-quiet]`). Impulses, trails, halos and lit cores fade out
 * within 16 px of a zone and are absent inside it; cell bodies keep half
 * their opacity there; fibers are not attenuated by the canvas (the veils
 * soften them). No sequence starts from a neuron closer than 48 px to a zone.
 *
 * Pure, preallocated: reading a factor allocates nothing.
 */

import { smoothstep } from "./random";

/** Fade distance around a zone, CSS px. */
export const QUIET_FADE = 16;
/** Most rectangles read per frame. */
export const MAX_QUIET_RECTS = 40;
/** Minimum distance between the origin of a sequence and any zone, CSS px. */
export const ORIGIN_CLEARANCE = 48;
/** Minimum distance between the origin of a sequence and an opaque surface (`[data-network-cover]`), CSS px. */
export const COVER_CLEARANCE = 24;

export type QuietZones = {
  /** x0, y0, x1, y1 per zone, CSS px of the viewport. */
  rects: Float32Array;
  count: number;
};

export function createQuietZones(): QuietZones {
  return { rects: new Float32Array(MAX_QUIET_RECTS * 4), count: 0 };
}

/** Adds a rectangle (ignored past MAX_QUIET_RECTS). Returns false when full. */
export function addQuietRect(zones: QuietZones, x0: number, y0: number, x1: number, y1: number): boolean {
  if (zones.count >= MAX_QUIET_RECTS) return false;
  const at = zones.count * 4;
  zones.rects[at] = Math.min(x0, x1);
  zones.rects[at + 1] = Math.min(y0, y1);
  zones.rects[at + 2] = Math.max(x0, x1);
  zones.rects[at + 3] = Math.max(y0, y1);
  zones.count += 1;
  return true;
}

/** Distance (CSS px) from a point to the nearest zone: 0 inside, Infinity without zones. */
export function distanceToQuiet(zones: QuietZones, x: number, y: number): number {
  let best = Infinity;
  const rects = zones.rects;
  for (let i = 0; i < zones.count; i++) {
    const at = i * 4;
    const dx = x < rects[at]! ? rects[at]! - x : x > rects[at + 2]! ? x - rects[at + 2]! : 0;
    const dy = y < rects[at + 1]! ? rects[at + 1]! - y : y > rects[at + 3]! ? y - rects[at + 3]! : 0;
    const d = dx === 0 ? dy : dy === 0 ? dx : Math.hypot(dx, dy);
    if (d < best) best = d;
    if (best === 0) return 0;
  }
  return best;
}

/** Impulses, trails, halos, lit cores: 0 in a zone, 1 from 16 px away. */
export function signalFactor(zones: QuietZones, x: number, y: number): number {
  if (zones.count === 0) return 1;
  return smoothstep(distanceToQuiet(zones, x, y) / QUIET_FADE);
}

/** Cell bodies: half opacity in a zone, full from 16 px away. */
export function bodyFactor(zones: QuietZones, x: number, y: number): number {
  if (zones.count === 0) return 1;
  return 0.5 + 0.5 * smoothstep(distanceToQuiet(zones, x, y) / QUIET_FADE);
}

/** True when both sets hold the same rectangles to within `tolerance` px (cache invalidation). */
export function sameQuietZones(a: QuietZones, b: QuietZones, tolerance = 0.5): boolean {
  if (a.count !== b.count) return false;
  for (let i = 0; i < a.count * 4; i++) {
    if (Math.abs(a.rects[i]! - b.rects[i]!) > tolerance) return false;
  }
  return true;
}

export function copyQuietZones(from: QuietZones, to: QuietZones): void {
  for (let i = 0; i < from.count * 4; i++) to.rects[i] = from.rects[i]!;
  to.count = from.count;
}
