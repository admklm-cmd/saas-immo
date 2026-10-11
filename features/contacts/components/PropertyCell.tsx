import { APP_TEXTS } from "@/components/texts";
import type { ContactListItem } from "@/features/contacts/types";

import { propertyParts } from "./property-summary";

const TEXTS = APP_TEXTS.contacts;

/** Separator between a town and its sector (« Cassis — Hauteurs »). */
const PLACE_SEPARATOR = " — ";
/** Same separator, glued to the previous word: a line never starts with « — ». */
const JOINED_SEPARATOR = `${String.fromCharCode(0xa0)}— `;

/**
 * The property of a contact on two lines — what it is (« Maison · 142 m² »),
 * then where (« Saint-Cyr-sur-Mer — Les Lecques »). Each piece keeps its words
 * together: a surface never loses its unit, a hyphenated town never splits.
 * In a narrow column the place may only wrap after its « — », never inside a
 * name.
 */
export function PropertyCell({ contact }: { contact: ContactListItem }) {
  const parts = propertyParts(contact);
  if (!parts) return <span className="text-ink-subtle">{TEXTS.noProperty}</span>;

  const places = parts.where?.split(PLACE_SEPARATOR) ?? [];

  return (
    <>
      {parts.what ? <div className="whitespace-nowrap text-ink-muted">{parts.what}</div> : null}
      {places.length > 0 ? (
        <div className="mt-0.5 text-ink-subtle">
          {places.map((place, index) => (
            <span key={index}>
              {index > 0 ? JOINED_SEPARATOR : null}
              <span className="whitespace-nowrap">{place}</span>
            </span>
          ))}
        </div>
      ) : null}
    </>
  );
}
