import type { Metadata } from "next";

import { APP_TEXTS } from "@/components/texts";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { getContacts } from "@/features/contacts/queries";
import { PipelineBoard } from "@/features/pipeline/components/PipelineBoard";
import { getPipelineViewer } from "@/features/pipeline/queries";

const TEXTS = APP_TEXTS.pipeline;
const CONTACTS_TEXTS = APP_TEXTS.contacts;

export const metadata: Metadata = { title: `${TEXTS.title} — ${APP_TEXTS.brand.name}` };

/**
 * `/pipeline` — the agency's contacts by stage.
 *
 * No drag-and-drop: each card links to the contact file and offers a
 * « Changer d'étape » menu (server action `changeContactStage`). The viewer's
 * role only EXPLAINS why leaving « Mandat signé » is reserved to a director;
 * if it cannot be read, the menu falls back to the most restrictive display
 * and the database decides anyway.
 */
export default async function PipelinePage() {
  const [{ data: contacts, error }, viewer] = await Promise.all([getContacts(), getPipelineViewer()]);
  const canExitSignedMandate = viewer.data?.canExitSignedMandate ?? false;

  return (
    <div className="page-frame">
      <PageHeader
        title={TEXTS.title}
        description={TEXTS.subtitle}
        meta={contacts && contacts.length > 0 ? <Badge tone="outline">{CONTACTS_TEXTS.count(contacts.length)}</Badge> : null}
      />

      <div className="mt-8">
        {error ? (
          <Alert
            tone="error"
            title={TEXTS.errorTitle}
            action={
              <ButtonLink href="/pipeline" variant="secondary" size="sm">
                {APP_TEXTS.states.retry}
              </ButtonLink>
            }
          >
            {error.message}
          </Alert>
        ) : contacts.length === 0 ? (
          <EmptyState
            title={CONTACTS_TEXTS.emptyTitle}
            description={CONTACTS_TEXTS.emptyBody}
            action={
              <ButtonLink href="/estimation" variant="secondary">
                {APP_TEXTS.marketing.estimation}
              </ButtonLink>
            }
          />
        ) : (
          <PipelineBoard contacts={contacts} canExitSignedMandate={canExitSignedMandate} />
        )}
      </div>
    </div>
  );
}
