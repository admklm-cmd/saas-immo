import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { formatDate } from "@/components/format";
import { APP_TEXTS } from "@/components/texts";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { PipelineStageBadge } from "@/components/ui/PipelineStageBadge";
import { AgentActionsPanel } from "@/features/contacts/components/AgentActionsPanel";
import { ContactConsentsCard } from "@/features/contacts/components/ContactConsentsCard";
import { ContactIdentityCard } from "@/features/contacts/components/ContactIdentityCard";
import { ContactPropertyCard } from "@/features/contacts/components/ContactPropertyCard";
import { ContactTimeline } from "@/features/contacts/components/ContactTimeline";
import { getContactById, getContactTimeline } from "@/features/contacts/queries";

const TEXTS = APP_TEXTS.contact;

export const metadata: Metadata = { title: `${TEXTS.pageTitle} — ${APP_TEXTS.brand.name}` };

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [contactResult, timelineResult] = await Promise.all([
    getContactById(id),
    getContactTimeline(id),
  ]);

  // Unknown contact and contact of another agency return the exact same code,
  // so the 404 page leaks nothing about what exists elsewhere.
  if (contactResult.error?.code === "contact_not_found") notFound();

  if (contactResult.error) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-12">
        <Alert
          tone="error"
          title={APP_TEXTS.states.errorTitle}
          action={
            <ButtonLink href="/contacts" variant="secondary" size="sm">
              {TEXTS.backToList}
            </ButtonLink>
          }
        >
          {contactResult.error.message}
        </Alert>
      </div>
    );
  }

  const contact = contactResult.data;

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-10 lg:px-10 lg:py-12">
      <PageHeader
        eyebrow={
          <Link href="/contacts" className="rounded-xs hover:text-ink hover:underline">
            ← {TEXTS.backToList}
          </Link>
        }
        title={contact.displayName}
        meta={
          <>
            <PipelineStageBadge stage={contact.stage} />
            {contact.humanTakeover ? (
              <Badge tone="outline">{APP_TEXTS.contacts.humanTakeover}</Badge>
            ) : null}
            {contact.openTasksCount > 0 ? (
              <Badge tone="dashed">{APP_TEXTS.contacts.openTasks(contact.openTasksCount)}</Badge>
            ) : null}
            <Badge>
              {TEXTS.updatedAt} {formatDate(contact.updatedAt)}
            </Badge>
          </>
        }
      />

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="stagger flex min-w-0 flex-col gap-6">
          <ContactIdentityCard contact={contact} />
          <ContactPropertyCard property={contact.property} />

          <Card title={TEXTS.timelineTitle} description={TEXTS.timelineSubtitle}>
            {timelineResult.error ? (
              <Alert tone="error" title={TEXTS.timelineError}>
                {timelineResult.error.message}
              </Alert>
            ) : (
              <ContactTimeline entries={timelineResult.data} />
            )}
          </Card>
        </div>

        <div className="stagger flex flex-col gap-6 lg:sticky lg:top-24">
          <AgentActionsPanel contactId={contact.id} />
          <ContactConsentsCard consents={contact.consents} />
        </div>
      </div>
    </div>
  );
}
