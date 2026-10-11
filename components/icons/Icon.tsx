import { useId, type ComponentType, type CSSProperties } from "react";

import { ICON_VIEWBOX, ICONS, type IconName } from "./icons";

export type IconSize = "sm" | "lg";

export type IconProps = {
  name: IconName;
  /**
   * `sm` (default): the bare symbol, 12–24 px, for navigation, buttons, lists
   * and badges. Its story plays ONCE, on hover or keyboard focus of the parent
   * control, or when `animate` becomes true.
   * `lg`: the symbol in a frosted-glass tile, 48–96 px, for page headers, agent
   * cards and empty states only. Its story plays on arrival, then the accent
   * breathes twice and rests (under 5 s in all, WCAG 2.2.2).
   */
  size?: IconSize;
  /** Side of the symbol (`sm`, default 16) or of the tile (`lg`, default 64): px, or any CSS length (`1em`). */
  px?: number | string;
  /** `sm` only: play the story once now (a state change, an activation). */
  animate?: boolean;
  /** Greyed and still (a paused agent, an unavailable step). */
  dimmed?: boolean;
  className?: string;
  testId?: string;
};

/** Default sides, in px. */
export const ICON_SIDES: Readonly<Record<IconSize, number>> = {
  sm: 16,
  lg: 64,
};

/**
 * One icon of the Ascend family (docs/design-system.md §2.8). Always decorative:
 * `aria-hidden`, never focusable — the words next to it carry the meaning, and
 * the still frame IS the meaningful state (the motion only tells how it got
 * there). Server-safe: no state, no effect; the motion is CSS
 * (`icons.css`, `icon-stories.css`) and stops under reduced motion.
 */
export function Icon({ name, size = "sm", px, animate = false, dimmed = false, className, testId }: IconProps) {
  const definition = ICONS[name];
  const gradientId = `icon-paint-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const large = size === "lg";
  const side = px ?? ICON_SIDES[size];
  const glass = "glass" in definition ? definition.glass : undefined;
  const glassAbove = "glassAbove" in definition && definition.glassAbove;
  const glassLayer = glass ? <g data-part="glass">{glass}</g> : null;

  const svg = (
    <svg
      viewBox={ICON_VIEWBOX}
      width={large ? undefined : side}
      height={large ? undefined : side}
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={large ? undefined : className}
      data-icon={name}
      data-icon-size={size}
      data-tone={definition.tone}
      data-animated={definition.animated && !dimmed ? "" : undefined}
      data-animate={animate && !large && definition.animated && !dimmed ? "" : undefined}
      data-dimmed={dimmed ? "" : undefined}
      data-testid={large ? undefined : testId}
      style={large ? ({ "--icon-paint": `url(#${gradientId})` } as CSSProperties) : undefined}
    >
      {large ? (
        <defs>
          <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="22" y1="2" x2="2" y2="22">
            <stop offset="0" data-stop="start" />
            <stop offset="1" data-stop="end" />
          </linearGradient>
        </defs>
      ) : null}
      {glassAbove ? null : glassLayer}
      <g data-part="ink">{definition.ink}</g>
      {glassAbove ? glassLayer : null}
      <g data-part="accent">{definition.accent}</g>
    </svg>
  );

  if (!large) return svg;

  return (
    <span
      aria-hidden="true"
      className={className}
      data-icon-tile=""
      data-dimmed={dimmed ? "" : undefined}
      data-testid={testId}
      style={
        {
          "--icon-tile": typeof side === "number" ? `${side}px` : side,
        } as CSSProperties
      }
    >
      {svg}
    </span>
  );
}

type IconComponentProps = {
  className?: string;
  width?: number | string;
  height?: number | string;
};

/**
 * A small icon as an icon component, for the maps that expect one (rail nodes,
 * phases of a run). `width` is the side (px or a CSS length); `height` is
 * ignored: the grid is square.
 */
export function iconComponent(name: IconName): ComponentType<IconComponentProps> {
  function NamedIcon({ className, width }: IconComponentProps) {
    return <Icon name={name} px={width} className={className} />;
  }
  NamedIcon.displayName = `Icon(${name})`;
  return NamedIcon;
}
