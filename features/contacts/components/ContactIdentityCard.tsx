import { formatDate } from "@/components/format";
import { APP_TEXTS } from "@/components/texts";
import { Card } from "@/components/ui/Card";
import { DataList } from "@/components/ui/DataList";
import { CONTACT_SOURCE_LABELS, type ContactDetail } from "@/features/contacts/types";

const TEXTS = APP_TEXTS.contact;

function orUnknown(value: string | null) {
  return value && value.trim().length > 0 ? (
    value
  ) : (
    <span className="text-ink-subtle">{TEXTS.unknown}</span>
  );
}

export function ContactIdentityCard({ contact }: { contact: ContactDetail }) {
  return (
    <Card title={TEXTS.identityTitle}>
      <DataList
        items={[
          { label: TEXTS.email, value: orUnknown(contact.email) },
          { label: TEXTS.phone, value: orUnknown(contact.phone) },
          { label: TEXTS.source, value: CONTACT_SOURCE_LABELS[contact.source] },
          { label: TEXTS.createdAt, value: formatDate(contact.createdAt) },
          { label: TEXTS.motivation, value: orUnknown(contact.saleMotivation) },
          { label: TEXTS.timeline, value: orUnknown(contact.saleTimeline) },
        ]}
      />

      {contact.notes ? (
        <div className="mt-6 rounded-lg border border-line bg-surface-muted p-4">
          <p className="text-overline font-semibold text-ink-subtle uppercase">{TEXTS.notes}</p>
          <p className="mt-2 text-sm whitespace-pre-line text-ink">{contact.notes}</p>
          <p className="mt-3 text-xs text-ink-subtle">{TEXTS.notesUntrusted}</p>
        </div>
      ) : null}
    </Card>
  );
}
