import Link from "next/link";
import type { ReactNode } from "react";

import { APP_TEXTS } from "@/components/texts";

import type { DashboardActionList } from "../types";
import { DashboardFigure } from "./DashboardFigure";
import { listTotal } from "./list-total";

const TEXTS = APP_TEXTS.dashboard;

export type ActionListCardProps<TItem> = {
  /** Stable identifier: heading id and `data-testid="dashboard-{id}"`. */
  id: string;
  title: string;
  /** Optional precision under the figure (what exactly is counted). */
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
   * reads « Tout voir » when the sample is partial. `false` for the tasks,
   * whose items live on each contact file (no screen lists them all).
   */
  linkListsEverything?: boolean;
  /** « Les 5 premiers sur 12 » — feminine for « tâches ». */
  sampleLabel?: (shown: number, total: number) => string;
  headingLevel?: 2 | 3;
};

/**
 * An action list: the EXACT total as the figure, then a small sample linking
 * to the files, then the screen where the whole list is handled.
 *
 * The sample is never presented as the whole list: when `hasMore`, the card
 * says how many items are shown out of the total.
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
}: ActionListCardProps<TItem>) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const headingId = `dashboard-${id}-title`;
  const value = list.status === "ok" ? list.value : null;
  const partial = value?.hasMore === true;

  return (
    <section
      aria-labelledby={headingId}
      data-testid={`dashboard-${id}`}
      className="flex h-full flex-col rounded-xl border border-line bg-surface shadow-subtle"
    >
      <div className="px-6 pt-5">
        <Heading
          id={headingId}
          className={headingLevel === 2 ? "text-heading font-semibold text-ink" : "text-base font-semibold text-ink"}
        >
          {title}
        </Heading>
        <DashboardFigure indicator={listTotal(list)} unit={unit} className="mt-3" />
        {hint ? <p className="mt-2 text-xs text-ink-muted">{hint}</p> : null}
      </div>

      {value && value.total === 0 ? <p className="px-6 pt-4 text-sm text-ink-subtle">{emptyText}</p> : null}

      {value && value.items.length > 0 ? (
        <div className="mt-4 border-t border-line">
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
        </div>
      ) : null}

      <div className="mt-auto border-t border-line px-6 py-4">
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
