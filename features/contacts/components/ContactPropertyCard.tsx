import { formatSurface } from "@/components/format";
import { APP_TEXTS, PROPERTY_TYPE_LABELS } from "@/components/texts";
import { Card } from "@/components/ui/Card";
import { DataList } from "@/components/ui/DataList";
import type { ContactProperty } from "@/features/contacts/types";

const TEXTS = APP_TEXTS.contact;

function orUnknown(value: string | null) {
  return value && value.trim().length > 0 ? (
    value
  ) : (
    <span className="text-ink-subtle">{TEXTS.unknown}</span>
  );
}

export function ContactPropertyCard({ property }: { property: ContactProperty | null }) {
  return (
    <Card title={TEXTS.propertyTitle}>
      {property ? (
        <DataList
          items={[
            {
              label: TEXTS.propertyType,
              value: property.property_type ? PROPERTY_TYPE_LABELS[property.property_type] : orUnknown(null),
            },
            { label: TEXTS.propertyAddress, value: orUnknown(property.address) },
            { label: TEXTS.propertyCity, value: orUnknown(property.city) },
            { label: TEXTS.propertySector, value: orUnknown(property.sector) },
            { label: TEXTS.propertySurface, value: orUnknown(formatSurface(property.surface_m2)) },
            {
              label: TEXTS.propertyRooms,
              value: orUnknown(property.rooms === null ? null : String(property.rooms)),
            },
          ]}
        />
      ) : (
        <p className="text-sm text-ink-subtle">{TEXTS.propertyEmpty}</p>
      )}
    </Card>
  );
}
