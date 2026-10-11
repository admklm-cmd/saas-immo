/**
 * DOM measures of block A (docs/design-system.md §2.11.8.8 L4-A): where the
 * « Vous » cursor points, and where the converging lines start and end.
 * Read-only (`getBoundingClientRect`), called on a step change or a resize —
 * never on every frame.
 */

import type { ConvergingColumn } from "./ConvergingLines";
import { checkKey, type CursorTarget } from "./ecosystem-timeline";

/** The parked cursor waits at the horizontal centre of « Validation humaine », 20 px under its bottom edge. */
const PARK = { block: "validation", dy: 20 } as const;
/** The lines start this far under their block, px. */
const LINE_GAP_PX = 8;

/** Tip of the cursor for a target, in the coordinates of the track (its scrolled content). */
export function cursorPoint(track: HTMLElement, target: CursorTarget): { x: number; y: number } | null {
  const node =
    target === "park"
      ? track.querySelector<HTMLElement>(`[data-block="${PARK.block}"]`)
      : track.querySelector<HTMLElement>(`[data-case="${checkKey(target)}"]`);
  if (!node) return null;
  const frame = track.getBoundingClientRect();
  const rect = node.getBoundingClientRect();
  const ox = track.scrollLeft - frame.left - track.clientLeft;
  const oy = track.scrollTop - frame.top - track.clientTop;
  if (target === "park") return { x: rect.left + rect.width / 2 + ox, y: rect.bottom + oy + PARK.dy };
  return { x: rect.left + rect.width / 2 + ox, y: rect.top + rect.height / 2 + oy };
}

type Box = { left: number; right: number; top: number; bottom: number; width: number };

/** True when another block sits under `box` and overlaps it horizontally (1024–1439: Suivi under Acquisition). */
function covered(box: Box, others: readonly Box[]): boolean {
  return others.some((other) => other !== box && other.top >= box.bottom && other.left < box.right && other.right > box.left);
}

/**
 * One line per block that has nothing under it (≥ 1440: the three; 1024–1439:
 * Validation and Suivi), from the middle of its bottom edge + 8 px to the top
 * of the action, in the coordinates of the stage.
 */
export function convergingGeometry(
  stage: HTMLElement,
  track: HTMLElement,
  action: HTMLElement,
): { columns: ConvergingColumn[]; target: { x: number; y: number } } {
  const origin = stage.getBoundingClientRect();
  const boxes: Box[] = Array.from(track.querySelectorAll<HTMLElement>("[data-block]")).map((block) => block.getBoundingClientRect());
  const button = action.firstElementChild?.getBoundingClientRect() ?? action.getBoundingClientRect();
  return {
    columns: boxes
      .filter((box) => !covered(box, boxes))
      .map((box) => ({ x: box.left + box.width / 2 - origin.left, y: box.bottom - origin.top + LINE_GAP_PX }))
      .sort((a, b) => a.x - b.x),
    target: { x: button.left + button.width / 2 - origin.left, y: button.top - origin.top },
  };
}
