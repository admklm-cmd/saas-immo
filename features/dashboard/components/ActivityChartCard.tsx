import { ChartStage } from "@/components/charts/ChartStage";
import { Icon } from "@/components/icons/Icon";
import { APP_TEXTS } from "@/components/texts";
import { Card } from "@/components/ui/Card";
import { SimulationBadge } from "@/components/ui/SimulationBadge";

import type { DashboardDailySeries } from "../types";
import { isEmptySeries } from "./activity-chart";
import { ActivityAreaChart } from "./ActivityAreaChart";
import { ActivityLegend } from "./ActivityLegend";
import { ActivityValuesTable } from "./ActivityValuesTable";

const TEXTS = APP_TEXTS.dashboard.activity;
const numberFmt = new Intl.NumberFormat("fr-FR");

function Total({ value, unit }: { value: number; unit: string }) {
  return (
    <div data-chart-figure="" data-testid="activity-total">
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="figure text-title font-semibold text-ink">{numberFmt.format(value)}</span>
        <span className="text-sm text-ink-muted">{unit}</span>
      </p>
      <p className="mt-1 text-xs text-ink-subtle">{TEXTS.totalScope}</p>
    </div>
  );
}

export type ActivityChartCardProps = {
  /** `null` when the read itself failed: shown as « Indisponible », never as a zero. */
  series: DashboardDailySeries | null;
};

/**
 * « Activité sur 30 jours » (docs/design-system.md §3.5.1.A): requests received
 * and dossiers qualified, per day. A Server Component: title, scope, totals,
 * legend and table of values are in the HTML; only the chart is a client island.
 * Every number is counted by the database; nothing is smoothed or estimated.
 */
export function ActivityChartCard({ series }: ActivityChartCardProps) {
  const ok = series?.status === "ok" ? series : null;
  const empty = ok !== null && isEmptySeries(ok.points);

  return (
    <section aria-labelledby="dashboard-activity-title" data-testid="dashboard-activity">
      <ChartStage>
        <Card
          title={<span id="dashboard-activity-title">{TEXTS.title}</span>}
          description={TEXTS.scope}
          actions={<SimulationBadge />}
          headingLevel={2}
          className="shadow-subtle"
        >
          {ok === null ? (
            <div data-testid="activity-unavailable" role="status">
              <p className="text-heading font-semibold text-ink">{TEXTS.unavailableTitle}</p>
              <p className="mt-1 text-sm text-ink-muted">{TEXTS.unavailableBody}</p>
            </div>
          ) : empty ? (
            <p data-testid="activity-empty" className="flex items-center gap-2.5 text-sm text-ink-subtle">
              <span
                aria-hidden="true"
                className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-line-strong text-xs text-ink-muted"
              >
                <Icon name="check" px="0.75rem" />
              </span>
              {TEXTS.empty}
            </p>
          ) : (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-x-10">
                <div className="flex flex-col gap-4 sm:flex-row sm:gap-10">
                  <Total value={ok.totals.received} unit={TEXTS.receivedUnit(ok.totals.received)} />
                  <Total value={ok.totals.qualified} unit={TEXTS.qualifiedUnit(ok.totals.qualified)} />
                </div>
                <ActivityLegend />
              </div>
              <ActivityAreaChart points={ok.points} />
              <p className="text-xs text-ink-subtle">
                {TEXTS.note} {TEXTS.todayNote}
              </p>
              <ActivityValuesTable points={ok.points} />
            </div>
          )}
        </Card>
      </ChartStage>
    </section>
  );
}
