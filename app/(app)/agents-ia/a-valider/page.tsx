import type { Metadata } from "next";

import { APP_TEXTS } from "@/components/texts";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { PageHeader } from "@/components/ui/PageHeader";
import { SimulationBadge } from "@/components/ui/SimulationBadge";
import { PendingMessagesList } from "@/features/agents-ia/components/PendingMessagesList";
import { getMessagesToValidate } from "@/features/agents-ia/queries";

const TEXTS = APP_TEXTS.validationQueue;

export const metadata: Metadata = { title: `${TEXTS.title} — ${APP_TEXTS.brand.name}` };

/**
 * The queue where the product's hardest rule is applied: **a first contact is
 * always validated by a human of the agency** (CLAUDE.md).
 *
 * Nothing here is sent by an agent, and nothing can be: no sending provider is
 * wired, the server re-reads the consent at send time and the database refuses
 * anything that is not flagged as a simulation.
 */
export default async function MessagesToValidatePage() {
  const { data: messages, error } = await getMessagesToValidate();

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10 lg:px-10 lg:py-12">
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

      <Alert tone="info" title={TEXTS.ruleTitle} className="mt-8" testId="validation-rule">
        {TEXTS.ruleBody}
        {/* Said once, at the top: what this screen cannot do yet. */}
        <span className="mt-2 block text-ink-subtle">{TEXTS.noEditYet}</span>
      </Alert>

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
          <PendingMessagesList messages={messages} />
        )}
      </div>
    </div>
  );
}
