import type { ReactNode } from "react";

import { Icon } from "@/components/icons/Icon";
import type { IconName } from "@/components/icons/icons";

import { cn } from "./cn";

export type EmptyStateProps = {
  title: ReactNode;
  description?: ReactNode;
  /** Suggested next action, when there is one. */
  action?: ReactNode;
  /** Large icon of what is missing (docs/design-system.md §2.8). Defaults to a list. */
  icon?: IconName;
  className?: string;
};

export function EmptyState({ title, description, action, icon = "tasks", className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex animate-rise flex-col items-center rounded-xl border border-dashed border-line-strong bg-surface-muted px-8 py-14 text-center",
        className,
      )}
    >
      <Icon name={icon} size="lg" px={56} className="mb-5" testId="empty-state-icon" />
      <p className="text-heading font-semibold text-ink">{title}</p>
      {description ? <p className="mt-2 max-w-md text-sm text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
