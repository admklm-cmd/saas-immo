import { APP_TEXTS } from "@/components/texts";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { Disclosure } from "@/components/ui/Disclosure";

import type { AgentsDashboard } from "../types";
import { ActivityFigure } from "./ActivityFigure";

const TEXTS = APP_TEXTS.agentsIa;

/**
 * What waits for a human first, then the agency's own figures.
 *
 * The drafts waiting for validation are the decision of this screen: their
 * exact count comes first, with the only primary (solid black) action. Then
 * `runsToday`, the count the daily limit applies to, and `runsTodayTotal`,
 * which includes the refused attempts (a refusal consumes no quota) — both
 * named, each with its window, because confusing them would either alarm the
 * agency or hide a problem from it. The « how is it counted » note is folded.
 */
export function AgencyActivityCard({ dashboard }: { dashboard: AgentsDashboard }) {
  const today = dashboard.windows.today.label;
  const pending = dashboard.pendingValidationCount;

  return (
    <Card title={TEXTS.decisionTitle} testId="agency-activity" className="h-full">
      <div className="flex flex-wrap items-end justify-between gap-4" data-testid="pending-validation">
        <div>
          <p className="text-overline font-semibold text-ink-subtle uppercase">{TEXTS.pendingValidation}</p>
          <p className="mt-1 text-hero font-bold figure text-ink">{pending}</p>
          {pending === 0 ? <p className="text-sm text-ink-muted">{TEXTS.pendingNone}</p> : null}
        </div>
        <ButtonLink href="/agents-ia/a-valider" variant={pending > 0 ? "primary" : "secondary"} arrow="forward">
          {TEXTS.pendingCta}
        </ButtonLink>
      </div>

      <dl className="mt-6 grid gap-4 border-t border-line pt-5 sm:grid-cols-3">
        <div>
          <dt className="text-overline font-semibold text-ink-subtle uppercase">{TEXTS.runsAgainstLimit}</dt>
          <dd className="mt-1 text-sm font-medium text-ink">
            <ActivityFigure runs={dashboard.runsToday} windowLabel={today} />
          </dd>
        </div>
        <div>
          <dt className="text-overline font-semibold text-ink-subtle uppercase">{TEXTS.dailyLimit}</dt>
          <dd className="mt-1 text-sm font-medium figure text-ink">{dashboard.dailyRunLimit}</dd>
        </div>
        <div>
          <dt className="text-overline font-semibold text-ink-subtle uppercase">{TEXTS.attempts}</dt>
          <dd className="mt-1 text-sm font-medium text-ink">
            <ActivityFigure runs={dashboard.runsTodayTotal} windowLabel={today} />
          </dd>
        </div>
      </dl>

      <Disclosure summary={TEXTS.figuresHelp} className="mt-4" testId="agency-figures-help">
        <p className="max-w-xl text-xs text-ink-muted">
          {TEXTS.agencySubtitle} {TEXTS.runsAgainstLimitHint}
        </p>
      </Disclosure>
    </Card>
  );
}
