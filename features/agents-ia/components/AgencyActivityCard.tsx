import Link from "next/link";

import { APP_TEXTS } from "@/components/texts";
import { Card } from "@/components/ui/Card";
import { DataList } from "@/components/ui/DataList";
import { SimulationBadge } from "@/components/ui/SimulationBadge";

import type { AgentsDashboard } from "../types";
import { ActivityFigure } from "./ActivityFigure";

const TEXTS = APP_TEXTS.agentsIa;

/**
 * The agency's own figures: what was consumed today, and what waits for a human.
 *
 * `runsToday` is the count that the daily limit applies to; `runsTodayTotal`
 * includes the attempts that were refused (a refusal consumes no quota). The
 * two are displayed separately and named, because confusing them would either
 * alarm the agency or hide a problem from it.
 */
export function AgencyActivityCard({ dashboard }: { dashboard: AgentsDashboard }) {
  const today = dashboard.windows.today.label;

  return (
    <Card
      title={TEXTS.agencyTitle}
      description={TEXTS.agencySubtitle}
      actions={<SimulationBadge />}
      testId="agency-activity"
    >
      <DataList
        items={[
          {
            label: TEXTS.runsAgainstLimit,
            value: (
              <>
                <ActivityFigure runs={dashboard.runsToday} windowLabel={today} />
                <span className="block text-xs text-ink-subtle">{TEXTS.runsAgainstLimitHint}</span>
              </>
            ),
          },
          {
            label: TEXTS.dailyLimit,
            value: <span className="tabular-nums">{dashboard.dailyRunLimit}</span>,
          },
          {
            label: TEXTS.attempts,
            value: <ActivityFigure runs={dashboard.runsTodayTotal} windowLabel={today} />,
          },
          {
            label: TEXTS.pendingValidation,
            value: (
              <Link
                href="/agents-ia/a-valider"
                className="rounded-xs underline underline-offset-2 hover:text-ink-muted"
              >
                <span className="tabular-nums">{dashboard.pendingValidationCount}</span>
              </Link>
            ),
          },
        ]}
      />
    </Card>
  );
}
