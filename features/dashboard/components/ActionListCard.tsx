import Link from "next/link";
import type { ReactNode } from "react";

import { APP_TEXTS } from "@/components/texts";
import { cn } from "@/components/ui/cn";

import type { DashboardActionList } from "../types";
import { DashboardFigure } from "./DashboardFigure";
import { listTotal } from "./list-total";

const TEXTS = APP_TEXTS.dashboard;

export type ActionListCardProps<TItem> = {
  /** Stable identifier: heading id and `data-testid="dashboard-{id}"`. */
  id: string;
  title: string;
  /** Optional precision under the figure (what exactly is counted). One line on desktop. */
  hint?: string;
  list: DashboardActionList<TItem>;
  unit: (total: number) => string;
  emptyText: string;
  getKey: (item: TItem) => string;
  renderItem: (item: TItem) => ReactNode;
  /** The screen where the work is done. */
  link: { href: string; label: string };
  /**
   * `true` when `link.href` lists EVERY item of this figure: the link then
   * reads « Tout voir » when the sample is partial. `false` when the target
   * screen does not list every counted item (never « Tout voir » then).
   */
  linkListsEverything?: boolean;
  /** « Les 5 premiers sur 12 » — feminine for « tâches ». */
  sampleLabel?: (shown: number, total: number) => string;
  headingLevel?: 2 | 3;
  /**
   * `"subgrid"`: the card spans three rows of its parent grid (header, list,
   * footer) with `grid-rows-subgrid`, so the dividers and the footers of the
   * cards of one row line up exactly, whatever each card holds. The parent must
   * be a grid without row gap: the card carries its own bottom margin. `"standalone"` (default): a plain flex column.
   */
  layout?: "standalone" | "subgrid";
};

/**
 * An action list: the EXACT total as the figure, then a small sample linking
 * to the files, then the screen where the whole list is handled.
 *
 * The sample is never presented as the whole list: when `hasMore`, the card
 * says how many items are shown out of the total. An empty list takes the
 * place of the first item — one compact row, aligned with its neighbours.
 */
export function ActionListCard<TItem>({
  id,
  title,
  hint,
  list,
  unit,
  emptyText,
  getKey,
  renderItem,
  link,
  linkListsEverything = true,
  sampleLabel = TEXTS.sample,
  headingLevel = 3,
  layout = "standalone",
}: ActionListCardProps<TItem>) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const headingId = `dashboard-${id}-title`;
  const value = list.status === "ok" ? list.value : null;
  const partial = value?.hasMore === true;
  const empty = value !== null && value.total === 0;
  const hasItems = value !== null && value.items.length > 0;

  return (
    <section
      aria-labelledby={headingId}
      data-testid={`dashboard-${id}`}
      className={cn(
        "rounded-xl border border-line bg-surface shadow-subtle",
        layout === "subgrid" ? "row-span-3 mb-6 grid grid-rows-subgrid gap-y-0" : "flex h-full flex-col",
      )}
    >
      <div className="px-6 pt-5 pb-4">
        <Heading
          id={headingId}
          className={headingLevel === 2 ? "text-heading font-semibold text-ink" : "text-base font-semibold text-ink"}
        >
          {title}
        </Heading>
        <DashboardFigure indicator={listTotal(list)} unit={unit} className="mt-3" />
        {hint ? <p className="mt-2 text-xs text-ink-muted">{hint}</p> : null}
      </div>

      <div className={cn(layout === "standalone" && "flex-1", (empty || hasItems) && "border-t border-line")}>
        {empty ? (
          <p data-testid="dashboard-empty" className="flex items-center gap-2.5 px-6 py-3 text-sm text-ink-subtle">
            <span
              aria-hidden="true"
              className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-line-strong text-xs text-ink-muted"
            >
              ✓
            </span>
            {emptyText}
          </p>
        ) : null}

        {hasItems ? (
          <>
            {partial ? (
              <p className="px-6 pt-3 text-overline font-semibold text-ink-subtle uppercase">
                {sampleLabel(value.items.length, value.total)}
              </p>
            ) : null}
            <ul className="divide-y divide-line px-6">
              {value.items.map((item) => (
                <li key={getKey(item)} className="py-3">
                  {renderItem(item)}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>

      <div className="border-t border-line px-6 py-4">
        <Link
          href={link.href}
          className="inline-flex items-center gap-1.5 rounded-xs text-sm font-medium text-ink underline-offset-4 transition-colors duration-150 ease-standard hover:text-ink-muted hover:underline"
        >
          {partial && linkListsEverything ? (
            <>
              {TEXTS.viewAll}
              <span className="sr-only"> — {title}</span>
            </>
          ) : (
            link.label
          )}
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}
