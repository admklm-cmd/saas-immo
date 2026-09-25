import type { Metadata } from "next";

import { APP_TEXTS } from "@/components/texts";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { ContactsTable } from "@/features/contacts/components/ContactsTable";
import { getContacts } from "@/features/contacts/queries";

const TEXTS = APP_TEXTS.contacts;

export const metadata: Metadata = { title: `${TEXTS.title} — ${APP_TEXTS.brand.name}` };

export default async function ContactsPage() {
  const { data: contacts, error } = await getContacts();

  return (
    <div className="page-frame">
      <PageHeader
        title={TEXTS.title}
        description={TEXTS.subtitle}
        meta={contacts && contacts.length > 0 ? <Badge tone="outline">{TEXTS.count(contacts.length)}</Badge> : null}
      />

      <div className="mt-8">
        {error ? (
          <Alert
            tone="error"
            title={TEXTS.errorTitle}
            action={
              <ButtonLink href="/contacts" variant="secondary" size="sm">
                {APP_TEXTS.states.retry}
              </ButtonLink>
            }
          >
            {error.message}
          </Alert>
        ) : contacts.length === 0 ? (
          <EmptyState
            title={TEXTS.emptyTitle}
            description={TEXTS.emptyBody}
            action={
              <ButtonLink href="/estimation" variant="secondary">
                {APP_TEXTS.marketing.estimation}
              </ButtonLink>
            }
          />
        ) : (
          <ContactsTable contacts={contacts} />
        )}
      </div>
    </div>
  );
}
