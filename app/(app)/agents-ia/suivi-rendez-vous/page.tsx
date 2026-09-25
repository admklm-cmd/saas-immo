import type { Metadata } from "next";

import { APP_TEXTS } from "@/components/texts";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SimulationBadge } from "@/components/ui/SimulationBadge";
import { SarahFollowThroughList } from "@/features/agents-ia/components/SarahFollowThroughList";
import { getAppointmentsToFollowThrough } from "@/features/agents-ia/queries";

const TEXTS = APP_TEXTS.followThrough;

export const metadata: Metadata = { title: `${TEXTS.title} — ${APP_TEXTS.brand.name}` };

export default async function FollowThroughPage() {
  const { data: appointments, error } = await getAppointmentsToFollowThrough();

  return (
    <div className="page-frame page-frame-reading">
      <PageHeader
        title={TEXTS.title}
        description={TEXTS.subtitle}
        meta={
          <>
            <SimulationBadge />
            {appointments && appointments.length > 0 ? (
              <Badge tone="outline">{TEXTS.count(appointments.length)}</Badge>
            ) : null}
          </>
        }
      />

      <Alert tone="info" title={TEXTS.ruleTitle} className="mt-8" testId="sarah-rule">
        {TEXTS.ruleBody}
      </Alert>

      <div className="mt-8">
        {error ? (
          <Alert
            tone="error"
            title={TEXTS.errorTitle}
            testId="sarah-list-error"
            action={
              <ButtonLink href="/agents-ia/suivi-rendez-vous" variant="secondary" size="sm">
                {APP_TEXTS.states.retry}
              </ButtonLink>
            }
          >
            {error.message}
          </Alert>
        ) : appointments.length === 0 ? (
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
          <SarahFollowThroughList appointments={appointments} />
        )}
      </div>
    </div>
  );
}
