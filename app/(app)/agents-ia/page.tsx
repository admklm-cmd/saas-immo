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
import { RecentIssuesList } from "@/features/agents-ia/components/RecentIssuesList";
import { RunProcessPreviewLoader } from "@/features/agents-ia/components/RunProcessPreviewLoader";
import { SelectedDossierCard } from "@/features/agents-ia/components/SelectedDossierCard";
import { SituationStrip } from "@/features/agents-ia/components/SituationStrip";
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
  // The journal is folded by default; it opens when the user asked for a
  // filtered view or another page (the URL carries it).
  const historyRequested = Boolean(first(params.agent) || first(params.status) || first(params.offset));
  const renderProcess = (runId: string) => <RunProcessPreviewLoader runId={runId} />;

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-10 lg:px-10 lg:py-14">
      <PageHeader
        title={TEXTS.title}
        meta={
          <>
            {/* One badge for the whole page: every agent runs on the simulator. */}
            <SimulationBadge />
            <span className="text-sm text-ink-muted">{TEXTS.simulatorNote}</span>
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

      {/* 1. Immediate situation: exact counts, then the kill switch and what waits for a human. */}
      {dashboard ? (
        <div className="mt-10">
          <SituationStrip dashboard={dashboard} />
        </div>
      ) : null}
      <div className="stagger mt-8 grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          {paused ? (
            <KillSwitchPanel paused={paused.aiPaused} canResume={paused.canResume} />
          ) : (
            <Alert tone="error" title={APP_TEXTS.killSwitch.errorTitle} testId="kill-switch-unavailable">
              {killSwitch.error.message}
            </Alert>
          )}
        </div>
        {dashboard ? (
          <div className="lg:col-span-7">
            <AgencyActivityCard dashboard={dashboard} />
          </div>
        ) : null}
      </div>

      {dashboard ? (
        <>
          {/* 2. The selected journey: the last dossier really worked on. */}
          <div className="mt-14">
            <SelectedDossierCard agents={dashboard.agents} />
          </div>

          {/* 3. Details: recent failures and guard-rail blocks, the agents, the journal. */}
          <div className="mt-14">
            <RecentIssuesList agents={dashboard.agents} renderProcess={renderProcess} />
          </div>

          {/* The five agents. */}
          <section className="mt-14" aria-labelledby="agents-section">
            <div className="particle-veil w-fit max-w-full">
              <h2 id="agents-section" className="text-section font-bold text-ink">
                {TEXTS.agentsSectionTitle}
              </h2>
            </div>
            <div className="stagger mt-5 grid gap-6 lg:grid-cols-2 2xl:grid-cols-3">
              {dashboard.agents.map((agent) => (
                <AgentOverviewCard
                  key={agent.agent}
                  agent={agent}
                  todayLabel={dashboard.windows.today.label}
                  last7DaysLabel={dashboard.windows.last7Days.label}
                  renderProcess={renderProcess}
                />
              ))}
            </div>
          </section>
        </>
      ) : null}

      {/* History, folded. */}
      <div className="mt-14">
        <AgentRunsHistory
          page={history.data}
          errorMessage={history.error?.message ?? null}
          selected={selected}
          defaultOpen={historyRequested}
          renderProcess={renderProcess}
        />
      </div>
    </div>
  );
}
