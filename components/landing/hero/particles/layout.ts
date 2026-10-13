import { HANDS_MAX_WIDTH, HANDS_WIDTH_SHARE, SHAPE_PX, type Tier } from "./hero-config";

/**
 * Where each shape sits in the stage, in CSS px (docs/design-system.md §2.11.4 ter F, L). The shape
 * zone is the free space between the buttons and the terminal; every shape is centred on it and
 * overflows it up and down (behind the text veils).
 */
export type Rect = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };

export type Placement = {
  readonly cx: number;
  readonly cy: number;
  /** px per normalised unit, horizontally and vertically. */
  readonly sx: number;
  readonly sy: number;
};

export type Layout = {
  readonly width: number;
  readonly height: number;
  readonly cloud: Placement;
  readonly sphere: Placement;
  readonly apple: Placement;
  readonly hands: Placement;
  /** Where the cobalt point sits: the middle of the gap between the two index tips. */
  readonly contact: { readonly x: number; readonly y: number };
};

export function computeLayout(width: number, height: number, zone: Rect, tier: Tier): Layout {
  const cx = zone.x + zone.w / 2;
  const cy = zone.y + zone.h / 2;
  const sizes = SHAPE_PX[tier.name];
  // On a narrow stage the solids never exceed 85 % of the width.
  const limit = Math.min(width * 0.85, zone.h * 1.04);
  const sphere = Math.min(sizes.sphere, limit);
  const apple = Math.min(sizes.apple, limit);
  const hands = Math.min(width * HANDS_WIDTH_SHARE[tier.name], HANDS_MAX_WIDTH);
  return {
    width,
    height,
    cloud: { cx: width / 2, cy: height / 2, sx: width, sy: height },
    sphere: { cx, cy, sx: sphere, sy: sphere },
    apple: { cx, cy, sx: apple, sy: apple },
    hands: { cx, cy, sx: hands, sy: hands },
    contact: { x: cx, y: cy },
  };
}
