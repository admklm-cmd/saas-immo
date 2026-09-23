import Link from "next/link";

import { formatDateTime } from "@/components/format";
import { APP_TEXTS } from "@/components/texts";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { AGENT_RUN_STATUS_LABELS } from "@/lib/agents/messages";

import type { AgentActivity, AgentOverview } from "../types";
import { ActivityFigure } from "./ActivityFigure";
import { RunStatusBadge } from "./RunStatusBadge";

const TEXTS = APP_TEXTS.agentsIa;

/** Outcomes worth naming under a total; a zero outcome stays silent. */
const OUTCOMES = ["succeeded", "failed", "blocked", "running"] as const;

/**
 * Named outcomes: a technical error is inverted (strongest emphasis), a guard
 * rail is outlined and says « Bloquée par un garde-fou » — never an error.
 */
function outcomeBadge(outcome: (typeof OUTCOMES)[number], count: number) {
  switch (outcome) {
    case "failed":
      return { tone: "solid" as const, text: TEXTS.outcomeFailed(count) };
    case "blocked":
      return { tone: "outline" as const, text: TEXTS.outcomeBlocked(count) };
    default:
      return { tone: "neutral" as const, text: TEXTS.outcome(AGENT_RUN_STATUS_LABELS[outcome], count) };
  }
}

function Outcomes({ activity }: { activity: AgentActivity }) {
  const shown = OUTCOMES.filter((outcome) => activity.runs[outcome] > 0);
  if (shown.length === 0) return null;

  return (
    <span className="flex flex-wrap gap-1.5">
      {shown.map((outcome) => {
        const badge = outcomeBadge(outcome, activity.runs[outcome]);
        return (
          <Badge key={outcome} tone={badge.tone}>
            {badge.text}
          </Badge>
        );
      })}
    </span>
  );
}

export type AgentOverviewCardProps = {
  agent: AgentOverview;
  /** French names of the two windows the figures are counted in. */
  todayLabel: string;
  last7DaysLabel: string;
};

/**
 * One agent of the product: who it is, what it may do, what it really did.
 *
 * Every figure comes from an exact count over a NAMED window, and the last run
 * is described by `lastRunLabel` — "Jamais exécuté" is a statement of the
 * server, never something this card deduces from an empty history.
 */
export function AgentOverviewCard({ agent, todayLabel, last7DaysLabel }: AgentOverviewCardProps) {
  return (
    <Card
      title={agent.label}
      description={agent.mission}
      headingLevel={3}
      actions={
        <Badge tone={agent.isActive ? "outline" : "solid"}>
          {agent.isActive ? TEXTS.statusActive : TEXTS.statusPaused}
        </Badge>
      }
      testId={`agent-card-${agent.agent}`}
      className="flex flex-col"
    >
      <dl className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <dt className="sr-only">{todayLabel}</dt>
          <dd className="text-sm font-medium text-ink">
            <ActivityFigure runs={agent.today.runs.total} windowLabel={todayLabel} />
          </dd>
          <dd>
            <Outcomes activity={agent.today} />
          </dd>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <dt className="sr-only">{last7DaysLabel}</dt>
          <dd className="text-sm text-ink-muted">
            <ActivityFigure runs={agent.last7Days.runs.total} windowLabel={last7DaysLabel} />
          </dd>
          <dd className="text-xs text-ink-subtle">
            {TEXTS.tokens} : {TEXTS.tokensValue(agent.last7Days.tokens.input, agent.last7Days.tokens.output)}
          </dd>
        </div>
      </dl>

      <div className="mt-4 border-t border-line pt-4">
        <p className="text-overline font-semibold text-ink-subtle uppercase">{TEXTS.lastRun}</p>
        <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-ink">
          {/* The outcome, named like everywhere else (a block is not an error);
              « Jamais exécuté » stays the server's statement. */}
          {agent.lastRun ? (
            <RunStatusBadge status={agent.lastRun.status} />
          ) : (
            <span className="font-medium">{agent.lastRunLabel}</span>
          )}
          {agent.lastRun ? (
            <>
              <time dateTime={agent.lastRun.startedAt} className="text-xs text-ink-muted">
                {formatDateTime(agent.lastRun.startedAt)}
              </time>
              {agent.lastRun.contactId ? (
                <Link
                  href={`/contacts/${agent.lastRun.contactId}`}
                  className="rounded-xs text-xs text-ink-muted underline underline-offset-2 hover:text-ink"
                >
                  {agent.lastRun.contactName ?? TEXTS.openContact}
                </Link>
              ) : (
                // Léa works before any contact exists: this is a fact to state,
                // not a missing value to hide behind a dash.
                <span className="text-xs text-ink-muted" title={TEXTS.inboundLeadHint}>
                  {TEXTS.inboundLead}
                </span>
              )}
              <Link
                href={`/agents-ia/executions/${agent.lastRun.id}`}
                className="rounded-xs text-xs font-medium text-ink underline underline-offset-2"
              >
                {TEXTS.viewReplay}
              </Link>
            </>
          ) : null}
        </p>
      </div>

      <div className="mt-4 border-t border-line pt-4">
        <p className="text-overline font-semibold text-ink-subtle uppercase">{TEXTS.lastErrors}</p>
        {agent.lastErrors.length === 0 ? (
          <p className="mt-1.5 text-sm text-ink-muted">{TEXTS.noError}</p>
        ) : (
          <ul className="mt-1.5 flex flex-col gap-2">
            {agent.lastErrors.map((error) => (
              <li key={error.runId} className="text-sm" data-testid="agent-last-issue" data-status={error.status}>
                <span className="flex flex-wrap items-center gap-2">
                  <RunStatusBadge status={error.status} />
                  <time dateTime={error.at} className="text-xs text-ink-subtle">
                    {formatDateTime(error.at)}
                  </time>
                  <Link
                    href={`/agents-ia/executions/${error.runId}`}
                    className="rounded-xs text-xs text-ink-muted underline underline-offset-2 hover:text-ink"
                  >
                    {TEXTS.viewReplay}
                  </Link>
                </span>
                {error.decision ? (
                  <p className="mt-1 text-ink-muted">
                    {error.status === "blocked" ? (
                      <span className="font-medium text-ink">{APP_TEXTS.guardRail.reason} : </span>
                    ) : null}
                    {error.decision}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
