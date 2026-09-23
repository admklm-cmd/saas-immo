import { APP_TEXTS } from "@/components/texts";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { KillSwitchPanel } from "@/features/agents-ia/components/KillSwitchPanel";

import type { SettingsAgents } from "../types";
import { SectionUnavailable } from "./SectionUnavailable";

const TEXTS = APP_TEXTS.settings;

/**
 * « Agents IA ». The kill switch is the ONLY control of this screen: the
 * existing panel and the existing action (`setAgencyAiPaused`), with the same
 * rules — any member may suspend, only a director may resume, enforced by the
 * database. The daily limit is read-only.
 */
export function AgentsSettingsSection({ agents }: { agents: SettingsAgents }) {
  const { killSwitch, dailyRunLimit } = agents;

  return (
    <section aria-labelledby="settings-agents-title" data-testid="settings-agents">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h2 id="settings-agents-title" className="text-heading font-semibold text-ink">
            {TEXTS.agentsTitle}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">{TEXTS.agentsSubtitle}</p>
        </div>
        <ButtonLink href="/agents-ia" variant="secondary" size="sm">
          {TEXTS.agentsLink}
        </ButtonLink>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        {killSwitch.status === "ok" ? (
          <KillSwitchPanel
            paused={killSwitch.value.aiPaused}
            canResume={killSwitch.value.canResume}
            headingLevel={3}
          />
        ) : (
          <Card title={APP_TEXTS.killSwitch.title} headingLevel={3} testId="settings-kill-switch-unavailable">
            <SectionUnavailable />
          </Card>
        )}

        <Card
          title={TEXTS.dailyLimitTitle}
          description={TEXTS.dailyLimitSubtitle}
          headingLevel={3}
          testId="settings-daily-limit"
        >
          {dailyRunLimit.status === "ok" ? (
            <div data-status="ok">
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-title font-semibold text-ink tabular-nums" data-testid="settings-daily-limit-value">
                  {dailyRunLimit.value}
                </span>
                <span className="text-sm text-ink-muted">{TEXTS.dailyLimitUnit(dailyRunLimit.value)}</span>
              </p>
              <p className="mt-3 text-xs text-ink-muted">{TEXTS.dailyLimitHint}</p>
            </div>
          ) : (
            <SectionUnavailable />
          )}
        </Card>
      </div>
    </section>
  );
}
