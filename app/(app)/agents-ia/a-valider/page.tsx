import type { Metadata } from "next";

import { APP_TEXTS } from "@/components/texts";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { PageHeader } from "@/components/ui/PageHeader";
import { SimulationBadge } from "@/components/ui/SimulationBadge";
import { RuleNote } from "@/features/agents-ia/components/flow/RuleNote";
import { PendingMessagesList } from "@/features/agents-ia/components/PendingMessagesList";
import { getMessagesToValidate } from "@/features/agents-ia/queries";

const TEXTS = APP_TEXTS.validationQueue;

export const metadata: Metadata = { title: `${TEXTS.title} — ${APP_TEXTS.brand.name}` };

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * The queue where the product's hardest rule is applied: **a first contact is
 * always validated by a human of the agency** (CLAUDE.md).
 *
 * Nothing here is sent by an agent, and nothing can be: no sending provider is
 * wired, the server re-reads the consent at send time and the database refuses
 * anything that is not flagged as a simulation.
 *
 * `?message=` only chooses which already-loaded message is shown first (dual
 * view, docs/design-system.md §3.1.1): it changes no query.
 */
export default async function MessagesToValidatePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [{ data: messages, error }, params] = await Promise.all([getMessagesToValidate(), searchParams]);
  const requested = typeof params.message === "string" ? params.message : null;

  return (
    <div className="page-frame">
      <PageHeader
        title={TEXTS.title}
        description={TEXTS.subtitle}
        meta={
          <>
            <SimulationBadge />
            {messages && messages.length > 0 ? (
              <Badge tone="outline">{TEXTS.count(messages.length)}</Badge>
            ) : null}
          </>
        }
      />

      {/* Said once, where the decision is taken: the rule, and what correcting
          a draft may and may not change. */}
      <RuleNote title={TEXTS.ruleTitle} className="particle-veil mt-8" testId="validation-rule">
        {TEXTS.ruleBody}
        <span className="mt-1 block text-ink-subtle">{TEXTS.editHint}</span>
      </RuleNote>

      <div className="mt-8">
        {error ? (
          <Alert
            tone="error"
            title={TEXTS.errorTitle}
            testId="validation-error"
            action={
              <ButtonLink href="/agents-ia/a-valider" variant="secondary" size="sm">
                {APP_TEXTS.states.retry}
              </ButtonLink>
            }
          >
            {error.message}
          </Alert>
        ) : (
          <PendingMessagesList messages={messages} initialSelectedId={requested} />
        )}
      </div>
    </div>
  );
}
