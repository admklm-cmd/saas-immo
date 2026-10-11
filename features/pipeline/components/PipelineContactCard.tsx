import Link from "next/link";

import { APP_TEXTS } from "@/components/texts";
import { cn } from "@/components/ui/cn";
import { ContactStateMarks } from "@/features/contacts/components/ContactStateMarks";
import { propertyParts } from "@/features/contacts/components/property-summary";
import type { ContactListItem } from "@/features/contacts/types";

import styles from "./PipelineBoard.module.css";
import { PipelineStageMenu } from "./PipelineStageMenu";

const TEXTS = APP_TEXTS.contacts;

export type PipelineContactCardProps = {
  contact: ContactListItem;
  /** Display only: the database decides who may leave « Mandat signé ». */
  canExitSignedMandate: boolean;
};

/**
 * One dossier, inside a pipeline column.
 *
 * Two distinct targets, never nested: the card body is a link to the contact
 * file; « Changer d'étape » is a small control in its top-right corner — always
 * visible, named for screen readers, its words shown on hover and keyboard
 * focus — whose list of stages unfolds INSIDE the card (never clipped by the
 * horizontal scroller). Only fields already on `ContactListItem` are shown,
 * and only the id, name and stage reach the browser-side menu.
 */
export function PipelineContactCard({ contact, canExitSignedMandate }: PipelineContactCardProps) {
  const property = propertyParts(contact);

  return (
    <li
      data-testid="pipeline-contact"
      className={cn(
        styles.card,
        "relative rounded-xl border border-line bg-surface shadow-subtle",
        "has-[a:hover]:border-line-strong has-[a:hover]:shadow-raised",
      )}
    >
      <Link href={`/contacts/${contact.id}`} className="block rounded-xl py-3 pr-11 pl-3.5">
        <p className="truncate text-sm font-medium text-ink">{contact.displayName}</p>
        {property ? (
          <>
            {property.what ? (
              <p className="mt-1 truncate text-xs text-ink-muted" title={property.what}>
                {property.what}
              </p>
            ) : null}
            {property.where ? (
              <p className="mt-0.5 truncate text-xs text-ink-subtle" title={property.where}>
                {property.where}
              </p>
            ) : null}
          </>
        ) : (
          <p className="mt-1 text-xs text-ink-subtle">{TEXTS.noProperty}</p>
        )}
        <ContactStateMarks contact={contact} className="mt-2.5" />
      </Link>

      <PipelineStageMenu
        contactId={contact.id}
        contactName={contact.displayName}
        stage={contact.stage}
        canExitSignedMandate={canExitSignedMandate}
      />
    </li>
  );
}
