import type { AppointmentView } from "../types";

/** URL of the `/rendez-vous` list for a view and a page. Defaults are omitted. */
export function appointmentsHref(view: AppointmentView, offset = 0): string {
  const params = new URLSearchParams();
  if (view !== "upcoming") params.set("view", view);
  if (offset > 0) params.set("offset", String(offset));
  const query = params.toString();
  return query ? `/rendez-vous?${query}` : "/rendez-vous";
}
