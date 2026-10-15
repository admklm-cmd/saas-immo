import { HANDS_MAX_WIDTH, HANDS_WIDTH_SHARE, SPHERE, type Tier } from "./hero-config";

/**
 * Where each shape sits in the stage, in CSS px (docs/design-system.md T.2, T.3). The big sphere fills
 * the visible part of the first screen, behind the texts; the hands are centred
 * on the shape zone, the free space between the buttons and the terminal.
 */
/** Below this stage width (CSS px) the page puts the shape zone under the buttons and the sphere inside it. */
export const PHONE_LAYOUT_WIDTH = 768;
/** Share of the smaller side of the zone the sphere fills on a phone. */
const PHONE_SPHERE_FIT = 0.97;

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
  readonly sphere: Placement;
  readonly hands: Placement;
  /** Where the cobalt point sits: the middle of the gap between the two index tips. */
  readonly contact: { readonly x: number; readonly y: number };
};

/**
 * `visibleHeight`: height of the window below the top of the stage (the sphere fits in it, whole,
 * whatever the window: it shrinks rather than being cut).
 */
export function computeLayout(width: number, height: number, zone: Rect, tier: Tier, visibleHeight: number = height): Layout {
  const cx = zone.x + zone.w / 2;
  const cy = zone.y + zone.h / 2;
  // Narrow screens (U.7): the sphere has its own zone under the buttons and lives, whole, in its centre.
  const ownZone = width < PHONE_LAYOUT_WIDTH;
  const diameter = Math.max(1, ownZone ? PHONE_SPHERE_FIT * Math.min(width, zone.h) : Math.min(SPHERE.fit * visibleHeight, width));
  const handsShare = tier.name === "phone" && !ownZone ? HANDS_WIDTH_SHARE.tablet : HANDS_WIDTH_SHARE[tier.name];
  const hands = Math.min(width * handsShare, HANDS_MAX_WIDTH);
  return {
    width,
    height,
    sphere: { cx: ownZone ? cx : width / 2, cy: ownZone ? cy : visibleHeight / 2, sx: diameter, sy: diameter },
    hands: { cx, cy, sx: hands, sy: hands },
    contact: { x: cx, y: cy },
  };
}
