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
