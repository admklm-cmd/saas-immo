import Link from "next/link";
import type { ComponentProps } from "react";

import {
  buttonStyles,
  canRollLabel,
  controlEffectAttributes,
  RollingLabel,
  withArrow,
  type ButtonArrow,
  type ButtonSize,
  type ButtonVariant,
} from "./Button";
import { cn } from "./cn";

export type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Optional arrow slot (two arrows that swap on hover, see `Button`). */
  arrow?: ButtonArrow;
  /**
   * Magnetic pull (3–5 px, precise pointer only). On by default: a navigation
   * link is never destructive and never part of a sensitive form. Pass
   * `false` inside a sensitive area anyway.
   */
  magnetic?: boolean;
};

/** A navigation link that looks exactly like a `Button`, but stays an anchor. */
export function ButtonLink({
  variant = "primary",
  size = "md",
  arrow,
  magnetic = variant !== "ghost",
  className,
  children,
  ...props
}: ButtonLinkProps) {
  const roll = canRollLabel(variant, children);
  const label = roll ? <RollingLabel text={children} /> : children;

  return (
    <Link
      className={cn(buttonStyles(variant, size, { magnetic }), className)}
      aria-label={roll ? children : undefined}
      {...controlEffectAttributes(variant, { magnetic })}
      {...props}
    >
      {arrow ? <span className="inline-flex items-center gap-1.5">{withArrow(label, arrow, false)}</span> : label}
    </Link>
  );
}
