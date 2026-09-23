import Link from "next/link";

import { APP_TEXTS } from "@/components/texts";
import { Badge } from "@/components/ui/Badge";
import { propertySummary } from "@/features/contacts/components/ContactsTable";
import type { ContactListItem } from "@/features/contacts/types";

import { PipelineStageMenu } from "./PipelineStageMenu";

const TEXTS = APP_TEXTS.contacts;

export type PipelineContactCardProps = {
  contact: ContactListItem;
  /** Display only: the database decides who may leave « Mandat signé ». */
  canExitSignedMandate: boolean;
};

/**
 * One contact, inside a pipeline column.
 *
 * Two distinct targets, never nested: the upper block is a link to the
 * contact file, the footer holds « Changer d'étape » (the only client island
 * of the board). Only fields already present on `ContactListItem` are shown —
 * and only the id, name and stage reach the browser-side menu.
 */
export function PipelineContactCard({ contact, canExitSignedMandate }: PipelineContactCardProps) {
  return (
    <li
      data-testid="pipeline-contact"
      className="relative rounded-lg border border-line bg-surface transition-colors duration-150 ease-standard has-[a:hover]:bg-surface-muted"
    >
      <Link href={`/contacts/${contact.id}`} className="block rounded-lg px-3 pt-3 pb-1.5">
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

      <div className="px-1.5 pb-1.5">
        <PipelineStageMenu
          contactId={contact.id}
          contactName={contact.displayName}
          stage={contact.stage}
          canExitSignedMandate={canExitSignedMandate}
        />
      </div>
    </li>
  );
}
