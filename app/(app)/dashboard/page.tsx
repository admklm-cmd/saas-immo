import type { Metadata } from "next";

import { formatDateTime } from "@/components/format";
import { APP_TEXTS } from "@/components/texts";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { PageHeader } from "@/components/ui/PageHeader";
import { AgentsSummary } from "@/features/dashboard/components/AgentsSummary";
import { PipelineFrieze } from "@/features/dashboard/components/PipelineFrieze";
import { TodoSection } from "@/features/dashboard/components/TodoSection";
import { UpcomingAppointments } from "@/features/dashboard/components/UpcomingAppointments";
import { getDashboardSummary } from "@/features/dashboard/queries";

const TEXTS = APP_TEXTS.dashboard;

export const metadata: Metadata = { title: `${TEXTS.title} — ${APP_TEXTS.brand.name}` };

/**
 * `/dashboard` — where the dossiers of the agency stand, and what waits for a
 * person right now (docs/design-system.md §3.5).
 *
 *   1. The pipeline frieze: one dot per dossier at its stage, and the human
 *      checkpoints on the line — the demonstration of the screen.
 *   2. « À faire maintenant »: one row per kind of human decision.
 *   3. The AI agents (kill switch, executions) and the next appointments.
 *
 * Every figure is an exact count made server-side (`getDashboardSummary`),
 * displayed with its scope. A figure that could not be computed reads
 * « Indisponible » without hiding the others; only an invalid session or
 * agency replaces the whole screen with an error. Nothing is hidden behind an
 * entrance animation: the whole screen is in the server HTML.
 */
export default async function DashboardPage() {
  const { data: summary, error } = await getDashboardSummary();
  // Exact count of the header action, only when it was really computed (never a guessed 0).
  const messages = summary?.todo.messagesToValidate;
  const pendingMessages = messages?.status === "ok" && messages.value.total > 0 ? messages.value.total : null;

  return (
    <div className="page-frame">
      <PageHeader
        title={TEXTS.title}
        meta={
          summary ? (
            <Badge tone="outline">
              <time dateTime={summary.generatedAt}>{TEXTS.generatedAt(formatDateTime(summary.generatedAt))}</time>
            </Badge>
          ) : null
        }
        actions={
          <ButtonLink href="/agents-ia/a-valider" variant="primary" arrow="forward" data-testid="dashboard-primary-action">
            {TEXTS.primaryAction}
            {pendingMessages ? <span className="figure ml-1 opacity-70">{pendingMessages}</span> : null}
          </ButtonLink>
        }
      />

      {error ? (
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
      ) : (
        <div className="mt-10 flex flex-col gap-12 lg:mt-12 lg:gap-14">
          <PipelineFrieze pipeline={summary.pipeline} todo={summary.todo} />
          <TodoSection todo={summary.todo} />
          <div className="grid gap-6 xl:grid-cols-2">
            <AgentsSummary agents={summary.agents} />
            <UpcomingAppointments list={summary.upcomingAppointments} />
          </div>
        </div>
      )}
    </div>
  );
}
