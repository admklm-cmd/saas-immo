"use server";

/**
 * Server actions of Emma — relation.
 *
 * The action only builds the request-scoped Supabase client (session cookies,
 * RLS applies) and delegates to `runEmmaFollowUp`, which re-checks the session,
 * the agency and every guard rail server-side — including the consent of the
 * channel, without which no draft is written at all.
 *
 * An AI agent is never called from a client component: this is the only entry
 * point exposed to the UI.
 */

import { failWith } from "@/lib/agents/errors";
import { parseContactId } from "@/lib/agents/input";
import { createClient } from "@/lib/supabase/server";
import type { Result } from "@/lib/utils/result";

import { runEmmaFollowUp, type EmmaRunResult } from "./emma";

export async function prepareFollowUp(contactId: string): Promise<Result<EmmaRunResult>> {
  // A server action is a public endpoint: the argument is validated at runtime,
  // whatever its declared type. Same generic answer as "unknown contact".
  const id = parseContactId(contactId);
  if (id === null) return failWith<EmmaRunResult>("contact_not_found");

  const client = await createClient();
  return runEmmaFollowUp(client, id);
}
