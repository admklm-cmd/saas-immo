import Link from "next/link";

import { formatDateTime } from "@/components/format";
import { APP_TEXTS } from "@/components/texts";
import { ArrowLink } from "@/components/ui/ArrowLink";
import { SimulationBadge } from "@/components/ui/SimulationBadge";

import type { AgentRunSummary } from "../types";
import { RunProcessDisclosure, type RenderRunProcess } from "./RunProcessDisclosure";
import { RunStatusBadge } from "./RunStatusBadge";
import { everyRunSimulated } from "./simulation-scope";

const TEXTS = APP_TEXTS.runHistory;
const AGENT_TEXTS = APP_TEXTS.agentsIa;

export type AgentRunsListProps = {
  runs: readonly AgentRunSummary[];
  /** Folded process of each run (server read), or nothing. */
  renderProcess?: RenderRunProcess;
};

/**
 * The agency's execution journal, newest first. One row = one attempt.
 *
 * A list rather than a table: each row can unfold its own process full width,
 * and the rows stack cleanly on a phone. When every run of the page is a
 * simulation, ONE « Simulation » badge heads the list (with a sentence that
 * says it covers every row) instead of one badge per row; as soon as a single
 * run is not simulated, each simulated row carries its own badge again.
 */
export function AgentRunsList({ runs, renderProcess }: AgentRunsListProps) {
  const blockSimulated = everyRunSimulated(runs);

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      {blockSimulated ? (
        <p
          className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-muted px-5 py-3 text-xs text-ink-muted"
          data-testid="run-history-simulation"
        >
          <SimulationBadge />
          {TEXTS.allSimulated}
        </p>
      ) : null}
      <ol aria-label={TEXTS.caption} className="divide-y divide-line" data-testid="run-history-rows">
        {runs.map((run) => (
          <li key={run.id} data-status={run.status} data-testid="run-history-row" className="px-5 py-4">
            <div className="grid gap-x-6 gap-y-2 md:grid-cols-[8rem_12rem_minmax(0,1fr)_auto] md:items-start">
              <div className="flex items-baseline justify-between gap-3 md:block">
                <p className="font-semibold text-ink">{run.agentLabel}</p>
                <time dateTime={run.startedAt} className="text-xs whitespace-nowrap text-ink-subtle md:mt-0.5 md:block">
                  {formatDateTime(run.startedAt)}
                </time>
              </div>
              <p className="flex flex-wrap items-center gap-1.5">
                <span className="sr-only">{TEXTS.columnStatus} : </span>
                <RunStatusBadge status={run.status} />
                {!blockSimulated && run.isSimulation ? <SimulationBadge /> : null}
              </p>
              <div className="min-w-0 text-sm">
                <p className="text-ink">
                  <span className="sr-only">{TEXTS.columnContact} : </span>
                  {run.contactId ? (
                    <Link
                      href={`/contacts/${run.contactId}`}
                      className="rounded-xs font-medium underline underline-offset-2 hover:text-ink-muted"
                    >
                      {/* Name read through the agency-scoped join; generic label otherwise. */}
                      {run.contactName ?? AGENT_TEXTS.openContact}
                    </Link>
                  ) : (
                    // Léa runs before any contact file exists. Stated, not hidden.
                    <span className="font-medium" title={AGENT_TEXTS.inboundLeadHint}>
                      {AGENT_TEXTS.inboundLead}
                    </span>
                  )}
                </p>
                {/* Server-written French sentence, displayed as plain text. */}
                <p className="mt-0.5 text-ink-muted">
                  <span className="sr-only">{TEXTS.columnDecision} : </span>
                  {run.decision ?? run.error ?? TEXTS.noDecision}
                </p>
              </div>
              <ArrowLink href={`/agents-ia/executions/${run.id}`}>{AGENT_TEXTS.viewReplay}</ArrowLink>
            </div>
            {renderProcess ? (
              <RunProcessDisclosure className="mt-3">{renderProcess(run.id)}</RunProcessDisclosure>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
