import Link from "next/link";

import { APP_TEXTS } from "@/components/texts";
import { cn } from "@/components/ui/cn";

import type { AgentsDashboard } from "../types";

const TEXTS = APP_TEXTS.situation;

export type Situation = {
  activeAgents: number;
  totalAgents: number;
  pendingValidation: number;
  blockedToday: number;
  failedToday: number;
};

/**
 * Exact figures of the immediate situation, summed from the dashboard the
 * server counted (no estimate, no trend). Pure: unit-tested on its own.
 */
export function summarizeSituation(dashboard: AgentsDashboard): Situation {
  return dashboard.agents.reduce<Situation>(
    (sum, agent) => ({
      ...sum,
      activeAgents: sum.activeAgents + (agent.isActive ? 1 : 0),
      blockedToday: sum.blockedToday + agent.today.runs.blocked,
      failedToday: sum.failedToday + agent.today.runs.failed,
    }),
    {
      activeAgents: 0,
      totalAgents: dashboard.agents.length,
      pendingValidation: dashboard.pendingValidationCount,
      blockedToday: 0,
      failedToday: 0,
    },
  );
}

type Figure = { key: string; label: string; value: string; href?: string; attention: boolean };

/**
 * Level 1 of « Agents IA »: four exact counts, read at a glance. A figure that
 * needs attention is written in ink on a raised tile; the accent is kept for
 * the human checkpoint (validations waiting).
 */
export function SituationStrip({ dashboard }: { dashboard: AgentsDashboard }) {
  const situation = summarizeSituation(dashboard);
  const figures: Figure[] = [
    {
      key: "active",
      label: TEXTS.activeAgents,
      value: TEXTS.activeAgentsValue(situation.activeAgents, situation.totalAgents),
      attention: situation.activeAgents < situation.totalAgents,
    },
    {
      key: "pending",
      label: TEXTS.pendingValidation,
      value: String(situation.pendingValidation),
      href: "/agents-ia/a-valider",
      attention: situation.pendingValidation > 0,
    },
    { key: "blocked", label: TEXTS.blocked, value: String(situation.blockedToday), attention: situation.blockedToday > 0 },
    { key: "failed", label: TEXTS.failed, value: String(situation.failedToday), attention: situation.failedToday > 0 },
  ];

  return (
    <section aria-labelledby="situation-title" data-testid="situation">
      <h2 id="situation-title" className="text-overline font-semibold text-ink-subtle uppercase">
        {TEXTS.title}
      </h2>
      <ul aria-label={TEXTS.listLabel} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {figures.map((figure) => {
          const content = (
            <>
              <span className="block text-xs font-medium text-ink-muted">{figure.label}</span>
              <span
                className={cn(
                  "mt-1 block text-section font-bold tabular-nums",
                  figure.key === "pending" && figure.attention ? "text-accent-strong" : "text-ink",
                )}
              >
                {figure.value}
              </span>
            </>
          );
          const tile = cn(
            "block h-full rounded-lg border px-4 py-3",
            figure.attention ? "border-line-strong bg-surface shadow-subtle" : "border-line bg-surface-muted",
          );
          return (
            <li key={figure.key} data-testid={`situation-${figure.key}`} data-attention={figure.attention || undefined}>
              {figure.href ? (
                <Link href={figure.href} className={cn(tile, "ui-focus transition-colors duration-150 hover:border-ink")}>
                  {content}
                </Link>
              ) : (
                <div className={tile}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-ink-subtle">{TEXTS.windowNote(dashboard.windows.today.label)}</p>
    </section>
  );
}
