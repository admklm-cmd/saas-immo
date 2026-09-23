import "server-only";

/**
 * Tasks domain — reads exposed to the UI (Server Component of `/taches`).
 *
 * Request-scoped Supabase client (session cookies, RLS applies — never the
 * service-role client). The session and the agency are re-resolved server-side
 * in `data.ts`. Returns `{ data, error }`: no exception reaches the UI.
 */

import { createClient } from "@/lib/supabase/server";
import type { Result } from "@/lib/utils/result";

import { listOpenTasks } from "./data";
import type { OpenTasksInput, OpenTasksPage } from "./types";

/**
 * One page of the agency's open tasks.
 *
 * `input` is validated with zod (scope `all` | `overdue` | `mine`, `limit`
 * 1..100, `offset` 0..5000): it may come straight from the URL search params.
 * `total` is exact; with scope `all` it equals the dashboard's `openTasks`.
 */
export async function getOpenTasks(input: OpenTasksInput = {}): Promise<Result<OpenTasksPage>> {
  const client = await createClient();
  return listOpenTasks(client, input);
}
