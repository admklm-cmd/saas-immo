import type { ReactNode } from "react";

/**
 * One icon of the Ascend family (docs/design-system.md §2.8), drawn on a single
 * 24 × 24 grid and split in named layers:
 *   * `ink`    — the filled, organic body, painted with `currentColor` (black on
 *                a light surface, white on a dark one);
 *   * `glass`  — optional secondary element, translucent (second bubble, deal
 *                sphere, second contact);
 *   * `accent` — the ONE element that says the job (a dot, an arrow, a check).
 *
 * Every shape paints itself with `currentColor` (attribute `fill` or `stroke`);
 * the layer sets the colour. `data-m="…"` marks a sub-element the story of the
 * icon moves (see `icon-motion.module.css`); `data-on-accent` marks a small
 * mark drawn ON the accent (a white check on a cobalt disc).
 */
export type IconTone =
  /** Cobalt accent (gradient in the large tile). The default of the family. */
  | "accent"
  /** Red accent: alert and error only, always next to written words. */
  | "danger"
  /** Utility glyph (arrows, chevrons, close…): everything in `currentColor`. */
  | "ink";

export type IconDefinition = {
  ink: ReactNode;
  glass?: ReactNode;
  /** Draw the glass layer above the ink (the deal sphere slides OVER the other). */
  glassAbove?: boolean;
  accent: ReactNode;
  tone: IconTone;
  /** False for utility glyphs that never move (arrows, close, menu, chevrons). */
  animated: boolean;
};
