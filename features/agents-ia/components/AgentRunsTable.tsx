import Link from "next/link";

import { formatDateTime } from "@/components/format";
import { APP_TEXTS } from "@/components/texts";
import { SimulationBadge } from "@/components/ui/SimulationBadge";

import type { AgentRunSummary } from "../types";
import { RunStatusBadge } from "./RunStatusBadge";

const TEXTS = APP_TEXTS.runHistory;
const AGENT_TEXTS = APP_TEXTS.agentsIa;

const HEAD = "px-5 py-3 text-overline font-semibold text-ink-subtle uppercase";

/** The agency's execution journal, newest first. One row = one attempt. */
export function AgentRunsTable({ runs }: { runs: readonly AgentRunSummary[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
          <caption className="sr-only">{TEXTS.caption}</caption>
          <thead>
            <tr className="border-b border-line bg-surface-muted">
              <th scope="col" className={HEAD}>
                {TEXTS.columnAgent}
              </th>
              <th scope="col" className={HEAD}>
                {TEXTS.columnStatus}
              </th>
              <th scope="col" className={HEAD}>
                {TEXTS.columnContact}
              </th>
              <th scope="col" className={HEAD}>
                {TEXTS.columnDecision}
              </th>
              <th scope="col" className={HEAD}>
                {TEXTS.columnStartedAt}
              </th>
              <th scope="col" className={HEAD}>
                {TEXTS.columnReplay}
              </th>
            </tr>
          </thead>
          <tbody data-testid="run-history-rows">
            {runs.map((run) => (
              <tr
                key={run.id}
                data-status={run.status}
                className="border-b border-line transition-colors duration-150 ease-standard last:border-b-0 hover:bg-surface-muted"
              >
                <th scope="row" className="px-5 py-4 align-top font-medium text-ink">
                  {run.agentLabel}
                </th>
                <td className="px-5 py-4 align-top">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <RunStatusBadge status={run.status} />
                    {run.isSimulation ? <SimulationBadge /> : null}
                  </span>
                </td>
                <td className="px-5 py-4 align-top text-ink-muted">
                  {run.contactId ? (
                    <Link
                      href={`/contacts/${run.contactId}`}
                      className="rounded-xs underline underline-offset-2 hover:text-ink"
                    >
                      {/* Name read through the agency-scoped join; falls back to
                          the generic label when the row carries no name. */}
                      {run.contactName ?? AGENT_TEXTS.openContact}
                    </Link>
                  ) : (
                    // Léa runs before any contact file exists. Stated, not hidden.
                    <span title={AGENT_TEXTS.inboundLeadHint}>{AGENT_TEXTS.inboundLead}</span>
                  )}
                </td>
                <td className="px-5 py-4 align-top text-ink-muted">
                  {/* Server-written French sentence, displayed as plain text. */}
                  {run.decision ?? run.error ?? TEXTS.noDecision}
                </td>
                <td className="px-5 py-4 align-top whitespace-nowrap text-ink-muted">
                  <time dateTime={run.startedAt}>{formatDateTime(run.startedAt)}</time>
                </td>
                <td className="px-5 py-4 align-top whitespace-nowrap">
                  <Link
                    href={`/agents-ia/executions/${run.id}`}
                    className="rounded-xs font-medium text-ink underline underline-offset-2"
                  >
                    {AGENT_TEXTS.viewReplay}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
