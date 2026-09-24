import Link from "next/link";

import { formatDateTime } from "@/components/format";
import { APP_TEXTS } from "@/components/texts";
import { ArrowLink } from "@/components/ui/ArrowLink";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Disclosure } from "@/components/ui/Disclosure";
import { cn } from "@/components/ui/cn";
import { AGENT_RUN_STATUS_LABELS } from "@/lib/agents/messages";

import type { AgentActivity, AgentOverview } from "../types";
import { ActivityFigure } from "./ActivityFigure";
import { AGENT_GLYPHS } from "./agent-icons";
import { AgentAppIcon } from "./icons/AgentAppIcon";
import { RunProcessDisclosure, type RenderRunProcess } from "./RunProcessDisclosure";
import { RunStatusBadge } from "./RunStatusBadge";

const TEXTS = APP_TEXTS.agentsIa;

/** Outcomes worth naming under a total; a zero outcome stays silent. */
const OUTCOMES = ["succeeded", "failed", "blocked", "running"] as const;

/**
 * Named outcomes, as plain text (one line, no chip per outcome): a technical
 * error is written in bold, a guard rail says « Bloquée par un garde-fou » —
 * never an error. The words carry the meaning, never a colour.
 */
function outcomeText(outcome: (typeof OUTCOMES)[number], count: number): string {
  switch (outcome) {
    case "failed":
      return TEXTS.outcomeFailed(count);
    case "blocked":
      return TEXTS.outcomeBlocked(count);
    default:
      return TEXTS.outcome(AGENT_RUN_STATUS_LABELS[outcome], count);
  }
}

function Outcomes({ activity }: { activity: AgentActivity }) {
  const shown = OUTCOMES.filter((outcome) => activity.runs[outcome] > 0);
  if (shown.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-muted">
      {shown.map((outcome) => (
        <li key={outcome} className={cn(outcome === "failed" && "font-semibold text-ink")}>
          {outcomeText(outcome, activity.runs[outcome])}
        </li>
      ))}
    </ul>
  );
}

export type AgentOverviewCardProps = {
  agent: AgentOverview;
  /** French names of the two windows the figures are counted in. */
  todayLabel: string;
  last7DaysLabel: string;
  /** Folded process of the last run (server read), or nothing. */
  renderProcess?: RenderRunProcess;
};

/**
 * One agent of the product: who it is, what it may do, what it really did.
 *
 * Every figure comes from an exact count over a NAMED window, and the last run
 * is described by `lastRunLabel` — "Jamais exécuté" is a statement of the
 * server, never something this card deduces from an empty history. The
 * recent failures and blocks are listed once, for the five agents together,
 * in « Erreurs et blocages récents » (`RecentIssuesList`): the card only says
 * how many there are and links there.
 */
export function AgentOverviewCard({ agent, todayLabel, last7DaysLabel, renderProcess }: AgentOverviewCardProps) {
  const issues = agent.lastErrors.length;

  return (
    <Card
      title={
        <span className="flex items-center gap-3">
          {/* Same app tile as the rail and the public carousel; grey when the agent is paused. */}
          <AgentAppIcon
            glyph={AGENT_GLYPHS[agent.agent]}
            size="md"
            state={agent.isActive ? "idle" : "inactive"}
            testId="agent-app-icon"
          />
          {agent.label}
        </span>
      }
      description={agent.mission}
      headingLevel={3}
      actions={
        <Badge tone={agent.isActive ? "outline" : "solid"}>
          {agent.isActive ? TEXTS.statusActive : TEXTS.statusPaused}
        </Badge>
      }
      testId={`agent-card-${agent.agent}`}
      className="flex h-full flex-col"
    >
      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="sr-only">{todayLabel}</dt>
          <dd className="text-base font-semibold text-ink">
            <ActivityFigure runs={agent.today.runs.total} windowLabel={todayLabel} />
          </dd>
          <dd className="mt-1">
            <Outcomes activity={agent.today} />
          </dd>
        </div>
        <div>
          <dt className="sr-only">{last7DaysLabel}</dt>
          <dd className="text-sm text-ink-muted">
            <ActivityFigure runs={agent.last7Days.runs.total} windowLabel={last7DaysLabel} />
          </dd>
        </div>
      </dl>

      <div className="mt-5 border-t border-line pt-4">
        <p className="text-overline font-semibold text-ink-subtle uppercase">{TEXTS.lastRun}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-ink">
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
              <ArrowLink href={`/agents-ia/executions/${agent.lastRun.id}`} className="sm:ml-auto">
                {TEXTS.viewReplay}
              </ArrowLink>
            </>
          ) : null}
        </div>
        {agent.lastRun && renderProcess ? (
          <RunProcessDisclosure className="mt-3">{renderProcess(agent.lastRun.id)}</RunProcessDisclosure>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-4 text-sm">
        <span className="sr-only">{TEXTS.lastErrors} : </span>
        {issues === 0 ? (
          <span className="text-ink-muted">{TEXTS.noError}</span>
        ) : (
          <>
            <span className="font-medium text-ink" data-testid="agent-issues-count">
              {TEXTS.agentIssues(issues)}
            </span>
            <Link href="#a-examiner" className="rounded-xs text-ink-muted underline underline-offset-2 hover:text-ink">
              {TEXTS.agentIssuesLink}
            </Link>
          </>
        )}
      </div>

      <Disclosure summary={TEXTS.technicalDetails} className="mt-4" testId="agent-technical">
        <p className="text-xs text-ink-muted">
          {TEXTS.tokens} ({last7DaysLabel}) :{" "}
          <span className="tabular-nums text-ink">
            {TEXTS.tokensValue(agent.last7Days.tokens.input, agent.last7Days.tokens.output)}
          </span>
        </p>
      </Disclosure>
    </Card>
  );
}
