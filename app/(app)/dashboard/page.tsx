import type { Metadata } from "next";

import { formatDateTime } from "@/components/format";
import { APP_TEXTS } from "@/components/texts";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { PageHeader } from "@/components/ui/PageHeader";
import { Reveal } from "@/components/ui/Reveal";
import { AgentsSummary } from "@/features/dashboard/components/AgentsSummary";
import { PipelineSummary } from "@/features/dashboard/components/PipelineSummary";
import { TodoSection } from "@/features/dashboard/components/TodoSection";
import { UpcomingAppointments } from "@/features/dashboard/components/UpcomingAppointments";
import { getDashboardSummary } from "@/features/dashboard/queries";

const TEXTS = APP_TEXTS.dashboard;

export const metadata: Metadata = { title: `${TEXTS.title} — ${APP_TEXTS.brand.name}` };

/**
 * `/dashboard` — what waits for the agency, then the state of its pipeline,
 * its AI agents and its next appointments.
 *
 * Every figure is an exact count made server-side (`getDashboardSummary`),
 * displayed with its scope. A figure that could not be computed reads
 * « Indisponible » without hiding the others; only an invalid session or
 * agency replaces the whole screen with an error.
 */
export default async function DashboardPage() {
  const { data: summary, error } = await getDashboardSummary();

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-10 lg:px-10 lg:py-12">
      <PageHeader
        title={TEXTS.title}
        description={TEXTS.subtitle}
        meta={
          summary ? (
            <Badge tone="outline">
              <time dateTime={summary.generatedAt}>{TEXTS.generatedAt(formatDateTime(summary.generatedAt))}</time>
            </Badge>
          ) : null
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
        <div className="mt-10 flex flex-col gap-12">
          <TodoSection todo={summary.todo} />
          <Reveal>
            <PipelineSummary pipeline={summary.pipeline} />
          </Reveal>
          <div className="grid gap-6 lg:grid-cols-2">
            <Reveal>
              <AgentsSummary agents={summary.agents} />
            </Reveal>
            <Reveal>
              <UpcomingAppointments list={summary.upcomingAppointments} />
            </Reveal>
          </div>
        </div>
      )}
    </div>
  );
}
