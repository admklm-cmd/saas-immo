/**
 * DOM measures of block A (docs/design-system.md §2.11.8.3): where the « Vous »
 * cursor points, and where the converging lines start and end. Read-only
 * (`getBoundingClientRect`), called on a step change or a resize — never on
 * every frame.
 */

import type { ConvergingColumn } from "./ConvergingLines";
import { checkKey, type CursorTarget } from "./ecosystem-timeline";

/** The parked cursor waits 24 px under and 16 px left of the first box of « Validation humaine ». */
const PARK = { card: 3, line: 0, dx: -16, dy: 24 } as const;
/** The lines start this far under their column, px. */
const LINE_GAP_PX = 8;

/** Tip of the cursor for a target, in the coordinates of the track (its scrolled content). */
export function cursorPoint(track: HTMLElement, target: CursorTarget): { x: number; y: number } | null {
  const ref = target === "park" ? { card: PARK.card, line: PARK.line } : target;
  const box = track.querySelector<HTMLElement>(`[data-case="${checkKey(ref)}"]`);
  if (!box) return null;
  const frame = track.getBoundingClientRect();
  const rect = box.getBoundingClientRect();
  const ox = track.scrollLeft - frame.left - track.clientLeft;
  const oy = track.scrollTop - frame.top - track.clientTop;
  if (target === "park") return { x: rect.left + ox + PARK.dx, y: rect.bottom + oy + PARK.dy };
  return { x: rect.left + rect.width / 2 + ox, y: rect.top + rect.height / 2 + oy };
}

/**
 * One line per column of cards (cards sharing their left edge), from under
 * its lowest card to the top of the action, in the coordinates of the stage.
 */
export function convergingGeometry(
  stage: HTMLElement,
  track: HTMLElement,
  action: HTMLElement,
): { columns: ConvergingColumn[]; target: { x: number; y: number } } {
  const origin = stage.getBoundingClientRect();
  const byColumn = new Map<number, { x: number; bottom: number }>();
  for (const card of Array.from(track.querySelectorAll<HTMLElement>("[data-card]"))) {
    const rect = card.getBoundingClientRect();
    const key = Math.round(rect.left);
    const column = byColumn.get(key);
    byColumn.set(key, { x: rect.left + rect.width / 2 - origin.left, bottom: Math.max(column?.bottom ?? 0, rect.bottom - origin.top) });
  }
  const button = action.firstElementChild?.getBoundingClientRect() ?? action.getBoundingClientRect();
  return {
    columns: [...byColumn.values()].sort((a, b) => a.x - b.x).map((column) => ({ x: column.x, y: column.bottom + LINE_GAP_PX })),
    target: { x: button.left + button.width / 2 - origin.left, y: button.top - origin.top },
  };
}
