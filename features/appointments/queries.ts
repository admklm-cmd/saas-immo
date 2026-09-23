import "server-only";

/**
 * Appointments domain — reads exposed to the UI (Server Component of
 * `/rendez-vous`).
 *
 * Request-scoped Supabase client (session cookies, RLS applies — never the
 * service-role client). The session and the agency are re-resolved server-side
 * in `data.ts`. Returns `{ data, error }`: no exception reaches the UI.
 */

import { createClient } from "@/lib/supabase/server";
import type { Result } from "@/lib/utils/result";

import { listAppointments } from "./data";
import type { AppointmentsInput, AppointmentsPage } from "./types";

/**
 * One page of the agency's estimation appointments.
 *
 * `input` is validated with zod (`view` `upcoming` | `past`, `limit` 1..100,
 * `offset` 0..5000): it may come straight from the URL search params.
 * `total` is exact; for `upcoming` it equals the dashboard's
 * `upcomingAppointments` total.
 */
export async function getAppointments(input: AppointmentsInput = {}): Promise<Result<AppointmentsPage>> {
  const client = await createClient();
  return listAppointments(client, input);
}
