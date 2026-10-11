import type { ReactNode } from "react";

import { Icon } from "@/components/icons/Icon";
import type { IconName } from "@/components/icons/icons";

import { cn } from "./cn";
import { Overline } from "./Overline";

export type PageHeaderProps = {
  /** Small link or breadcrumb above the title. */
  eyebrow?: ReactNode;
  /**
   * Mono overline with the cobalt dash, above the title (docs/design-system.md
   * §2.2.6, §3.8). Not used together with `eyebrow`: a breadcrumb already
   * plays that role.
   */
  overline?: string;
  title: ReactNode;
  description?: ReactNode;
  /** Badges shown under the description. */
  meta?: ReactNode;
  actions?: ReactNode;
  /**
   * Large icon of the screen, in its frosted tile, next to the title (main
   * screens of the signed-in space only — docs/design-system.md §2.8).
   */
  icon?: IconName;
  className?: string;
  /**
   * Kept for compatibility: every page title uses the same role (Bricolage
   * 600, `text-title` on a phone, `text-hero` from 640 px, `text-page` from
   * 1024 px — docs/design-system.md §2.2.4 and §3.8).
   */
  size?: "default" | "hero";
};

/**
 * Header of every signed-in page (and of the public input pages): one `h1`
 * of 1 to 4 words, at most one line of description, then the badges; the one
 * action that matters sits on the right. Same left edge and same rhythm on
 * every screen, thanks to the common page frame (`.page-frame`).
 */
export function PageHeader({ eyebrow, overline, title, description, meta, actions, icon, className }: PageHeaderProps) {
  return (
    <header className={cn("animate-rise", className)}>
      {eyebrow ? <div className="particle-veil mb-4 w-fit max-w-full text-sm text-ink-muted">{eyebrow}</div> : null}
      {overline ? (
        // The veil lives on a wrapper: `.particle-veil` and the dash both use `::before`.
        <div className="particle-veil particle-veil-tight mb-3 w-fit">
          <Overline>{overline}</Overline>
        </div>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="flex min-w-0 items-start gap-4 sm:gap-5">
          {icon ? (
            <Icon name={icon} size="lg" px={56} className="mt-0.5 hidden sm:inline-grid" testId="page-header-icon" />
          ) : null}
          <div className="particle-veil min-w-0">
            <h1 className="font-display text-title font-semibold text-balance text-ink sm:text-hero lg:text-page">{title}</h1>
            {description ? (
              <p className="mt-2.5 max-w-2xl text-base text-pretty text-ink-muted">{description}</p>
            ) : null}
            {meta ? <div className="mt-4 flex flex-wrap items-center gap-2">{meta}</div> : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
