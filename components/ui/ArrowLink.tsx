import Link from "next/link";
import type { ComponentProps } from "react";

import { ButtonArrowGlyph, type ButtonArrow } from "./Button";
import { cn } from "./cn";

export type ArrowLinkProps = ComponentProps<typeof Link> & {
  /** `back`: the arrow comes first and points left (« ← Agents IA »). */
  direction?: ButtonArrow;
  /** `strong` (default): ink, semibold. `muted`: secondary text that darkens on hover. */
  tone?: "strong" | "muted";
};

/**
 * Text link of the design system: a 1 px rail draws itself under the words and
 * two short arrows swap on hover (`interactions.css`, precise pointer only).
 * With reduced motion or on touch, it is a plain link with its arrow; the
 * accent focus ring is always there.
 */
export function ArrowLink({ className, children, direction = "forward", tone = "strong", ...props }: ArrowLinkProps) {
  return (
    <Link
      className={cn(
        "group/link ui-focus inline-flex w-fit items-center gap-1.5 rounded-xs text-sm whitespace-nowrap",
        "transition-colors duration-150 ease-standard",
        tone === "strong" ? "font-semibold text-ink hover:text-accent-strong" : "font-medium text-ink-muted hover:text-ink",
        className,
      )}
      {...props}
    >
      {direction === "back" ? <ButtonArrowGlyph direction="back" /> : null}
      <span className="ui-rail pb-px">{children}</span>
      {direction === "forward" ? <ButtonArrowGlyph direction="forward" /> : null}
    </Link>
  );
}
