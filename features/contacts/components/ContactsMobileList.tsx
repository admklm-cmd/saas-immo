import Link from "next/link";

import { formatDate } from "@/components/format";
import { APP_TEXTS } from "@/components/texts";
import { cn } from "@/components/ui/cn";
import { PipelineStageBadge } from "@/components/ui/PipelineStageBadge";
import { CONTACT_SOURCE_LABELS, type ContactListItem } from "@/features/contacts/types";

import { ContactStateMarks } from "./ContactStateMarks";
import { propertyParts } from "./property-summary";

const TEXTS = APP_TEXTS.contacts;

/**
 * The contact list on a phone: one card per contact, the whole card leading
 * to the file. Same information and order as a table row — name and states,
 * stage, property, contact details, source and last update — laid out to be
 * read, not shrunk.
 */
export function ContactsMobileList({
  contacts,
  className,
}: {
  contacts: readonly ContactListItem[];
  className?: string;
}) {
  return (
    <ul aria-label={TEXTS.listLabel} className={cn("flex flex-col gap-2.5", className)}>
      {contacts.map((contact) => {
        const parts = propertyParts(contact);
        return (
          <li
            key={contact.id}
            data-testid="contact-list-item"
            className="relative rounded-2xl border border-line bg-surface px-4 py-3.5 shadow-subtle transition-colors duration-150 ease-standard has-[a:active]:bg-surface-muted"
          >
            <div className="flex items-start justify-between gap-3">
              <Link
                href={`/contacts/${contact.id}`}
                className="ui-focus min-w-0 rounded-xs font-medium text-ink after:absolute after:inset-0 after:rounded-2xl after:content-['']"
              >
                {contact.displayName}
              </Link>
              <span className="sr-only"> — {TEXTS.openContact}</span>
              <span className="shrink-0 pt-0.5 text-xs whitespace-nowrap text-ink-subtle tabular-nums">
                {formatDate(contact.updatedAt)}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
              <PipelineStageBadge stage={contact.stage} />
              <ContactStateMarks contact={contact} variant="labelled" />
            </div>

            <p className="mt-2.5 text-sm text-ink-muted">
              {parts ? (
                <>
                  {parts.what ? <span className="whitespace-nowrap">{parts.what}</span> : null}
                  {parts.what && parts.where ? " · " : null}
                  {parts.where ? <span className="whitespace-nowrap text-ink-subtle">{parts.where}</span> : null}
                </>
              ) : (
                <span className="text-ink-subtle">{TEXTS.noProperty}</span>
              )}
            </p>

            <p className="mt-1 truncate text-xs text-ink-subtle">
              {contact.email ?? TEXTS.noEmail}
              {" · "}
              <span className="whitespace-nowrap">{contact.phone ?? TEXTS.noPhone}</span>
            </p>
            <p className="mt-0.5 text-xs text-ink-subtle">{CONTACT_SOURCE_LABELS[contact.source]}</p>
          </li>
        );
      })}
    </ul>
  );
}
