import Link from "next/link";

import { APP_TEXTS } from "@/components/texts";
import { Badge } from "@/components/ui/Badge";
import { propertySummary } from "@/features/contacts/components/ContactsTable";
import type { ContactListItem } from "@/features/contacts/types";

const TEXTS = APP_TEXTS.contacts;

/**
 * One contact, inside a pipeline column.
 *
 * Read-only: the whole card is a link to the contact file, never an action
 * that writes a stage. Only fields already present on `ContactListItem` are
 * shown — nothing is inferred or invented.
 */
export function PipelineContactCard({ contact }: { contact: ContactListItem }) {
  return (
    <li>
      <Link
        href={`/contacts/${contact.id}`}
        data-testid="pipeline-contact"
        className="block rounded-lg border border-line bg-surface p-3 transition-colors duration-150 ease-standard hover:bg-surface-muted focus-visible:bg-surface-muted"
      >
        <p className="truncate text-sm font-medium text-ink">{contact.displayName}</p>
        <p className="mt-1 truncate text-xs text-ink-muted">{propertySummary(contact)}</p>
        {contact.humanTakeover || contact.openTasksCount > 0 ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {contact.humanTakeover ? <Badge tone="outline">{TEXTS.humanTakeover}</Badge> : null}
            {contact.openTasksCount > 0 ? (
              <Badge tone="dashed">{TEXTS.openTasks(contact.openTasksCount)}</Badge>
            ) : null}
          </div>
        ) : null}
      </Link>
    </li>
  );
}
