import { Icon } from "@/components/icons/Icon";
import type { IconName } from "@/components/icons/icons";
import { cn } from "@/components/ui/cn";

import styles from "./AgentAppIcon.module.css";

/** Who acts at this stage — carried by the shape (see the CSS module). */
export type AppIconKind = "agent" | "human" | "outcome" | "neutral";
export type AppIconSize = "sm" | "md" | "lg" | "xl";
export type AppIconState = "idle" | "active" | "inactive";
export type AppIconSurface = "light" | "dark";

/** Side of the tile and size of the symbol, in px. */
export const APP_ICON_SIZES: Readonly<Record<AppIconSize, { tile: number; glyph: number }>> = {
  sm: { tile: 28, glyph: 15 },
  md: { tile: 40, glyph: 22 },
  lg: { tile: 56, glyph: 30 },
  xl: { tile: 72, glyph: 38 },
};

export type AgentAppIconProps = {
  /** Icon of the family (`components/icons`). */
  glyph: IconName;
  kind?: AppIconKind;
  size?: AppIconSize;
  state?: AppIconState;
  surface?: AppIconSurface;
  className?: string;
  testId?: string;
};

/**
 * The tile of an agent or of a stage of a dossier — docs/design-system.md §2.8.
 * The SHAPE says who acts; the symbol inside is a SMALL icon of the family
 * (ink + one cobalt accent), whose story plays once on hover of the parent
 * control or when the tile becomes `active`. Decorative (`aria-hidden`): the
 * name written next to it is what is read. Server-safe.
 */
export function AgentAppIcon({
  glyph,
  kind = "agent",
  size = "md",
  state = "idle",
  surface = "light",
  className,
  testId,
}: AgentAppIconProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(styles.tile, className)}
      data-kind={kind}
      data-size={size}
      data-state={state}
      data-surface={surface}
      data-testid={testId}
    >
      <Icon name={glyph} px={APP_ICON_SIZES[size].glyph} animate={state === "active"} dimmed={state === "inactive"} />
    </span>
  );
}
