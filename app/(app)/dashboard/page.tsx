import type { Metadata } from "next";

import { APP_TEXTS } from "@/components/texts";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { PageHeader } from "@/components/ui/PageHeader";
import { NoActionSample } from "@/features/dashboard/components/pilotage/NoActionSample";
import { formatClock, parsePeriodParam, PERIOD_ORDER } from "@/features/dashboard/components/pilotage/pilotage-format";
import { buildPilotageView, unavailableView, type PilotageView } from "@/features/dashboard/components/pilotage/pilotage-view";
import { PilotageDashboard } from "@/features/dashboard/components/pilotage/PilotageDashboard";
import { ToDoReminder } from "@/features/dashboard/components/pilotage/ToDoReminder";
import type { PilotagePeriodKey } from "@/features/dashboard/pilotage-periods";
import type { PilotageWithoutNextAction } from "@/features/dashboard/pilotage-types";
import { getDashboardPilotage, getDashboardSummary } from "@/features/dashboard/queries";

const TEXTS = APP_TEXTS.dashboard;

export const metadata: Metadata = { title: `${TEXTS.title} — ${APP_TEXTS.brand.name}` };

type PageProps = { searchParams: Promise<{ periode?: string | string[] }> };

/**
 * `/dashboard` — the page where the boss comes to look (docs/design-system.md §3.5.2): a
 * pure statistics page. « La Scène » (signed mandates against the previous period),
 * « la Feuille » (three figures, where the requests come from, where they go) and
 * « l'Atelier » (the five agents at work), under a sticky period bar and a reminder of what
 * waits for a person.
 *
 * The four periods are read in parallel on the server and sent as plain numbers and labels,
 * so a change of period is instant; `?periode=` (7j, 30j, 3m, 1a) decides the period of the
 * server HTML. Every figure is computed from recorded rows; a block that failed reads
 * « Indisponible » without hiding the others, and nothing is ever replaced by a zero.
 */
export default async function DashboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const initialPeriod = parsePeriodParam(params.periode);

  const [summaryResult, ...pilotageResults] = await Promise.all([
    getDashboardSummary(),
    ...PERIOD_ORDER.map((key) => getDashboardPilotage(key)),
  ]);
  const { data: summary, error } = summaryResult;

  if (error) {
    return (
      <div className="page-frame">
        <PageHeader overline={APP_TEXTS.nav.groupPilotage} icon="dashboard" title={TEXTS.title} />
        <Alert
          tone="error"
          title={TEXTS.errorTitle}
          className="mt-8"
          testId="dashboard-error"
          action={
            <ButtonLink href="/dashboard" variant="secondary" size="sm">
              {APP_TEXTS.states.retry}
            </ButtonLink>
          }
        >
          {error.message}
        </Alert>
      </div>
    );
  }

  const views = {} as Record<PilotagePeriodKey, PilotageView>;
  let withoutNextAction: PilotageWithoutNextAction | null = null;
  let pausedFromPilotage: boolean | null = null;
  PERIOD_ORDER.forEach((key, index) => {
    const data = pilotageResults[index]?.data ?? null;
    views[key] = data ? buildPilotageView(data) : unavailableView(key);
    if (data?.withoutNextAction.status === "ok" && !withoutNextAction) withoutNextAction = data.withoutNextAction.value;
    if (data?.agents.status === "ok" && pausedFromPilotage === null) pausedFromPilotage = data.agents.value.paused;
  });

  // The kill switch is read on its own: it stays true to the agency even when the activity counts failed.
  const killIndicator = summary.agents.killSwitch;
  const killSwitch =
    killIndicator.status === "ok"
      ? ({ status: "ok", paused: killIndicator.value.aiPaused } as const)
      : pausedFromPilotage !== null
        ? ({ status: "ok", paused: pausedFromPilotage } as const)
        : ({ status: "unavailable" } as const);
  const messages = summary.todo.messagesToValidate;

  return (
    <div className="page-frame" data-testid="dashboard-page">
      <PageHeader
        overline={APP_TEXTS.nav.groupPilotage}
        icon="dashboard"
        title={TEXTS.title}
        meta={
          <Badge tone="outline">
            <time dateTime={summary.generatedAt}>{TEXTS.pilotage.generatedAtShort(formatClock(summary.generatedAt))}</time>
          </Badge>
        }
      />
      <PilotageDashboard
        views={views}
        initialPeriod={initialPeriod}
        reminder={<ToDoReminder todo={summary.todo} />}
        noActionSample={withoutNextAction ? <NoActionSample data={withoutNextAction} /> : null}
        killSwitch={killSwitch}
        humanWaiting={messages.status === "ok" ? messages.value.total : null}
      />
    </div>
  );
}
