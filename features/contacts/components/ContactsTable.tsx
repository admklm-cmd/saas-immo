import Link from "next/link";

import { formatDate } from "@/components/format";
import { APP_TEXTS } from "@/components/texts";
import { PipelineStageBadge } from "@/components/ui/PipelineStageBadge";
import { Glyph } from "@/features/agents-ia/components/icons/Glyph";
import { CONTACT_SOURCE_LABELS, type ContactListItem } from "@/features/contacts/types";

import { ContactsMobileList } from "./ContactsMobileList";
import { ContactStateMarks } from "./ContactStateMarks";
import { PropertyCell } from "./PropertyCell";

const TEXTS = APP_TEXTS.contacts;

const HEAD = "px-4 py-3 text-overline font-semibold whitespace-nowrap text-ink-subtle uppercase first:pl-5 last:pr-5";
const CELL = "px-4 py-3.5 align-top first:pl-5 last:pr-5";

/**
 * The agency's contacts, most recent first.
 *
 * From 768 px: one table, one row per contact, the whole row leading to the
 * file (the name is the real link; its hit area covers the row). The real
 * states of a file are shapes next to the name (taken over by an advisor,
 * open tasks), the stage is the same badge as the pipeline and the frieze
 * (its six dots are the six nodes of the line). Units and place names never
 * break badly. Under 768 px the table becomes a list of cards
 * (`ContactsMobileList`): never a shrunken table that overflows.
 */
export function ContactsTable({ contacts }: { contacts: readonly ContactListItem[] }) {
  return (
    <div className="animate-rise">
      {/* Legend of the shapes next to the names (each shape also carries its words). */}
      <div aria-hidden="true" className="mb-3 hidden items-center justify-end gap-x-5 text-xs text-ink-subtle md:flex">
        <ContactStateMarks contact={{ humanTakeover: true, openTasksCount: 0 }} />
        <span className="inline-flex items-center gap-1.5">
          <Glyph name="tasks" width={14} />
          {TEXTS.legendOpenTasks}
        </span>
      </div>
      <div className="hidden overflow-hidden rounded-2xl border border-line bg-surface shadow-subtle md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
            <caption className="sr-only">{TEXTS.subtitle}</caption>
            <thead>
              <tr className="border-b border-line bg-surface-muted">
                <th scope="col" className={HEAD}>
                  {TEXTS.columnName}
                </th>
                <th scope="col" className={HEAD}>
                  {TEXTS.columnStage}
                </th>
                <th scope="col" className={HEAD}>
                  {TEXTS.columnProperty}
                </th>
                <th scope="col" className={HEAD}>
                  {TEXTS.columnContactDetails}
                </th>
                <th scope="col" className={HEAD}>
                  {TEXTS.columnSource}
                </th>
                <th scope="col" className={`${HEAD} text-right`}>
                  {TEXTS.columnUpdated}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {contacts.map((contact) => (
                <tr
                  key={contact.id}
                  className="group/row relative transition-colors duration-150 ease-standard hover:bg-surface-muted has-[a:focus-visible]:bg-surface-muted"
                >
                  <th scope="row" className={`${CELL} font-normal`}>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Link
                        href={`/contacts/${contact.id}`}
                        className="ui-focus rounded-xs font-medium whitespace-nowrap text-ink after:absolute after:inset-0 after:content-[''] group-hover/row:underline group-hover/row:decoration-line-strong group-hover/row:underline-offset-4"
                      >
                        {contact.displayName}
                      </Link>
                      <span className="sr-only"> — {TEXTS.openContact}</span>
                      <ContactStateMarks contact={contact} variant="compact" className="relative" />
                    </div>
                  </th>
                  <td className={CELL}>
                    <PipelineStageBadge stage={contact.stage} />
                  </td>
                  <td className={CELL}>
                    <PropertyCell contact={contact} />
                  </td>
                  <td className={`${CELL} text-ink-muted`}>
                    <div className="whitespace-nowrap">{contact.email ?? TEXTS.noEmail}</div>
                    <div className="mt-0.5 whitespace-nowrap text-ink-subtle tabular-nums">
                      {contact.phone ?? TEXTS.noPhone}
                    </div>
                  </td>
                  <td className={`${CELL} text-ink-muted`}>{CONTACT_SOURCE_LABELS[contact.source]}</td>
                  <td className={`${CELL} text-right whitespace-nowrap text-ink-muted tabular-nums`}>
                    <span className="inline-flex items-center gap-2">
                      {formatDate(contact.updatedAt)}
                      <Glyph
                        name="arrowRight"
                        width={14}
                        className="text-ink-subtle opacity-0 transition-[opacity,translate] duration-150 ease-standard group-hover/row:translate-x-0.5 group-hover/row:opacity-100"
                      />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ContactsMobileList contacts={contacts} className="md:hidden" />
    </div>
  );
}
