import type { ReportedAppointmentView } from "../types";
import { SarahAppointmentCard } from "./SarahAppointmentCard";

export function SarahFollowThroughList({ appointments }: { appointments: ReportedAppointmentView[] }) {
  return (
    <div className="stagger flex flex-col gap-6" data-testid="sarah-appointments">
      {appointments.map((appointment) => (
        <SarahAppointmentCard key={appointment.id} appointment={appointment} />
      ))}
    </div>
  );
}
