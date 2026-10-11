import { APP_TEXTS } from "@/components/texts";
import { Disclosure } from "@/components/ui/Disclosure";

import type { DashboardDailyPoint } from "../types";
import { formatTableDay } from "./activity-chart";

const TEXTS = APP_TEXTS.dashboard.activity;

/** Every value of the chart, day by day: the text version of the graphic. */
export function ActivityValuesTable({ points }: { points: readonly DashboardDailyPoint[] }) {
  return (
    <Disclosure summary={TEXTS.tableSummary} size="sm" testId="activity-values" contentClassName="mt-3">
      <div className="max-h-80 overflow-auto rounded-lg border border-line" tabIndex={0} role="region" aria-label={TEXTS.tableCaption}>
        <table className="w-full min-w-72 border-collapse text-left text-sm">
          <caption className="sr-only">{TEXTS.tableCaption}</caption>
          <thead className="sticky top-0 bg-surface-muted text-xs text-ink-muted">
            <tr>
              <th scope="col" className="px-4 py-2 font-medium">
                {TEXTS.colDay}
              </th>
              <th scope="col" className="px-4 py-2 text-right font-medium">
                {TEXTS.colReceived}
              </th>
              <th scope="col" className="px-4 py-2 text-right font-medium">
                {TEXTS.colQualified}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {points.map((point) => (
              <tr key={point.date}>
                <th scope="row" className="px-4 py-2 font-normal text-ink-muted">
                  <time dateTime={point.date}>{formatTableDay(point.date)}</time>
                </th>
                <td className="figure px-4 py-2 text-right text-ink">{point.received}</td>
                <td className="figure px-4 py-2 text-right text-ink">{point.qualified}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Disclosure>
  );
}
