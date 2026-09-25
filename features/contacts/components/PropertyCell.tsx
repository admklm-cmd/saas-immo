import { APP_TEXTS } from "@/components/texts";
import type { ContactListItem } from "@/features/contacts/types";

import { propertyParts } from "./property-summary";

const TEXTS = APP_TEXTS.contacts;

/**
 * The property of a contact on two lines — what it is (« Maison · 142 m² »),
 * then where (« Saint-Cyr-sur-Mer — Les Lecques »). Each line keeps its words
 * together: a surface never loses its unit, a hyphenated town never splits.
 */
export function PropertyCell({ contact }: { contact: ContactListItem }) {
  const parts = propertyParts(contact);
  if (!parts) return <span className="text-ink-subtle">{TEXTS.noProperty}</span>;

  return (
    <>
      {parts.what ? <div className="whitespace-nowrap text-ink-muted">{parts.what}</div> : null}
      {parts.where ? <div className="mt-0.5 whitespace-nowrap text-ink-subtle">{parts.where}</div> : null}
    </>
  );
}
