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
};

export function PageHeader({ eyebrow, title, description, meta, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("animate-rise", className)}>
      {eyebrow ? <div className="mb-3 text-sm text-ink-muted">{eyebrow}</div> : null}
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <h1 className="text-title font-semibold text-balance text-ink">{title}</h1>
          {description ? <p className="mt-2 max-w-2xl text-sm text-ink-muted">{description}</p> : null}
          {meta ? <div className="mt-4 flex flex-wrap items-center gap-2">{meta}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
