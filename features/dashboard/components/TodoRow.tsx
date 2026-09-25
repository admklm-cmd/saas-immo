import Link from "next/link";
import type { ReactNode } from "react";

import { APP_TEXTS } from "@/components/texts";
import { AgentAppIcon } from "@/features/agents-ia/components/icons/AgentAppIcon";
import type { GlyphName } from "@/features/agents-ia/components/icons/glyphs";

import type { DashboardActionList } from "../types";
import { DashboardFigure } from "./DashboardFigure";
import { listTotal } from "./list-total";

const TEXTS = APP_TEXTS.dashboard;

/** How many sample items a row shows (the summary carries up to five). */
export const TODO_ROW_SAMPLE = 2;

export type TodoRowProps<TItem> = {
  /** Stable identifier: heading id and `data-testid="dashboard-{id}"`. */
  id: string;
  title: string;
  /** Glyph of the work, inside the human-decision shape. */
  glyph: GlyphName;
  /** Optional precision under the figure (what exactly is counted). */
  hint?: string;
  list: DashboardActionList<TItem>;
  unit: (total: number) => string;
  emptyText: string;
  getKey: (item: TItem) => string;
  renderItem: (item: TItem) => ReactNode;
  /** The screen where the work is done. */
  link: { href: string; label: string };
  /** « Les 2 premiers sur 12 » — feminine for « tâches ». */
  sampleLabel?: (shown: number, total: number) => string;
};

/**
 * One line of « À faire maintenant »: what waits, how many (exact total and
 * scope), the first items, and where to handle them. Rows share one column
 * grid, so titles, figures, samples and links line up from one row to the next,
 * and a row is only as tall as what it holds — no empty card space.
 *
 * The human-decision shape (double contour) carries a thin cobalt ring only
 * when something really waits; the sample is never presented as the whole list.
 */
export function TodoRow<TItem>({
  id,
  title,
  glyph,
  hint,
  list,
  unit,
  emptyText,
  getKey,
  renderItem,
  link,
  sampleLabel = TEXTS.sample,
}: TodoRowProps<TItem>) {
  const headingId = `dashboard-${id}-title`;
  const value = list.status === "ok" ? list.value : null;
  const items = value ? value.items.slice(0, TODO_ROW_SAMPLE) : [];
  const waiting = value !== null && value.total > 0;
  const partial = value !== null && value.total > items.length && items.length > 0;

  return (
    <section
      aria-labelledby={headingId}
      data-testid={`dashboard-${id}`}
      data-waiting={waiting ? "true" : "false"}
      className="grid gap-x-8 gap-y-4 px-5 py-5 sm:px-6 lg:grid-cols-[18rem_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:items-start"
    >
      <div className="flex min-w-0 gap-4">
        <AgentAppIcon
          glyph={glyph}
          kind="human"
          size="md"
          state={value === null ? "inactive" : waiting ? "active" : "idle"}
        />
        <div className="min-w-0">
          <h3 id={headingId} className="text-sm font-semibold text-ink">
            {title}
          </h3>
          <DashboardFigure indicator={listTotal(list)} unit={unit} className="mt-1" />
          {hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
        </div>
      </div>

      <div className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:pt-0.5">
        {value !== null && value.total === 0 ? (
          <p data-testid="dashboard-empty" className="flex items-center gap-2.5 text-sm text-ink-subtle lg:min-h-10">
            <span
              aria-hidden="true"
              className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-line-strong text-xs text-ink-muted"
            >
              ✓
            </span>
            {emptyText}
          </p>
        ) : null}

        {items.length > 0 ? (
          <>
            {partial ? (
              <p className="mb-2 text-overline font-semibold text-ink-subtle uppercase">
                {sampleLabel(items.length, value?.total ?? items.length)}
              </p>
            ) : null}
            <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {items.map((item) => (
                <li key={getKey(item)} className="min-w-0 rounded-lg bg-surface-muted px-3.5 py-2.5">
                  {renderItem(item)}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>

      <div className="lg:col-start-1 lg:row-start-2 lg:pl-14">
        <Link
          href={link.href}
          className="inline-flex items-center gap-1.5 rounded-xs text-sm font-medium text-ink underline-offset-4 transition-colors duration-150 ease-standard whitespace-nowrap hover:text-ink-muted hover:underline"
        >
          {link.label}
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}
