import type { Metadata } from "next";

import { APP_TEXTS } from "@/components/texts";
import { Alert } from "@/components/ui/Alert";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SimulationBadge } from "@/components/ui/SimulationBadge";
import { RuleNote } from "@/features/agents-ia/components/flow/RuleNote";
import { FollowUpSieve } from "@/features/agents-ia/components/follow-ups/FollowUpSieve";
import { AgentAppIcon } from "@/features/agents-ia/components/icons/AgentAppIcon";
import { getEmmaFollowUpCandidates } from "@/features/agents-ia/queries";
import { AGENT_LABELS } from "@/lib/agents/messages";

const TEXTS = APP_TEXTS.emmaFollowUps;

export const metadata: Metadata = {
  title: `${TEXTS.title} — ${APP_TEXTS.brand.name}`,
};

/**
 * Emma's workspace, drawn as a sieve (docs/design-system.md §3.1.2). The page
 * reads the list once; the summary, the gates and the groups are display
 * counts of that same list — no extra query, no rule of their own.
 */
export default async function EmmaFollowUpsPage() {
  const { data: candidates, error } = await getEmmaFollowUpCandidates();

  return (
    <div className="page-frame">
      <PageHeader
        title={TEXTS.title}
        description={TEXTS.subtitle}
        meta={
          <>
            <SimulationBadge />
            <span className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface py-0.5 pr-3 pl-0.5 text-xs font-medium text-ink-muted">
              <AgentAppIcon glyph="emma" size="sm" className="scale-[0.8]" />
              {AGENT_LABELS.emma}
            </span>
          </>
        }
      />

      <div className="mt-10">
        {error ? (
          <Alert
            tone="error"
            title={TEXTS.errorTitle}
            action={
              <ButtonLink
                href="/agents-ia/relances"
                variant="secondary"
                size="sm"
              >
                {APP_TEXTS.states.retry}
              </ButtonLink>
            }
          >
            {error.message}
          </Alert>
        ) : candidates.length === 0 ? (
          <div className="flex flex-col gap-8">
            <RuleNote title={TEXTS.ruleTitle} testId="emma-rule">
              {TEXTS.ruleBody}
            </RuleNote>
            <EmptyState
              title={TEXTS.emptyTitle}
              description={TEXTS.emptyBody}
              action={
                <ButtonLink href="/contacts" variant="secondary">
                  {TEXTS.emptyAction}
                </ButtonLink>
              }
            />
          </div>
        ) : (
          <FollowUpSieve candidates={candidates} />
        )}
      </div>
    </div>
  );
}
