import { formatSurface } from "@/components/format";
import { PROPERTY_TYPE_LABELS } from "@/components/texts";
import type { ContactListItem } from "@/features/contacts/types";

/** No-break space: « 110 m² » never splits between the figure and its unit. */
const NBSP = String.fromCharCode(0xa0);

/**
 * The main property of a contact, split in the pieces a list shows on two
 * lines: what it is (type · surface) and where it is (sector, else city).
 * Only fields already on `ContactListItem`; nothing is guessed. `null` when
 * no property is attached or none of its fields is filled.
 */
export type PropertyParts = {
  /** « Maison · 142 m² », or one of the two, or null. */
  what: string | null;
  /** Sector when known (« Cassis — Hauteurs »), else the city, or null. */
  where: string | null;
};

export function propertyParts(contact: ContactListItem): PropertyParts | null {
  const property = contact.property;
  if (!property) return null;

  const type = property.property_type ? PROPERTY_TYPE_LABELS[property.property_type] : null;
  const surface = formatSurface(property.surface_m2)?.replace(" ", NBSP) ?? null;
  const what = [type, surface].filter((part): part is string => Boolean(part)).join(" · ") || null;
  const where = property.sector?.trim() || property.city?.trim() || null;

  return what || where ? { what, where } : null;
}
