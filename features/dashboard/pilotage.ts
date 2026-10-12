/**
 * Boss's statistics page — read implementation (`getDashboardPilotage`).
 *
 * Takes an authenticated Supabase client (session cookies in `queries.ts`, a
 * real session in the integration tests): RLS always applies, the service_role
 * client is never used, the agency is resolved server-side from the session.
 *
 * Contract:
 *   * invalid period, invalid session or no agency → the whole call is
 *     `{ data: null, error }`;
 *   * otherwise every block is computed independently: a block whose reads
 *     failed is `{ status: "unavailable" }` (detail logged server-side), the
 *     others stay;
 *   * every figure is computed from rows read from the database, filtered by the
 *     agency, never from a sample: reads are paginated to the end or refused
 *     (`fetchAllPages` fails above 20 000 rows rather than truncating).
 *
 * Reads (shared by the blocks that need them):
 *   * dossiers created over the two periods          (1 paginated read)
 *   * activities over the two periods, authored by a user or an AI agent
 *                                                     (1 paginated read, index
 *                                                     `activities (agency_id, occurred_at)`)
 *   * open dossiers + open tasks + upcoming appointments + drafts (snapshot)
 *   * agent runs aggregate + last activity of each agent
 * No index and no migration were added: the volumes of an independent agency
 * (a few hundred dossiers a year, a few thousand history entries) are read in a
 * handful of requests. See the cost note on `fetchAllPages`.
 */

import { findAiPausedState } from "@/features/agents-ia/data";
import { AWAITING_HUMAN } from "@/features/agents-ia/data";
import { parseAgentActivityRows } from "@/features/agents-ia/activity";
import { UPCOMING_APPOINTMENT_STATUSES } from "@/features/appointments/types";
import { NO_NAME_LABEL } from "@/features/contacts/data";
import { resolveAgentContext } from "@/lib/agents/context";
import { failFromDatabase, failFromUnexpected } from "@/lib/agents/errors";
import { fetchAllPages } from "@/lib/agents/paginate";
import type { AiAgentName, Enums, TypedClient } from "@/lib/agents/types";
import { ok, type Result } from "@/lib/utils/result";

import {
  buildAgentActivity,
  buildOrigins,
  buildSeriesPoints,
  computeFlow,
  computeWithoutNextAction,
  countSignedIn,
  createdIn,
  firstHandlingDelay,
  latestInstant,
  OPEN_STAGES,
  PILOTAGE_AGENT_ORDER,
  rate,
  signedMandates,
  type OpenContactRow,
  type PilotageActivityRow,
  type PilotageContactRow,
} from "./pilotage-compute";
import {
  pilotagePeriodSchema,
  previousCoverage,
  resolvePilotagePeriod,
  type PilotagePeriod,
  type PilotagePeriodKey,
} from "./pilotage-periods";
import type { DashboardPilotage, PilotageBlock } from "./pilotage-types";

type Stage = Enums["pipeline_stage"];
type Source = Enums["contact_source"];

const INVALID_PERIOD = {
  code: "invalid_period",
  message: "Période invalide : choisissez 7 jours, 30 jours, 3 mois ou 1 an.",
} as const;

/** Runs a block; an error result or an exception both become `unavailable` (detail already logged). */
async function block<T>(label: string, compute: () => Promise<Result<T>> | Result<T>): Promise<PilotageBlock<T>> {
  try {
    const result = await compute();
    if (result.error) return { status: "unavailable" };
    return { status: "ok", value: result.data };
  } catch (cause) {
    console.error(`[pilotage] ${label} threw:`, cause);
    return { status: "unavailable" };
  }
}

type ContactReadRow = { id: string; created_at: string; stage: Stage; source: Source };
type ActivityReadRow = {
  contact_id: string | null;
  type: string;
  actor_type: string;
  actor_agent: string | null;
  occurred_at: string;
  stage: string | null;
  previous_stage: string | null;
  reason: string | null;
};

const ACTIVITY_COLUMNS =
  "contact_id, type, actor_type, actor_agent, occurred_at, stage:payload->>stage, previous_stage:payload->>previous_stage, reason:payload->>reason";

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/**
 * Statistics page of the caller's agency for one period.
 *
 * `now` is injectable for the tests; the server always uses the real instant.
 */
