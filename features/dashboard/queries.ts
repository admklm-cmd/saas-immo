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

import { buildDashboardSummary } from "./data";
import type { DashboardSummary } from "./types";

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
