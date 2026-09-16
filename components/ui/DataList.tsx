import type { ReactNode } from "react";

import { cn } from "./cn";

export type DataListItem = {
  label: string;
  value: ReactNode;
};

export type DataListProps = {
  items: readonly DataListItem[];
  /** Two columns on desktop, one on small screens. */
  columns?: 1 | 2;
  className?: string;
};

/** Key/value block, rendered as a real definition list for screen readers. */
export function DataList({ items, columns = 2, className }: DataListProps) {
  return (
    <dl className={cn("grid gap-x-8 gap-y-4", columns === 2 ? "sm:grid-cols-2" : "", className)}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-overline font-semibold text-ink-subtle uppercase">{item.label}</dt>
          <dd className="mt-1 text-sm break-words text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
