import { cn } from "@/components/ui/cn";

import styles from "./AgentAppIcon.module.css";
import { Glyph } from "./Glyph";
import type { GlyphName } from "./glyphs";

/** Who acts at this stage — carried by the shape (see the CSS module). */
export type AppIconKind = "agent" | "human" | "outcome" | "neutral";
export type AppIconSize = "sm" | "md" | "lg" | "xl";
export type AppIconState = "idle" | "active" | "inactive";
export type AppIconSurface = "light" | "dark";

/** Side of the tile and size of the symbol, in px. */
export const APP_ICON_SIZES: Readonly<Record<AppIconSize, { tile: number; glyph: number }>> = {
  sm: { tile: 28, glyph: 14 },
  md: { tile: 40, glyph: 18 },
  lg: { tile: 56, glyph: 24 },
  xl: { tile: 72, glyph: 30 },
};

export type AgentAppIconProps = {
  glyph: GlyphName;
  kind?: AppIconKind;
  size?: AppIconSize;
  state?: AppIconState;
  surface?: AppIconSurface;
  className?: string;
  testId?: string;
};

/**
 * The tile of an agent or of a stage of a dossier — docs/design-system.md §2.8.
 * Decorative (`aria-hidden`): the name written next to it is what is read.
 * Server-safe: no JavaScript, the motion is CSS and stops under reduced motion.
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
      <Glyph name={glyph} width={APP_ICON_SIZES[size].glyph} />
    </span>
  );
}
