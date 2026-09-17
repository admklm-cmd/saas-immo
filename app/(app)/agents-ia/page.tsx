import type { Metadata } from "next";

import { APP_TEXTS } from "@/components/texts";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { PageHeader } from "@/components/ui/PageHeader";
import { SimulationBadge } from "@/components/ui/SimulationBadge";
import { AgencyActivityCard } from "@/features/agents-ia/components/AgencyActivityCard";
import { AgentOverviewCard } from "@/features/agents-ia/components/AgentOverviewCard";
import { AgentRunsHistory } from "@/features/agents-ia/components/AgentRunsHistory";
import { KillSwitchPanel } from "@/features/agents-ia/components/KillSwitchPanel";
import { getAgentRuns, getAgentsOverview, getAiPausedState } from "@/features/agents-ia/queries";
import type { AgentRunFiltersInput } from "@/features/agents-ia/types";

const TEXTS = APP_TEXTS.agentsIa;

export const metadata: Metadata = { title: `${TEXTS.title} — ${APP_TEXTS.brand.name}` };

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/**
 * Filters exactly as the browser sent them.
 *
 * They are NOT cleaned up here: an unknown agent or a nonsense offset is passed
 * on and refused by the server-side schema, so the screen never displays a list
 * that does not match the filters it shows.
 */
function toFiltersInput(selected: { agent: string; status: string }, offset: string): AgentRunFiltersInput {
  const input: Record<string, unknown> = {};
  if (selected.agent) input.agent = selected.agent;
  if (selected.status) input.status = selected.status;
  if (offset) input.offset = Number(offset);
  return input as unknown as AgentRunFiltersInput;
}

export default async function AgentsIaPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const selected = { agent: first(params.agent), status: first(params.status) };

  // The kill switch is read on its own, deliberately: suspending every agent is
  // a safety control, so it must stay on screen even when a figure of the
  // dashboard could not be counted.
  const [overview, killSwitch, history] = await Promise.all([
    getAgentsOverview(),
    getAiPausedState(),
    getAgentRuns(toFiltersInput(selected, first(params.offset))),
  ]);

  const dashboard = overview.data;
  const paused = killSwitch.data;

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-10 lg:px-10 lg:py-12">
      <PageHeader
        title={TEXTS.title}
        description={
          <>
            {TEXTS.subtitle}
            <span className="mt-1 block">{TEXTS.simulatorNote}</span>
          </>
        }
        meta={
          <>
            <SimulationBadge />
            {paused?.aiPaused ? <Badge tone="solid">{APP_TEXTS.killSwitch.paused}</Badge> : null}
          </>
        }
      />

      {overview.error ? (
        <Alert
          tone="error"
          title={TEXTS.overviewErrorTitle}
          className="mt-8"
          testId="agents-overview-error"
          action={
            <ButtonLink href="/agents-ia" variant="secondary" size="sm">
              {APP_TEXTS.states.retry}
            </ButtonLink>
          }
        >
          {overview.error.message}
        </Alert>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {paused ? (
          <KillSwitchPanel paused={paused.aiPaused} canResume={paused.canResume} />
        ) : (
          <Alert tone="error" title={APP_TEXTS.killSwitch.errorTitle} testId="kill-switch-unavailable">
            {killSwitch.error.message}
          </Alert>
        )}
        {dashboard ? <AgencyActivityCard dashboard={dashboard} /> : null}
      </div>

      {dashboard ? (
        <>
          <section className="mt-12" aria-labelledby="agents-section">
            <h2 id="agents-section" className="text-heading font-semibold text-ink">
              {TEXTS.agentsSectionTitle}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">{TEXTS.agentsSectionSubtitle}</p>
            <div className="mt-5 grid gap-6 lg:grid-cols-2 2xl:grid-cols-3">
              {dashboard.agents.map((agent) => (
                <AgentOverviewCard
                  key={agent.agent}
                  agent={agent}
                  todayLabel={dashboard.windows.today.label}
                  last7DaysLabel={dashboard.windows.last7Days.label}
                />
              ))}
            </div>
          </section>
        </>
      ) : null}

      <div className="mt-12">
        <AgentRunsHistory
          page={history.data}
          errorMessage={history.error?.message ?? null}
          selected={selected}
        />
      </div>
    </div>
  );
}
