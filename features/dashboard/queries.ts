import "server-only";

/**
 * Dashboard domain — read exposed to the UI (Server Component of `/dashboard`).
 *
 * Builds the request-scoped Supabase client (session cookies, RLS applies) and
 * delegates to `data.ts`. The session and the `agency_id` are re-resolved
 * server-side, never read from the browser.
 */

import { createClient } from "@/lib/supabase/server";
import type { Result } from "@/lib/utils/result";

import { buildDashboardDailySeries, buildDashboardSummary } from "./data";
import { buildDashboardPilotage } from "./pilotage";
import type { PilotagePeriodKey } from "./pilotage-periods";
import type { DashboardPilotage } from "./pilotage-types";
import type { DashboardDailySeries, DashboardSummary } from "./types";

/**
 * The `/dashboard` overview of the caller's agency.
 *
 * * `{ data: null, error }` only when the session or the agency is invalid.
 * * Otherwise `data` is always returned, and EACH indicator is either
 *   `{ status: "ok", scope, value }` (an exact count; `0` is a measured zero) or
 *   `{ status: "unavailable", scope }` — display « Indisponible », never `0`.
 *   One unavailable indicator never hides the others.
 * * Every indicator carries its `scope`: display it next to the figure.
 * * Action lists carry an exact `total` and a SAMPLE of at most 5 `items` with
 *   the ids needed for the links.
 */
export async function getDashboardSummary(): Promise<Result<DashboardSummary>> {
  const client = await createClient();
  return buildDashboardSummary(client);
}

/**
 * The 30-day series of the area chart: per Paris calendar day, the seller
 * requests received and the dossiers qualified (see `DashboardDailyPoint` for
 * the exact definitions).
 *
 * * `{ data: null, error }` only when the session or the agency is invalid.
 * * Otherwise `data.status` is `"ok"` (30 points, a day without activity is a
 *   real `0`) or `"unavailable"` (display « Indisponible », never zeros).
 */
export async function getDashboardDailySeries(): Promise<Result<DashboardDailySeries>> {
  const client = await createClient();
  return buildDashboardDailySeries(client);
}

/**
 * The boss's statistics page for one period: `"7d"`, `"30d"`, `"90d"` (3 mois) or
 * `"365d"` (1 an), each compared with the previous period of the same length.
 *
 * * `{ data: null, error }` when the period is not one of the four, or the
 *   session / agency is invalid.
 * * Otherwise `data` is always returned and EACH block is either
 *   `{ status: "ok", value }` or `{ status: "unavailable" }` (display
 *   « Indisponible », never a zero). A `null` inside a value means « not
 *   measurable » (display « — » with its explanation).
 * * See `pilotage-types.ts` for the exact rule of every figure.
 */
export async function getDashboardPilotage(period: PilotagePeriodKey): Promise<Result<DashboardPilotage>> {
  const client = await createClient();
  return buildDashboardPilotage(client, period);
}
