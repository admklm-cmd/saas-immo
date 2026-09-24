import type { ReactNode } from "react";

import { cn } from "./cn";

export type PageHeaderProps = {
  /** Small link or breadcrumb above the title. */
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Badges shown next to the title. */
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
  /**
   * `hero`: larger, bolder title with tighter tracking (Agents IA screens,
   * docs/design-system.md §2.2). `default` everywhere else.
   */
  size?: "default" | "hero";
};

export function PageHeader({
  eyebrow,
  title,
  description,
  meta,
  actions,
  className,
  size = "default",
}: PageHeaderProps) {
  return (
    <header className={cn("animate-rise", className)}>
      {eyebrow ? <div className="particle-veil mb-3 w-fit max-w-full text-sm text-ink-muted">{eyebrow}</div> : null}
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="particle-veil min-w-0">
          <h1
            className={cn(
              "text-balance text-ink",
              size === "hero" ? "text-hero font-bold" : "text-title font-semibold",
            )}
          >
            {title}
          </h1>
          {description ? (
            <p className={cn("mt-2 max-w-2xl text-ink-muted", size === "hero" ? "text-base" : "text-sm")}>
              {description}
            </p>
          ) : null}
          {meta ? <div className="mt-4 flex flex-wrap items-center gap-2">{meta}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
