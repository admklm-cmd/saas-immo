import Link from "next/link";

import { formatDateTime, formatDurationMs } from "@/components/format";
import { APP_TEXTS, RUN_OUTCOME_LABELS } from "@/components/texts";
import { cn } from "@/components/ui/cn";

import type { AgentRunSummary } from "../types";
import { RunStatusBadge } from "./RunStatusBadge";

const TEXTS = APP_TEXTS.runDetail;
const AGENT_TEXTS = APP_TEXTS.agentsIa;

export type RunOutcomeSummaryProps = {
  run: AgentRunSummary;
  /** Sum of the measured step durations (server). */
  measuredMs: number;
};

/**
 * First block of an execution: what came out of it, on which file, when.
 *
 * The outcome is named like everywhere else. A guard-rail block reads
 * « Motif : » + the server's sentence and « ce n'est pas une erreur »; a
 * technical error reads « Erreur technique : »; a run still in progress says
 * that only the steps recorded so far are known. Informative, never
 * `role="alert"`: this is a record, not something that just happened.
 */
export function RunOutcomeSummary({ run, measuredMs }: RunOutcomeSummaryProps) {
  const sentence = run.decision ?? run.error ?? TEXTS.unknown;

  return (
    <section
      aria-labelledby="run-outcome-title"
      data-testid="run-outcome"
      data-status={run.status}
      className={cn(
        "rounded-xl border bg-surface px-6 py-5 shadow-subtle",
        run.status === "failed" ? "border-inverse border-2" : run.status === "blocked" ? "border-ink border-dashed" : "border-line",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="run-outcome-title" className="text-overline font-semibold text-ink-subtle uppercase">
          {TEXTS.outcomeTitle}
        </h2>
        <RunStatusBadge status={run.status} />
      </div>

      <p className="mt-3 text-heading font-semibold text-ink">
        {run.status === "blocked" ? (
          <span className="text-ink-muted">{APP_TEXTS.guardRail.reason} : </span>
        ) : run.status === "failed" ? (
          <span className="text-ink-muted">{RUN_OUTCOME_LABELS.failed} : </span>
        ) : null}
        <span className="whitespace-pre-line">{sentence}</span>
      </p>
      {run.status === "blocked" ? <p className="mt-2 text-sm text-ink-muted">{APP_TEXTS.guardRail.notAnError}</p> : null}
      {run.status === "running" ? <p className="mt-2 text-sm text-ink-muted">{APP_TEXTS.replay.inProgressNote}</p> : null}

      <dl className="mt-5 grid gap-4 border-t border-line pt-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-overline font-semibold text-ink-subtle uppercase">{TEXTS.contact}</dt>
          <dd className="mt-1 text-ink">
            {run.contactId ? (
              <Link href={`/contacts/${run.contactId}`} className="rounded-xs font-medium underline underline-offset-2 hover:text-ink-muted">
                {run.contactName ?? AGENT_TEXTS.openContact}
              </Link>
            ) : (
              <span title={AGENT_TEXTS.inboundLeadHint}>{AGENT_TEXTS.inboundLead}</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-overline font-semibold text-ink-subtle uppercase">{TEXTS.startedAt}</dt>
          <dd className="mt-1 text-ink">
            <time dateTime={run.startedAt}>{formatDateTime(run.startedAt)}</time>
          </dd>
        </div>
        <div>
          <dt className="text-overline font-semibold text-ink-subtle uppercase">{TEXTS.measuredDuration}</dt>
          <dd className="mt-1 tabular-nums text-ink">{formatDurationMs(measuredMs)}</dd>
        </div>
      </dl>
    </section>
  );
}
