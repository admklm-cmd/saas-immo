import Link from "next/link";

import { formatDate } from "@/components/format";
import { APP_TEXTS, PROPERTY_TYPE_LABELS } from "@/components/texts";
import { Badge } from "@/components/ui/Badge";
import { PipelineStageBadge } from "@/components/ui/PipelineStageBadge";
import { CONTACT_SOURCE_LABELS, type ContactListItem } from "@/features/contacts/types";

const TEXTS = APP_TEXTS.contacts;

/** Reused by the pipeline board, so both screens describe a property the same way. */
export function propertySummary(contact: ContactListItem): string {
  const property = contact.property;
  if (!property) return TEXTS.noProperty;
  const parts = [
    property.property_type ? PROPERTY_TYPE_LABELS[property.property_type] : null,
    property.city,
    property.surface_m2 === null ? null : `${property.surface_m2} m²`,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" · ") : TEXTS.noProperty;
}

/** Desktop-first table of the agency's contacts. Each row links to the file. */
export function ContactsTable({ contacts }: { contacts: readonly ContactListItem[] }) {
  return (
    <div className="animate-rise overflow-hidden rounded-xl border border-line bg-surface shadow-subtle">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
          <caption className="sr-only">{TEXTS.subtitle}</caption>
          <thead>
            <tr className="border-b border-line bg-surface-muted">
              <th scope="col" className="px-5 py-3 text-overline font-semibold text-ink-subtle uppercase">
                {TEXTS.columnName}
              </th>
              <th scope="col" className="px-5 py-3 text-overline font-semibold text-ink-subtle uppercase">
                {TEXTS.columnStage}
              </th>
              <th scope="col" className="px-5 py-3 text-overline font-semibold text-ink-subtle uppercase">
                {TEXTS.columnContactDetails}
              </th>
              <th scope="col" className="px-5 py-3 text-overline font-semibold text-ink-subtle uppercase">
                {TEXTS.columnProperty}
              </th>
              <th scope="col" className="px-5 py-3 text-overline font-semibold text-ink-subtle uppercase">
                {TEXTS.columnSource}
              </th>
              <th scope="col" className="px-5 py-3 text-overline font-semibold text-ink-subtle uppercase">
                {TEXTS.columnUpdated}
              </th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((contact) => (
              <tr
                key={contact.id}
                className="border-b border-line transition-colors duration-150 ease-standard last:border-b-0 hover:bg-surface-muted"
              >
                <th scope="row" className="px-5 py-4 font-normal">
                  <Link
                    href={`/contacts/${contact.id}`}
                    className="rounded-xs font-medium text-ink hover:underline"
                  >
                    {contact.displayName}
                  </Link>
                  <span className="sr-only"> — {TEXTS.openContact}</span>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {contact.humanTakeover ? <Badge tone="outline">{TEXTS.humanTakeover}</Badge> : null}
                    {contact.openTasksCount > 0 ? (
                      <Badge tone="dashed">{TEXTS.openTasks(contact.openTasksCount)}</Badge>
                    ) : null}
                  </div>
                </th>
                <td className="px-5 py-4 align-top">
                  <PipelineStageBadge stage={contact.stage} />
                </td>
                <td className="px-5 py-4 align-top text-ink-muted">
                  <div className="break-words">{contact.email ?? TEXTS.noEmail}</div>
                  <div className="mt-1 whitespace-nowrap">{contact.phone ?? TEXTS.noPhone}</div>
                </td>
                <td className="px-5 py-4 align-top text-ink-muted">{propertySummary(contact)}</td>
                <td className="px-5 py-4 align-top text-ink-muted">
                  {CONTACT_SOURCE_LABELS[contact.source]}
                </td>
                <td className="px-5 py-4 align-top whitespace-nowrap text-ink-muted">
                  {formatDate(contact.updatedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
