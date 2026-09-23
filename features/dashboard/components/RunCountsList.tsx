import { APP_TEXTS } from "@/components/texts";

import type { AgentRunCounts } from "@/features/agents-ia/types";

import type { DashboardIndicator } from "../types";

const TEXTS = APP_TEXTS.dashboard;

/**
 * Executions of one window (« aujourd'hui », « sur 7 jours »): total, errors,
 * and attempts blocked by a guard rail — which are NOT errors, and are named
 * as such. The window is part of the heading, next to the figures.
 */
export function RunCountsList({ id, runs }: { id: string; runs: DashboardIndicator<AgentRunCounts> }) {
  const headingId = `dashboard-runs-${id}`;
  const scope = TEXTS.scopes[runs.scope.key];
  const counts = runs.status === "ok" ? runs.value : null;
  const rows = [
    { label: TEXTS.runsTotal, value: counts?.total },
    { label: TEXTS.runsFailed, value: counts?.failed },
    { label: TEXTS.runsBlocked, value: counts?.blocked },
  ];

  return (
    <section aria-labelledby={headingId} data-testid={`dashboard-runs-${id}`} data-status={runs.status}>
      <h3 id={headingId} className="text-sm font-semibold text-ink">
        {TEXTS.runsWindowTitle(scope)}
      </h3>
      <dl className="mt-3 flex flex-col gap-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3 text-sm">
            <dt className="text-ink-muted">{row.label}</dt>
            <dd className="font-semibold text-ink tabular-nums">
              {row.value === undefined ? TEXTS.unavailable : row.value}
              <span className="sr-only"> ({scope})</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
