import type { ReactNode } from "react";

import { cn } from "./cn";

export type EmptyStateProps = {
  title: ReactNode;
  description?: ReactNode;
  /** Suggested next action, when there is one. */
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex animate-rise flex-col items-center rounded-xl border border-dashed border-line-strong bg-surface-muted px-8 py-14 text-center",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="mb-4 flex size-11 items-center justify-center rounded-full border border-line-strong bg-surface text-ink-subtle"
      >
        <svg viewBox="0 0 24 24" className="size-5 stroke-current" fill="none" strokeWidth="1.5">
          <path d="M4 7h16M4 12h10M4 17h7" strokeLinecap="round" />
        </svg>
      </span>
      <p className="text-heading font-semibold text-ink">{title}</p>
      {description ? <p className="mt-2 max-w-md text-sm text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
