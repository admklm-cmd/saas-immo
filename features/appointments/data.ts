/**
 * Appointments domain — read implementation of `/rendez-vous`.
 *
 * Takes an authenticated Supabase client (session cookies in `queries.ts`, a
 * real session in the integration tests): RLS always applies, the service_role
 * client is never used here. The agency is re-resolved server-side from the
 * session. Nothing throws: every failure is `{ data: null, error }` with a
 * French message.
 */

import { requireExactCount } from "@/features/agents-ia/activity";
import { APPOINTMENT_CONFIRMABLE_STAGES } from "@/features/agents-ia/data";
import { NO_NAME_LABEL } from "@/features/contacts/data";
import { resolveAgentContext } from "@/lib/agents/context";
import { failFromDatabase, failFromUnexpected } from "@/lib/agents/errors";
import { AGENCY_TIME_ZONE } from "@/lib/agents/time";
import type { Enums, TypedClient } from "@/lib/agents/types";
import { buildPage, isRangeNotSatisfiable } from "@/lib/utils/pagination";
import { fail, ok, type Result } from "@/lib/utils/result";

import {
  APPOINTMENT_LIST_ERROR_MESSAGES,
  UPCOMING_APPOINTMENT_STATUSES,
  appointmentsInputSchema,
  type AppointmentListItem,
  type AppointmentsInput,
  type AppointmentsPage,
} from "./types";

const APPOINTMENT_LIST_COLUMNS =
  "id, contact_id, status, starts_at, ends_at, is_simulation, contacts!appointments_contact_fkey(first_name, last_name, stage)";

/** PostgREST spells UTC as "+00:00"; the UI gets one stable format. */
function isoUtc(value: string): string {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? value : new Date(parsed).toISOString();
}

type AppointmentRow = {
  id: string;
  contact_id: string;
  status: Enums["appointment_status"];
  starts_at: string;
  ends_at: string;
  is_simulation: boolean;
  contacts: { first_name: string | null; last_name: string | null; stage: Enums["pipeline_stage"] } | null;
};

/**
 * Same rule as `listAppointmentsToFollowThrough` (`features/agents-ia/data.ts`)
 * and the database guard of `proposed -> confirmed`.
 */
export function canAppointmentBeConfirmed(
  status: Enums["appointment_status"],
  contactStage: Enums["pipeline_stage"] | null | undefined,
): boolean {
  return (
    status === "proposed" &&
    contactStage !== null &&
    contactStage !== undefined &&
    (APPOINTMENT_CONFIRMABLE_STAGES as readonly string[]).includes(contactStage)
  );
}

export function toAppointmentListItem(row: AppointmentRow): AppointmentListItem {
  const name = [row.contacts?.first_name, row.contacts?.last_name]
    .map((part) => (part ?? "").trim())
    .filter((part) => part.length > 0)
    .join(" ");
  return {
    id: row.id,
    contactId: row.contact_id,
    contactName: name.length > 0 ? name : NO_NAME_LABEL,
    status: row.status,
    startsAt: isoUtc(row.starts_at),
    endsAt: isoUtc(row.ends_at),
    isSimulation: row.is_simulation,
    canBeConfirmed: canAppointmentBeConfirmed(row.status, row.contacts?.stage),
    canBeCompleted: row.status === "confirmed",
  };
}

/**
 * The estimation appointments of the caller's agency, one page at a time, with
 * the EXACT total of the view.
 *
 *   * `upcoming`: `proposed` / `confirmed` AND `starts_at >= now` — exactly the
 *     dashboard's `upcomingAppointments`; soonest first.
 *   * `past`: `starts_at < now`, every status; most recent first.
 *
 * The two views partition the `proposed` / `confirmed` appointments at `now`;
 * `cancelled` and `done` ones only appear in `past` once their start is past.
 *
 * `now` is injectable for the tests; the server always uses the real instant.
 */
export async function listAppointments(
  client: TypedClient,
  input: AppointmentsInput = {},
  now: Date = new Date(),
): Promise<Result<AppointmentsPage>> {
  try {
    const parsed = appointmentsInputSchema.safeParse(input ?? {});
    if (!parsed.success) {
      return fail<AppointmentsPage>(
        "invalid_appointment_filter",
        APPOINTMENT_LIST_ERROR_MESSAGES.invalid_appointment_filter,
      );
    }
    const query = parsed.data;

    const contextResult = await resolveAgentContext(client);
    if (contextResult.error) return { data: null, error: contextResult.error };
    const { agencyId } = contextResult.data;
    const nowIso = now.toISOString();
    const upcoming = query.view === "upcoming";

    // Built twice (page, then head count on an out-of-range page): same filter.
    const filtered = (columns: string, options: { count: "exact"; head?: boolean }) => {
      const base = client.from("appointments").select(columns, options).eq("agency_id", agencyId);
      return upcoming
        ? base.in("status", UPCOMING_APPOINTMENT_STATUSES).gte("starts_at", nowIso)
        : base.lt("starts_at", nowIso);
    };

    const response = await filtered(APPOINTMENT_LIST_COLUMNS, { count: "exact" })
      .order("starts_at", { ascending: upcoming })
      .order("id", { ascending: upcoming })
      .range(query.offset, query.offset + query.limit - 1);

    let rows: AppointmentRow[];
    let totalResponse: { count: number | null; error: typeof response.error };
    if (response.error && isRangeNotSatisfiable(response.error)) {
      // Page past the end: empty page, but the total stays exact.
      rows = [];
      const head = await filtered("id", { count: "exact", head: true });
      totalResponse = { count: head.count, error: head.error };
    } else if (response.error) {
      return failFromDatabase<AppointmentsPage>("listAppointments", response.error);
    } else {
      rows = (response.data ?? []) as unknown as AppointmentRow[];
      totalResponse = { count: response.count, error: null };
    }

    const total = requireExactCount("listAppointments.count", totalResponse);
    if (total.error) return { data: null, error: total.error };

    return ok({
      ...buildPage(rows.map(toAppointmentListItem), total.data, query, nowIso),
      view: query.view,
      timeZone: AGENCY_TIME_ZONE as "Europe/Paris",
    });
  } catch (cause) {
    return failFromUnexpected<AppointmentsPage>("listAppointments", cause);
  }
}
