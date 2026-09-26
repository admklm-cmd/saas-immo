import type { ReactNode } from "react";

import { cn } from "./cn";

export type PageHeaderProps = {
  /** Small link or breadcrumb above the title. */
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Badges shown under the description. */
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
  /**
   * Kept for compatibility: since 26/09/2026 every page title uses the same
   * role (Geist 800, `text-title` on a phone, `text-hero` from 640 px —
   * docs/design-system.md §2.2 and §2.10).
   */
  size?: "default" | "hero";
};

/**
 * Header of every signed-in page (and of the public input pages): one `h1`
 * of 1 to 4 words, at most one line of description, then the badges; the one
 * action that matters sits on the right. Same left edge and same rhythm on
 * every screen, thanks to the common page frame (`.page-frame`).
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  meta,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("animate-rise", className)}>
      {eyebrow ? <div className="particle-veil mb-4 w-fit max-w-full text-sm text-ink-muted">{eyebrow}</div> : null}
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="particle-veil min-w-0">
          <h1 className="font-display text-title font-extrabold text-balance text-ink sm:text-hero">{title}</h1>
          {description ? (
            <p className="mt-2.5 max-w-2xl text-base text-pretty text-ink-muted">{description}</p>
          ) : null}
          {meta ? <div className="mt-4 flex flex-wrap items-center gap-2">{meta}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
