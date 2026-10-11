import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { ButtonArrowGlyph } from "./Button";
import { cn } from "./cn";

export type CardLinkProps = Omit<ComponentProps<typeof Link>, "children"> & {
  children: ReactNode;
  /** Short action written at the bottom (« Ouvrir la file »), with its arrow. */
  cta?: ReactNode;
  testId?: string;
};

/**
 * A whole card that is one link (a figure that leads to the list it counts).
 *
 * Opaque white surface, so nothing behind it ever shows through. On hover
 * (precise pointer): 2 px elevation, raised shadow and a cobalt border halo
 * oriented towards the pointer (`data-pointer`, `interactions.css`). Never
 * magnetic: it is a surface, not a button. The accent focus ring surrounds
 * the whole card.
 */
export function CardLink({ children, cta, className, testId, ...props }: CardLinkProps) {
  return (
    <Link
      data-pointer=""
      data-testid={testId}
      className={cn(
        "group/card ui-card-link ui-halo ui-focus flex flex-col rounded-xl border border-line bg-surface p-5 text-ink shadow-subtle",
        className,
      )}
      {...props}
    >
      {children}
      {cta ? (
        <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-semibold text-ink group-hover/card:text-accent-strong">
          {cta}
          <ButtonArrowGlyph direction="forward" />
        </span>
      ) : null}
    </Link>
  );
}
