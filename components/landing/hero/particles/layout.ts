import { BALL_AT, BALL_MIN_PX, BALL_RADIUS_SHARE, HANDS_MAX_WIDTH, HANDS_WIDTH_SHARE, HOLD_SHIFT, SPHERE, type Tier } from "./hero-config";

/**
 * Where each shape sits in the stage, in CSS px (docs/design-system.md T.2, T.3). The big sphere fills
 * the visible part of the first screen, behind the texts; the hands (and the ball they hold) are centred
 * on the shape zone, the free space between the buttons and the terminal.
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
  readonly sphere: Placement;
  readonly hands: Placement;
  /** The ball held by the left hand: centre and radius, CSS px. */
  readonly ball: { readonly cx: number; readonly cy: number; readonly r: number };
  /** How far the left hand steps back while it holds the ball, CSS px. */
  readonly holdShift: number;
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
  const diameter = Math.max(1, Math.min(SPHERE.fit * visibleHeight, width));
  const hands = Math.min(width * HANDS_WIDTH_SHARE[tier.name], HANDS_MAX_WIDTH);
  const radius = Math.max((BALL_RADIUS_SHARE * hands), tier.name === "phone" ? BALL_MIN_PX / 2 : 0);
  return {
    width,
    height,
    sphere: { cx: width / 2, cy: visibleHeight / 2, sx: diameter, sy: diameter },
    hands: { cx, cy, sx: hands, sy: hands },
    ball: { cx: cx + BALL_AT.x * hands, cy: cy + BALL_AT.y * hands, r: radius },
    holdShift: HOLD_SHIFT * hands,
    contact: { x: cx, y: cy },
  };
}
