/**
 * Server-side resolution of "who is running this agent, for which agency".
 *
 * CLAUDE.md: every server action and route re-checks the session and the
 * `agency_id` server-side, even when the UI already shows the right thing. The
 * agency is never read from a value sent by the browser: it comes from the
 * membership of the authenticated user.
 */

import { ok, type Result } from "@/lib/utils/result";

import { failFromDatabase, failWith } from "./errors";
import type { AgentContext, TypedClient } from "./types";

export async function resolveAgentContext(client: TypedClient): Promise<Result<AgentContext>> {
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) {
    return failWith<AgentContext>("not_authenticated");
  }

  const { data, error } = await client
    .from("memberships")
    .select("agency_id, role")
    .eq("user_id", userData.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    return failFromDatabase<AgentContext>("resolveAgentContext", error);
  }
  if (!data) {
    return failWith<AgentContext>("no_agency");
  }

  return ok({ userId: userData.user.id, agencyId: data.agency_id, role: data.role });
}
