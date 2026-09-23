import "server-only";

/**
 * Settings domain — read exposed to the UI (Server Component of `/parametres`).
 *
 * Builds the request-scoped Supabase client (session cookies, RLS applies) and
 * delegates to `data.ts`. The session and the `agency_id` are re-resolved
 * server-side, never read from the browser. Never uses the service_role client.
 */

import { createClient } from "@/lib/supabase/server";
import type { Result } from "@/lib/utils/result";

import { buildAgencySettings } from "./data";
import type { AgencySettings } from "./types";

/**
 * The read-only settings of the caller's agency.
 *
 * * `{ data: null, error }` only when the session or the agency is invalid.
 * * Otherwise `data` is always returned, and each section (`agency`,
 *   `members`, `agents.killSwitch`, `agents.dailyRunLimit`) is either
 *   `{ status: "ok", value }` or `{ status: "unavailable" }` — display
 *   « Indisponible » for that section only.
 * * `integrations` is a static list (all `simulation`, `connected: false`) and
 *   `retention` is `{ status: "undefined" }`: display « Non définie — à valider
 *   avant mise en production ».
 * * The kill switch is changed with the EXISTING server action
 *   `setAgencyAiPaused(paused: boolean)` (`features/agents-ia/actions.ts`); nothing else on this screen writes.
 */
export async function getAgencySettings(): Promise<Result<AgencySettings>> {
  const client = await createClient();
  return buildAgencySettings(client);
}
