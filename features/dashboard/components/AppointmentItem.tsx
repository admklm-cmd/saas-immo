import { formatSlot } from "@/components/format";
import { APP_TEXTS } from "@/components/texts";
import { Badge } from "@/components/ui/Badge";
import { SimulationBadge } from "@/components/ui/SimulationBadge";
import { APPOINTMENT_STATUS_LABELS } from "@/features/contacts/types";

import type { DashboardAppointmentItem } from "../types";
import { ContactLink } from "./ContactLink";

const TEXTS = APP_TEXTS.dashboard;

/** An estimation appointment: slot in Europe/Paris time, contact, status. */
export function AppointmentItem({ item }: { item: DashboardAppointmentItem }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink first-letter:uppercase">
          <time dateTime={item.startsAt}>{formatSlot(item.startsAt, item.endsAt)}</time>
        </p>
        <p className="mt-1 text-sm">
          <ContactLink contactId={item.contactId} contactName={item.contactName} />
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        <Badge tone={item.status === "confirmed" ? "solid" : "outline"}>
          <span className="sr-only">{TEXTS.appointmentStatusPrefix} </span>
          {APPOINTMENT_STATUS_LABELS[item.status]}
        </Badge>
        {item.isSimulation ? <SimulationBadge /> : null}
      </div>
    </div>
  );
}
