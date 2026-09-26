import { APP_TEXTS } from "@/components/texts";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { Disclosure } from "@/components/ui/Disclosure";
import { SimulationBadge } from "@/components/ui/SimulationBadge";

import type { DashboardAgents } from "../types";
import { RunCountsList } from "./RunCountsList";

const TEXTS = APP_TEXTS.dashboard;
const KILL_SWITCH = APP_TEXTS.killSwitch;

/**
 * « Agents IA ». The kill switch is a safety control, read on its own: its
 * state stays on screen even when the execution counts are unavailable. The
 * switch itself is operated on `/agents-ia` only — never duplicated here.
 */
export function AgentsSummary({ agents }: { agents: DashboardAgents }) {
  const killSwitch = agents.killSwitch;

  return (
    <Card
      title={TEXTS.agentsTitle}
      actions={<SimulationBadge />}
      testId="dashboard-agents"
      className="h-full"
    >
      <div data-testid="dashboard-kill-switch" data-status={killSwitch.status}>
        <p className="text-overline font-semibold text-ink-subtle uppercase">{TEXTS.killSwitchLabel}</p>
        {killSwitch.status === "ok" ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={killSwitch.value.aiPaused ? "solid" : "outline"}>
              {killSwitch.value.aiPaused ? KILL_SWITCH.paused : KILL_SWITCH.running}
            </Badge>
            <span className="text-sm text-ink-muted">
              {killSwitch.value.aiPaused ? TEXTS.killSwitchOn : TEXTS.killSwitchOff}
            </span>
          </div>
        ) : (
          <p className="mt-2 text-sm font-semibold text-ink">{TEXTS.unavailable}</p>
        )}
        <p className="mt-1 text-xs text-ink-subtle">
          <span className="sr-only">{TEXTS.scopePrefix} </span>
          {TEXTS.scopes[killSwitch.scope.key]}
        </p>
      </div>

      <div className="mt-6 grid gap-6 border-t border-line pt-5 sm:grid-cols-2">
        <RunCountsList id="today" runs={agents.runsToday} />
        <RunCountsList id="last-7-days" runs={agents.runsLast7Days} />
      </div>
      {agents.runsToday.status === "unavailable" || agents.runsLast7Days.status === "unavailable" ? (
        <p className="mt-3 text-xs text-ink-muted">{TEXTS.unavailableHint}</p>
      ) : null}
      {/* The hint is the toggle: one line at rest, the guard rails one keypress
          away (native <details>: Tab, Enter / Space, announced as expandable). */}
      <Disclosure
        summary={TEXTS.runsBlockedHint}
        size="xs"
        className="mt-4"
        contentClassName="pt-2 pl-2"
        testId="dashboard-blocked-guards"
      >
        <ul
          aria-label={TEXTS.runsBlockedGuardsLabel}
          className="list-disc space-y-0.5 pl-4 text-xs text-ink-muted marker:text-ink-subtle"
        >
          {TEXTS.runsBlockedGuards.map((guard) => (
            <li key={guard}>{guard}</li>
          ))}
        </ul>
      </Disclosure>

      <div className="mt-6">
        <ButtonLink href="/agents-ia" variant="secondary" size="sm">
          {TEXTS.agentsLink}
        </ButtonLink>
      </div>
    </Card>
  );
}
