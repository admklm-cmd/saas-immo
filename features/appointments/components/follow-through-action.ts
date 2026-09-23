import type { AppointmentListItem } from "../types";

/**
 * What the link to `/agents-ia/suivi-rendez-vous` offers for one appointment.
 *
 *  * `confirm` — a proposal a human can confirm (`canBeConfirmed`);
 *  * `close`   — a confirmed appointment whose start time has passed: the
 *                report can be written;
 *  * `open`    — a confirmed appointment still to come: nothing to close yet,
 *                the follow-through screen is only opened;
 *  * `null`    — no human action is possible: no link at all.
 *
 * `now` is passed in (ms since epoch) so the render stays pure and testable.
 */
export type FollowThroughAction = "confirm" | "close" | "open";

export function followThroughAction(
  appointment: Pick<AppointmentListItem, "canBeConfirmed" | "canBeCompleted" | "startsAt">,
  now: number,
): FollowThroughAction | null {
  if (appointment.canBeConfirmed) return "confirm";
  if (!appointment.canBeCompleted) return null;
  const start = Date.parse(appointment.startsAt);
  // An unreadable date never unlocks « Clôturer »: the safer label is « Ouvrir ».
  return !Number.isNaN(start) && start <= now ? "close" : "open";
}
