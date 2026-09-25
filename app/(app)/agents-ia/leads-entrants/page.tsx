import type { Metadata } from "next";

import { APP_TEXTS } from "@/components/texts";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SimulationBadge } from "@/components/ui/SimulationBadge";
import { InboundLeadCard } from "@/features/agents-ia/components/InboundLeadCard";
import { getInboundLeads } from "@/features/agents-ia/queries";

const TEXTS = APP_TEXTS.leadsInbox;

export const metadata: Metadata = { title: `${TEXTS.title} — ${APP_TEXTS.brand.name}` };

/**
 * Léa's inbox: the raw demands received, before any contact record exists.
 *
 * The product rule this screen repeats, because it is the one an agency gets
 * wrong: **a lead is not a consent**. Léa creates a file and opens a task to
 * collect a provable consent; she never records one herself.
 */
export default async function InboundLeadsPage() {
  const { data: leads, error } = await getInboundLeads();

  return (
    <div className="page-frame page-frame-reading">
      <PageHeader
        title={TEXTS.title}
        description={TEXTS.subtitle}
        meta={
          <>
            <SimulationBadge />
            {leads && leads.length > 0 ? <Badge tone="outline">{TEXTS.count(leads.length)}</Badge> : null}
          </>
        }
      />

      <Alert tone="info" title={TEXTS.ruleTitle} className="mt-8" testId="leads-rule">
        {TEXTS.ruleBody}
      </Alert>

      <div className="mt-8 flex flex-col gap-6">
        {error ? (
          <Alert
            tone="error"
            title={TEXTS.errorTitle}
            testId="leads-error"
            action={
              <ButtonLink href="/agents-ia/leads-entrants" variant="secondary" size="sm">
                {APP_TEXTS.states.retry}
              </ButtonLink>
            }
          >
            {error.message}
          </Alert>
        ) : leads.length === 0 ? (
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
          <div className="stagger flex flex-col gap-6">
            {leads.map((lead) => (
              <InboundLeadCard key={lead.id} lead={lead} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
