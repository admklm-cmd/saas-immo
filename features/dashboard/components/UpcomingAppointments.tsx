import { APP_TEXTS } from "@/components/texts";

import type { DashboardUpcomingAppointments } from "../types";
import { ActionListCard } from "./ActionListCard";
import { AppointmentItem } from "./AppointmentItem";

const TEXTS = APP_TEXTS.dashboard;

/**
 * « Prochains rendez-vous » — exact total to come, and the next five. The link
 * leads to `/rendez-vous` (view « À venir »), which counts the same rows.
 */
export function UpcomingAppointments({ list }: { list: DashboardUpcomingAppointments }) {
  return (
    <ActionListCard
      id="upcoming"
      headingLevel={2}
      title={TEXTS.upcomingTitle}
      hint={TEXTS.upcomingSubtitle}
      list={list}
      unit={TEXTS.upcomingUnit}
      emptyText={TEXTS.upcomingEmpty}
      getKey={(item) => item.id}
      renderItem={(item) => <AppointmentItem item={item} />}
      link={{ href: "/rendez-vous", label: TEXTS.upcomingLink }}
    />
  );
}
