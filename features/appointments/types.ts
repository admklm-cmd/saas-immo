/**
 * Appointments domain — types and input schema of the « Rendez-vous
 * d'estimation » screen (`/rendez-vous`).
 *
 * The list carries no free text (no report, no notes): the report written after
 * the visit stays on `/agents-ia/suivi-rendez-vous` and on the contact file.
 */

import { z } from "zod";

import type { Enums } from "@/lib/agents/types";
import { paginationShape, type Page } from "@/lib/utils/pagination";

// -----------------------------------------------------------------------------
// Shared definition — the SAME as the dashboard's `upcomingAppointments`
// -----------------------------------------------------------------------------

/**
 * Statuses of an appointment that is still ahead (not cancelled, not done).
 * « À venir » = one of these statuses AND `starts_at >= instant of the read`.
 * Used by `buildDashboardSummary` and by `listAppointments({ view: "upcoming" })`,
 * so the dashboard figure equals the total of the list.
 */
export const UPCOMING_APPOINTMENT_STATUSES = ["proposed", "confirmed"] as const satisfies readonly Enums[
  "appointment_status"
][];

// -----------------------------------------------------------------------------
// Input
// -----------------------------------------------------------------------------

/**
 *   * `upcoming` — `proposed` or `confirmed`, starting at or after now; soonest first.
 *   * `past`     — starting before now, WHATEVER the status (including a
 *     `proposed` / `confirmed` never closed); most recent first.
 */
export const APPOINTMENT_VIEWS = ["upcoming", "past"] as const;
export type AppointmentView = (typeof APPOINTMENT_VIEWS)[number];

export const appointmentsInputSchema = z
  .object({
    view: z.enum(APPOINTMENT_VIEWS).default("upcoming"),
    ...paginationShape,
  })
  .strict();

export type AppointmentsInput = z.input<typeof appointmentsInputSchema>;
export type AppointmentsQuery = z.output<typeof appointmentsInputSchema>;

// -----------------------------------------------------------------------------
// Output
// -----------------------------------------------------------------------------

/**
 * One estimation appointment. Links: `/contacts/{contactId}`, and
 * `/agents-ia/suivi-rendez-vous` when `canBeConfirmed` or `canBeCompleted`.
 */
export type AppointmentListItem = {
  id: string;
  contactId: string;
  /** "Prénom Nom", or "Contact sans nom". */
  contactName: string;
  status: Enums["appointment_status"];
  /** ISO-8601 UTC. */
  startsAt: string;
  /** ISO-8601 UTC. */
  endsAt: string;
  /** Always true in the prototype: no real calendar is connected. */
  isSimulation: boolean;
  /**
   * Same condition as `confirmAppointment` / the dashboard « à confirmer »:
   * `proposed` and the contact is at `qualifie`, `chaud` or `rdv_planifie`.
   */
  canBeConfirmed: boolean;
  /** Same condition as `completeAppointment` / the dashboard « à clôturer »: `confirmed`. */
  canBeCompleted: boolean;
};

export type AppointmentsPage = Page<AppointmentListItem> & {
  view: AppointmentView;
  /** Legal time zone of the agency: display every date in it. */
  timeZone: "Europe/Paris";
};

// -----------------------------------------------------------------------------
// User-facing messages (French)
// -----------------------------------------------------------------------------

export const APPOINTMENT_LIST_ERROR_MESSAGES = {
  invalid_appointment_filter: "Filtre ou pagination invalide pour la liste des rendez-vous.",
} as const;
