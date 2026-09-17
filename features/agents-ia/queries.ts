import "server-only";

/**
 * AI agents domain — reads exposed to the UI (Server Components).
 *
 * Each function builds the request-scoped Supabase client (session cookies,
 * RLS applies) and delegates to `data.ts`. The session and the `agency_id` are
 * always re-resolved server-side, never read from the browser.
 *
 * All of them return `{ data, error }`: no exception ever reaches the UI.
 */

import { createClient } from "@/lib/supabase/server";
import type { Result } from "@/lib/utils/result";

import {
  findAiPausedState,
  findRunSteps,
  getAgentsDashboard,
  listAgentRuns,
  listAppointmentsToFollowThrough,
  listInboundLeads,
  listMessagesToValidate,
} from "./data";
import type {
  AgentRunFiltersInput,
  AgentRunReplay,
  AgentRunsPage,
  AgentsDashboard,
  AiPausedState,
  InboundLeadView,
  PendingMessageView,
  ReportedAppointmentView,
} from "./types";

/**
 * The steps really recorded during one AI run, in order, with the run head.
 *
 * Use these values — and only these — to animate the replay of an execution:
 * each step carries the instants and the duration that were actually measured
 * on the server. A run of another agency, or an unknown run, answers
 * "Exécution d'agent introuvable.".
 */
export async function getRunSteps(runId: string): Promise<Result<AgentRunReplay>> {
  const client = await createClient();
  return findRunSteps(client, runId);
}

/**
 * Léa's inbox: the raw inbound leads of the agency, most recent first.
 *
 * `rawText` is the prospect's own words — untrusted data: display it as text,
 * never as markup. `canBeProcessed` says whether `processInboundLead(id)` is
 * still possible; the server re-checks it anyway.
 */
export async function getInboundLeads(): Promise<Result<InboundLeadView[]>> {
  const client = await createClient();
  return listInboundLeads(client);
}

/**
 * Sarah's working list: past estimation appointments and their reports.
 *
 * `canBeFollowedThrough` is true only when a human has written the report;
 * `followThroughAppointment(id)` refuses otherwise, whatever the UI shows.
 */
export async function getAppointmentsToFollowThrough(): Promise<Result<ReportedAppointmentView[]>> {
  const client = await createClient();
  return listAppointmentsToFollowThrough(client);
}

/**
 * The « à valider » queue: the drafts waiting for a human of the agency.
 *
 * **Nothing has been sent.** `canBeSent` says what the server would accept at
 * this instant; it is there to grey out a button, never to authorise anything —
 * the consent is re-read by the code and then by the database at send time.
 */
export async function getMessagesToValidate(): Promise<Result<PendingMessageView[]>> {
  const client = await createClient();
  return listMessagesToValidate(client);
}

/**
 * The « Agents IA » screen: the five agents, the agency settings, and what the
 * agents really did.
 *
 * Every figure is an EXACT count made in the database over two named windows
 * (`windows.today`, `windows.last7Days`, Europe/Paris): the screen must always
 * display the label of the window next to the figure it shows.
 *
 * **All or nothing**: if a single count fails, this returns
 * `{ data: null, error }`. A figure that could not be read is NEVER returned as
 * `0` — the screen shows the error, not a reassuring zero.
 */
export async function getAgentsOverview(): Promise<Result<AgentsDashboard>> {
  const client = await createClient();
  return getAgentsDashboard(client);
}

/**
 * The kill switch on its own: nothing but the agency and the caller's right.
 *
 * Use this — not `getAgentsOverview()` — to render the « coupe-circuit »
 * control. Suspending every AI agent in one click is the agency's emergency
 * device: it must stay on the screen even when the activity figures could not
 * be counted, and this read makes no count at all, so nothing in it can fail
 * halfway. Rendering both is fine: the panel comes from here, the statistics
 * from `getAgentsOverview()`, and one failing no longer hides the other.
 */
export async function getAiPausedState(): Promise<Result<AiPausedState>> {
  const client = await createClient();
  return findAiPausedState(client);
}

/**
 * The agency's AI run journal, one page at a time, most recent first.
 *
 * The filters come from the browser, so they are validated by zod server-side
 * (agent, outcome, `limit` ≤ 100, `offset` ≤ 5 000, no unknown key). An invalid
 * filter is refused (`invalid_filters`) instead of being silently dropped: a
 * list that does not match the filters the screen displays is one more false
 * statement. `total` is an exact count, so "25 sur 1 248" is true.
 */
export async function getAgentRuns(
  filters: AgentRunFiltersInput = {},
): Promise<Result<AgentRunsPage>> {
  const client = await createClient();
  return listAgentRuns(client, filters);
}
