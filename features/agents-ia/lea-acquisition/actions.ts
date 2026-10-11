"use server";

/**
 * Server actions of Léa — acquisition.
 *
 * The action only builds the request-scoped Supabase client (session cookies,
 * RLS applies) and delegates to `runLeaAcquisition`, which re-checks the
 * session, the agency and every guard rail server-side.
 *
 * An AI agent is never called from a client component: this is the only entry
 * point exposed to the UI.
 */

import { failWith } from "@/lib/agents/errors";
import { parseUuid } from "@/lib/agents/input";
import { createClient } from "@/lib/supabase/server";
import type { Result } from "@/lib/utils/result";

import { runLeaAcquisition, type LeaRunResult } from "./lea";

export async function processInboundLead(leadId: string): Promise<Result<LeaRunResult>> {
  // A server action is a public endpoint: the argument is validated at runtime,
  // whatever its declared type. Same generic answer as "unknown lead".
  const id = parseUuid(leadId);
  if (id === null) return failWith<LeaRunResult>("lead_not_found");

  const client = await createClient();
  return runLeaAcquisition(client, id);
}