export async function buildDashboardPilotage(
  client: TypedClient,
  periodKey: PilotagePeriodKey,
  now: Date = new Date(),
): Promise<Result<DashboardPilotage>> {
  try {
    const parsed = pilotagePeriodSchema.safeParse(periodKey);
    if (!parsed.success) return { data: null, error: INVALID_PERIOD };

    const contextResult = await resolveAgentContext(client);
    if (contextResult.error) return { data: null, error: contextResult.error };
    const agencyId = contextResult.data.agencyId;

    const period: PilotagePeriod = resolvePilotagePeriod(parsed.data, now);
    const readFrom = period.previous.startsAt;
    const readTo = period.current.endsAt;
    const nowIso = now.toISOString();

    // --- Shared reads (started at once, awaited by the blocks that need them) ---

    const contactsRead: Promise<Result<PilotageContactRow[]>> = (async () => {
      try {
        const rows = await fetchAllPages<ContactReadRow>("pilotage.contacts", (from, to) =>
          client
            .from("contacts")
            .select("id, created_at, stage, source")
            .eq("agency_id", agencyId)
            .gte("created_at", readFrom)
            .lt("created_at", readTo)
            .order("created_at", { ascending: true })
            .order("id", { ascending: true })
            .range(from, to),
        );
        if (rows.error) return { data: null, error: rows.error };
        return ok(rows.data.map((row) => ({ id: row.id, createdAt: row.created_at, stage: row.stage, source: row.source })));
      } catch (cause) {
        return failFromUnexpected<PilotageContactRow[]>("pilotage.contacts", cause);
      }
    })();

    const activitiesRead: Promise<Result<PilotageActivityRow[]>> = (async () => {
      try {
        const rows = await fetchAllPages<ActivityReadRow>("pilotage.activities", (from, to) =>
          (
            client
              .from("activities")
              .select(ACTIVITY_COLUMNS)
              .eq("agency_id", agencyId)
              .in("actor_type", ["user", "ai_agent"])
              .gte("occurred_at", readFrom)
              .lt("occurred_at", readTo)
              .order("occurred_at", { ascending: true })
              .order("id", { ascending: true })
              .range(from, to) as unknown as PromiseLike<{
              data: ActivityReadRow[] | null;
              error: { message?: string | null; code?: string | null } | null;
            }>
          ),
        );
        if (rows.error) return { data: null, error: rows.error };
        return ok(
          rows.data.map((row) => ({
            contactId: row.contact_id,
            type: row.type,
            actorType: row.actor_type,
            actorAgent: row.actor_agent,
            occurredAt: row.occurred_at,
            stage: stringOrNull(row.stage),
            previousStage: stringOrNull(row.previous_stage),
            reason: stringOrNull(row.reason),
          })),
        );
      } catch (cause) {
        return failFromUnexpected<PilotageActivityRow[]>("pilotage.activities", cause);
      }
    })();

    // First dossier ever recorded (all time): tells whether the previous period is covered.
    const historyRead: Promise<string | null> = (async () => {
      try {
        const { data, error } = await client
          .from("contacts")
          .select("created_at")
          .eq("agency_id", agencyId)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (error) {
          console.error(`[pilotage] history start read failed (${error.code ?? "?"})`);
          return null;
        }
        return data ? new Date(data.created_at).toISOString() : null;
      } catch (cause) {
        console.error("[pilotage] history start read threw:", cause);
        return null;
      }
    })();

    // --- Blocks -------------------------------------------------------------------

    const withContacts = async <T>(compute: (contacts: PilotageContactRow[]) => T): Promise<Result<T>> => {
      const contacts = await contactsRead;
      return contacts.error ? { data: null, error: contacts.error } : ok(compute(contacts.data));
    };
    const withActivities = async <T>(compute: (activities: PilotageActivityRow[]) => T): Promise<Result<T>> => {
      const activities = await activitiesRead;
      return activities.error ? { data: null, error: activities.error } : ok(compute(activities.data));
    };
    const withBoth = async <T>(
      compute: (contacts: PilotageContactRow[], activities: PilotageActivityRow[]) => T,
    ): Promise<Result<T>> => {
      const [contacts, activities] = await Promise.all([contactsRead, activitiesRead]);
      if (contacts.error) return { data: null, error: contacts.error };
      if (activities.error) return { data: null, error: activities.error };
      return ok(compute(contacts.data, activities.data));
    };

    const requests = block("requests", () =>
      withContacts((contacts) => ({
        value: createdIn(contacts, period.current).length,
        previous: createdIn(contacts, period.previous).length,
      })),
    );

    const mandates = block("mandates", () =>
      withActivities((activities) => {
        const signed = signedMandates(activities);
        return { value: countSignedIn(signed, period.current), previous: countSignedIn(signed, period.previous) };
      }),
    );

    const conversion = block("conversion", () =>
      withBoth((contacts, activities) => {
        const signed = signedMandates(activities);
        return {
          current: rate(countSignedIn(signed, period.current), createdIn(contacts, period.current).length),
          previous: rate(countSignedIn(signed, period.previous), createdIn(contacts, period.previous).length),
        };
      }),
    );

    const firstHandling = block("firstHandling", () =>
      withBoth((contacts, activities) => ({
        current: firstHandlingDelay(createdIn(contacts, period.current), activities),
        previous: firstHandlingDelay(createdIn(contacts, period.previous), activities),
      })),
    );

    const series = block("series", () =>
      withBoth((contacts, activities) => {
        const signed = signedMandates(activities);
        const signedInstants = [...signed.values()].map((time) => new Date(time).toISOString());
        const receivedInstants = contacts.map((contact) => contact.createdAt);
        return {
          granularity: period.granularity,
          points: buildSeriesPoints(period.currentBuckets, receivedInstants, signedInstants),
          previousPoints: buildSeriesPoints(period.previousBuckets, receivedInstants, signedInstants),
        };
      }),
    );

    const origins = block("origins", () =>
      withContacts((contacts) =>
        buildOrigins(
          createdIn(contacts, period.current).map((contact) => contact.source),
          createdIn(contacts, period.previous).map((contact) => contact.source),
        ),
      ),
    );

    const flow = block("flow", () =>
      withBoth((contacts, activities) => computeFlow(createdIn(contacts, period.current), activities)),
    );

    const withoutNextAction = block("withoutNextAction", async () => {
      const [openContacts, tasks, appointments, drafts] = await Promise.all([
        fetchAllPages<{ id: string; first_name: string | null; last_name: string | null; stage: Stage; updated_at: string }>(
          "pilotage.openContacts",
          (from, to) =>
            client
              .from("contacts")
              .select("id, first_name, last_name, stage, updated_at")
              .eq("agency_id", agencyId)
              .in("stage", [...OPEN_STAGES])
              .order("updated_at", { ascending: true })
              .order("id", { ascending: true })
              .range(from, to),
        ),
        fetchAllPages<{ contact_id: string | null }>("pilotage.openTasks", (from, to) =>
          client
            .from("tasks")
            .select("contact_id")
            .eq("agency_id", agencyId)
            .eq("status", "open")
            .not("contact_id", "is", null)
            .order("id", { ascending: true })
            .range(from, to),
        ),
        fetchAllPages<{ contact_id: string }>("pilotage.upcomingAppointments", (from, to) =>
          client
            .from("appointments")
            .select("contact_id")
            .eq("agency_id", agencyId)
            .in("status", [...UPCOMING_APPOINTMENT_STATUSES])
            .gte("starts_at", nowIso)
            .order("id", { ascending: true })
            .range(from, to),
        ),
        fetchAllPages<{ contact_id: string }>("pilotage.pendingDrafts", (from, to) =>
          client
            .from("outbound_messages")
            .select("contact_id")
            .eq("agency_id", agencyId)
            .in("status", [...AWAITING_HUMAN])
            .order("id", { ascending: true })
            .range(from, to),
        ),
      ]);
      for (const read of [openContacts, tasks, appointments, drafts]) {
        if (read.error) return { data: null, error: read.error };
      }
      const open: OpenContactRow[] = openContacts.data!.map((row) => ({
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        stage: row.stage,
        updatedAt: row.updated_at,
      }));
      return ok(
        computeWithoutNextAction({
          openContacts: open,
          contactsWithOpenTask: new Set(tasks.data!.flatMap((row) => (row.contact_id ? [row.contact_id] : []))),
          contactsWithUpcomingAppointment: new Set(appointments.data!.map((row) => row.contact_id)),
          contactsWithPendingDraft: new Set(drafts.data!.map((row) => row.contact_id)),
          noNameLabel: NO_NAME_LABEL,
        }),
      );
    });

    const agents = block("agents", async () => {
      const pausedState = await findAiPausedState(client);
      if (pausedState.error) return { data: null, error: pausedState.error };

      const [summary, activities, lastRuns, lastEntries] = await Promise.all([
        client.rpc("agent_activity_summary", {
          target_agency: agencyId,
          day_start: period.current.startsAt,
          window_start: period.current.startsAt,
        }),
        activitiesRead,
        Promise.all(
          PILOTAGE_AGENT_ORDER.map(async (agent) => ({
            agent,
            response: await client
              .from("ai_agent_runs")
              .select("started_at")
              .eq("agency_id", agencyId)
              .eq("agent", agent)
              .order("started_at", { ascending: false })
              .limit(1)
              .maybeSingle(),
          })),
        ),
        Promise.all(
          PILOTAGE_AGENT_ORDER.map(async (agent) => ({
            agent,
            response: await client
              .from("activities")
              .select("occurred_at")
              .eq("agency_id", agencyId)
              .eq("actor_type", "ai_agent")
              .eq("actor_agent", agent)
              .order("occurred_at", { ascending: false })
              .limit(1)
              .maybeSingle(),
          })),
        ),
      ]);

      if (summary.error) return failFromDatabase<never>("pilotage.agents.summary", summary.error);
      if (activities.error) return { data: null, error: activities.error };
      const runRows = parseAgentActivityRows(summary.data);
      if (runRows.error) return { data: null, error: runRows.error };

      const lastActivityAt: Partial<Record<AiAgentName, string | null>> = {};
      for (const { agent, response } of lastRuns) {
        if (response.error) return failFromDatabase<never>("pilotage.agents.lastRun", response.error);
        lastActivityAt[agent] = response.data?.started_at ?? null;
      }
      for (const { agent, response } of lastEntries) {
        if (response.error) return failFromDatabase<never>("pilotage.agents.lastEntry", response.error);
        lastActivityAt[agent] = latestInstant(lastActivityAt[agent], response.data?.occurred_at);
      }

      return ok({
        paused: pausedState.data.aiPaused,
        agents: buildAgentActivity({
          runRows: runRows.data,
          activities: activities.data,
          range: period.current,
          lastActivityAt,
        }),
      });
    });

    const [
      requestsBlock,
      mandatesBlock,
      conversionBlock,
      firstHandlingBlock,
      withoutNextActionBlock,
      seriesBlock,
      originsBlock,
      flowBlock,
      agentsBlock,
      historyStartsAt,
    ] = await Promise.all([
      requests,
      mandates,
      conversion,
      firstHandling,
      withoutNextAction,
      series,
      origins,
      flow,
      agents,
      historyRead,
    ]);

    return ok({
      generatedAt: nowIso,
      period: {
        key: period.key,
        granularity: period.granularity,
        timeZone: period.timeZone,
        current: period.current,
        previous: period.previous,
        historyStartsAt,
        previousCoverage: previousCoverage(historyStartsAt, period.previous),
      },
      mandates: mandatesBlock,
      requests: requestsBlock,
      conversion: conversionBlock,
      firstHandling: firstHandlingBlock,
      withoutNextAction: withoutNextActionBlock,
      series: seriesBlock,
      origins: originsBlock,
      flow: flowBlock,
      agents: agentsBlock,
    });
  } catch (cause) {
    return failFromUnexpected<DashboardPilotage>("buildDashboardPilotage", cause);
  }
}
