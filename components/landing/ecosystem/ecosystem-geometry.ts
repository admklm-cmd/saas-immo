/**
 * DOM measures of block A (docs/design-system.md §2.11.8.3, §2.11.8.7 L3-A):
 * where the « Vous » cursor points, and where the converging lines start and
 * end. Read-only (`getBoundingClientRect`), called on a step change or a
 * resize — never on every frame.
 */

import type { ConvergingColumn } from "./ConvergingLines";
import { checkKey, type CursorTarget } from "./ecosystem-timeline";

/** The parked cursor waits at the horizontal centre of « Validation humaine », 20 px under its bottom edge (L3-A). */
const PARK = { card: "review", dy: 20 } as const;
/** The lines start this far under their card, px. */
const LINE_GAP_PX = 8;
/** Two cards whose tops differ by less than this share a row, px. */
const ROW_TOLERANCE_PX = 1;

/** Tip of the cursor for a target, in the coordinates of the track (its scrolled content). */
export function cursorPoint(track: HTMLElement, target: CursorTarget): { x: number; y: number } | null {
  const node =
    target === "park"
      ? track.querySelector<HTMLElement>(`[data-card="${PARK.card}"]`)
      : track.querySelector<HTMLElement>(`[data-case="${checkKey(target)}"]`);
  if (!node) return null;
  const frame = track.getBoundingClientRect();
  const rect = node.getBoundingClientRect();
  const ox = track.scrollLeft - frame.left - track.clientLeft;
  const oy = track.scrollTop - frame.top - track.clientTop;
  if (target === "park") return { x: rect.left + rect.width / 2 + ox, y: rect.bottom + oy + PARK.dy };
  return { x: rect.left + rect.width / 2 + ox, y: rect.top + rect.height / 2 + oy };
}

/**
 * One line per card of the LAST row (≥ 1440: the seven cards; 1024–1439: the
 * three of row 2), from the middle of its bottom edge + 8 px to the top of the
 * action, in the coordinates of the stage.
 */
export function convergingGeometry(
  stage: HTMLElement,
  track: HTMLElement,
  action: HTMLElement,
): { columns: ConvergingColumn[]; target: { x: number; y: number } } {
  const origin = stage.getBoundingClientRect();
  const rects = Array.from(track.querySelectorAll<HTMLElement>("[data-card]")).map((card) => card.getBoundingClientRect());
  const lastTop = Math.max(...rects.map((rect) => rect.top));
  const button = action.firstElementChild?.getBoundingClientRect() ?? action.getBoundingClientRect();
  return {
    columns: rects
      .filter((rect) => lastTop - rect.top < ROW_TOLERANCE_PX)
      .map((rect) => ({ x: rect.left + rect.width / 2 - origin.left, y: rect.bottom - origin.top + LINE_GAP_PX }))
      .sort((a, b) => a.x - b.x),
    target: { x: button.left + button.width / 2 - origin.left, y: button.top - origin.top },
  };
}
