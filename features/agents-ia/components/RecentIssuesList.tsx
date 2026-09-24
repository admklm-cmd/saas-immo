import { formatDateTime } from "@/components/format";
import { APP_TEXTS } from "@/components/texts";
import { ArrowLink } from "@/components/ui/ArrowLink";
import { Disclosure } from "@/components/ui/Disclosure";

import type { AgentOverview, AgentRunError } from "../types";
import { RunProcessDisclosure, type RenderRunProcess } from "./RunProcessDisclosure";
import { RunStatusBadge } from "./RunStatusBadge";

const TEXTS = APP_TEXTS.agentsIa;

type Issue = AgentRunError & { agentLabel: string };

/**
 * The recent failures and blocks of the five agents, in one list, newest first.
 *
 * Only a presentation merge of what the server returned per agent
 * (`lastErrors`): nothing is counted, filtered out or reclassified here. A
 * guard-rail block keeps « Bloquée par un garde-fou » and its « Motif : »; a
 * technical error keeps « Erreur technique ». It is a history, not an alert:
 * no `role="alert"`.
 */
export function collectRecentIssues(agents: readonly AgentOverview[]): Issue[] {
  return agents
    .flatMap((agent) => agent.lastErrors.map((error) => ({ ...error, agentLabel: agent.label })))
    .sort((left, right) => right.at.localeCompare(left.at));
}

export function RecentIssuesList({
  agents,
  renderProcess,
}: {
  agents: readonly AgentOverview[];
  renderProcess?: RenderRunProcess;
}) {
  const issues = collectRecentIssues(agents);

  return (
    <section aria-labelledby="recent-issues" id="a-examiner" className="scroll-mt-6" data-testid="recent-issues">
      <div className="particle-veil flex w-fit max-w-full flex-col gap-1">
        <h2 id="recent-issues" className="text-section font-bold text-ink">
          {TEXTS.lastErrors}
        </h2>
        <p className="text-sm text-ink-muted">{TEXTS.issuesSubtitle}</p>
      </div>

      <div className="mt-5 rounded-xl border border-line bg-surface shadow-subtle">
        {issues.length === 0 ? (
          <p className="px-6 py-5 text-sm text-ink-muted" data-testid="recent-issues-empty">
            {TEXTS.issuesEmpty}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {issues.map((issue) => (
              <li
                key={issue.runId}
                className="px-6 py-4"
                data-testid="agent-last-issue"
                data-status={issue.status}
              >
                <div className="grid gap-x-6 gap-y-2 md:grid-cols-[8rem_minmax(0,1fr)_auto] md:items-start">
                  <div className="flex items-baseline justify-between gap-3 md:block">
                    <p className="font-semibold text-ink">{issue.agentLabel}</p>
                    <time dateTime={issue.at} className="text-xs whitespace-nowrap text-ink-subtle md:mt-0.5 md:block">
                      {formatDateTime(issue.at)}
                    </time>
                  </div>
                  <div className="min-w-0 text-sm">
                    <RunStatusBadge status={issue.status} />
                    {issue.decision ? (
                      <p className="mt-1.5 text-ink-muted">
                        {issue.status === "blocked" ? (
                          <span className="font-medium text-ink">{APP_TEXTS.guardRail.reason} : </span>
                        ) : null}
                        {issue.decision}
                      </p>
                    ) : null}
                  </div>
                  <ArrowLink href={`/agents-ia/executions/${issue.runId}`}>{TEXTS.viewReplay}</ArrowLink>
                </div>
                {renderProcess ? (
                  <RunProcessDisclosure className="mt-3">{renderProcess(issue.runId)}</RunProcessDisclosure>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <Disclosure summary={TEXTS.issuesHelp} className="border-t border-line px-6 py-4" testId="recent-issues-help">
          <p className="max-w-2xl text-sm text-ink-muted">{TEXTS.issuesHelpBody}</p>
        </Disclosure>
      </div>
    </section>
  );
}
