import "server-only";

/**
 * Pipeline domain — reads exposed to the UI (Server Components).
 *
 * Request-scoped Supabase client (session cookies, RLS applies). Returns
 * `{ data, error }`: no exception ever reaches the UI.
 */

import { createClient } from "@/lib/supabase/server";
import type { Result } from "@/lib/utils/result";

import { buildPipelineFunnel } from "./funnel";
import { resolvePipelineViewer } from "./stage-change";
import type { PipelineFunnel, PipelineViewer } from "./types";

/**
 * Role of the signed-in user in their agency, so the pipeline can explain why
 * leaving « Mandat signé » is reserved to a director. Display only: the
 * database refuses the action anyway.
 */
export async function getPipelineViewer(): Promise<Result<PipelineViewer>> {
  const client = await createClient();
  return resolvePipelineViewer(client);
}

/**
 * Conversion funnel of the caller's agency (every dossier, as of now): for each
 * stage of the journey, how many dossiers reached it at least, the rate from the
 * previous step, and the lost dossiers apart. See `PipelineFunnel` for the exact
 * rules. `{ data: null, error }` on any failure (session, agency, database):
 * display « Indisponible », never zeros.
 */
export async function getPipelineFunnel(): Promise<Result<PipelineFunnel>> {
  const client = await createClient();
  return buildPipelineFunnel(client);
}
