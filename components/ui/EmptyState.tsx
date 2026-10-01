import type { ReactNode } from "react";

import { Icon } from "@/components/icons/Icon";
import type { IconName } from "@/components/icons/icons";

import { cn } from "./cn";
import { splitTextAccent } from "./editorial-title";

export type EmptyStateProps = {
  title: ReactNode;
  /**
   * One whole word of `title` set in Instrument Serif italic (eight empty
   * states only, docs/design-system.md §2.2.9). Ignored when `title` is not a
   * string or does not hold the word exactly once.
   */
  titleAccent?: string;
  description?: ReactNode;
  /** Suggested next action, when there is one. */
  action?: ReactNode;
  /** Large icon of what is missing (docs/design-system.md §2.8). Defaults to a list. */
  icon?: IconName;
  className?: string;
};

/** The title, with its accented word wrapped IN the text: name and text content stay the title. */
function renderTitle(title: ReactNode, accent: string | undefined): ReactNode {
  if (typeof title !== "string") return title;
  const parts = splitTextAccent(title, accent);
  if (!parts) return title;
  const [before, word, after] = parts;
  return (
    <>
      {before}
      <span className="title-accent" data-accent="">
        {word}
      </span>
      {after}
    </>
  );
}

export function EmptyState({ title, titleAccent, description, action, icon = "tasks", className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex animate-rise flex-col items-center rounded-xl border border-dashed border-line-strong bg-surface-muted px-8 py-14 text-center",
        className,
      )}
    >
      <Icon name={icon} size="lg" px={56} className="mb-5" testId="empty-state-icon" />
      <p className="font-display text-section font-semibold text-balance text-ink" data-testid="empty-state-title">
        {renderTitle(title, titleAccent)}
      </p>
      {description ? <p className="mt-2 max-w-md text-sm text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
