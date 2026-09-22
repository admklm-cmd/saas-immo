import type { Metadata } from "next";

import { APP_TEXTS } from "@/components/texts";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SimulationBadge } from "@/components/ui/SimulationBadge";
import { EmmaFollowUpCard } from "@/features/agents-ia/components/EmmaFollowUpCard";
import { getEmmaFollowUpCandidates } from "@/features/agents-ia/queries";

const TEXTS = APP_TEXTS.emmaFollowUps;

export const metadata: Metadata = { title: `${TEXTS.title} — ${APP_TEXTS.brand.name}` };

export default async function EmmaFollowUpsPage() {
  const { data: candidates, error } = await getEmmaFollowUpCandidates();

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10 lg:px-10 lg:py-12">
      <PageHeader
        title={TEXTS.title}
        description={TEXTS.subtitle}
        meta={
          <>
            <SimulationBadge />
            {candidates && candidates.length > 0 ? (
              <Badge tone="outline">{TEXTS.count(candidates.length)}</Badge>
            ) : null}
          </>
        }
      />

      <Alert tone="info" title={TEXTS.ruleTitle} className="mt-8" testId="emma-rule">
        {TEXTS.ruleBody}
      </Alert>

      <div className="mt-8 flex flex-col gap-6">
        {error ? (
          <Alert
            tone="error"
            title={TEXTS.errorTitle}
            action={
              <ButtonLink href="/agents-ia/relances" variant="secondary" size="sm">
                {APP_TEXTS.states.retry}
              </ButtonLink>
            }
          >
            {error.message}
          </Alert>
        ) : candidates?.length === 0 ? (
          <EmptyState
            title={TEXTS.emptyTitle}
            description={TEXTS.emptyBody}
            action={
              <ButtonLink href="/contacts" variant="secondary">
                {TEXTS.emptyAction}
              </ButtonLink>
            }
          />
        ) : (
          candidates?.map((candidate) => <EmmaFollowUpCard key={candidate.id} candidate={candidate} />)
        )}
      </div>
    </div>
  );
}
