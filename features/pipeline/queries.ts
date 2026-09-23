import "server-only";

/**
 * Pipeline domain — reads exposed to the UI (Server Components).
 *
 * Request-scoped Supabase client (session cookies, RLS applies). Returns
 * `{ data, error }`: no exception ever reaches the UI.
 */

import { createClient } from "@/lib/supabase/server";
import type { Result } from "@/lib/utils/result";

import { resolvePipelineViewer } from "./stage-change";
import type { PipelineViewer } from "./types";

/**
 * Role of the signed-in user in their agency, so the pipeline can explain why
 * leaving « Mandat signé » is reserved to a director. Display only: the
 * database refuses the action anyway.
 */
export async function getPipelineViewer(): Promise<Result<PipelineViewer>> {
  const client = await createClient();
  return resolvePipelineViewer(client);
}
