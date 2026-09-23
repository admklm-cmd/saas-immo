/**
 * Dashboard domain — read implementation.
 *
 * Takes an authenticated Supabase client (session cookies in `queries.ts`, a
 * real session in the integration tests): RLS always applies, the service_role
 * client is never used here.
 *
 * Contract (docs/plans/2026-09-23-dashboard.md):
 *   * invalid session or no agency → the whole call is `{ data: null, error }`;
 *   * otherwise every indicator is computed independently: one that fails is
 *     `{ status: "unavailable" }` (detail logged server-side), the others stay;
 *   * every figure is an exact count in the database, filtered by the agency
 *     resolved server-side — never the length of a paginated list.
 */

import {
  APPOINTMENT_CONFIRMABLE_STAGES,
  AWAITING_HUMAN,
  findAiPausedState,
} from "@/features/agents-ia/data";
import { parseAgentActivityRows, requireExactCount, type AgentActivityRow } from "@/features/agents-ia/activity";
import { UPCOMING_APPOINTMENT_STATUSES } from "@/features/appointments/types";
import type { AgentRunCounts } from "@/features/agents-ia/types";
import { NO_NAME_LABEL } from "@/features/contacts/data";
import { OPEN_TASK_STATUS } from "@/features/tasks/types";
import { resolveAgentContext } from "@/lib/agents/context";
import { failFromDatabase, failFromUnexpected } from "@/lib/agents/errors";
import { AGENCY_TIME_ZONE, parisDayStart, parisWindowStart } from "@/lib/agents/time";
import type { TypedClient } from "@/lib/agents/types";
import { ok, type Result } from "@/lib/utils/result";

import {
  DASHBOARD_PIPELINE_STAGES,
  DASHBOARD_SAMPLE_LIMIT,
  type DashboardActionList,
  type DashboardAgents,
  type DashboardAppointmentItem,
  type DashboardInboundLeadItem,
  type DashboardIndicator,
  type DashboardMessageItem,
  type DashboardPipeline,
  type DashboardScope,
  type DashboardSummary,
  type DashboardTaskItem,
  type DashboardTimeZone,
} from "./types";

const TIME_ZONE: DashboardTimeZone = AGENCY_TIME_ZONE as DashboardTimeZone;

/** Width of the « sur 7 jours » window. */
const LAST_DAYS_WINDOW = 7;

/**
 * Statuses of an appointment that is still ahead (not cancelled, not done).
 * Shared with `/rendez-vous` (`listAppointments`, view `upcoming`).
 */
const ACTIVE_APPOINTMENT_STATUSES = UPCOMING_APPOINTMENT_STATUSES;

// -----------------------------------------------------------------------------
// Small helpers
// -----------------------------------------------------------------------------

/** PostgREST spells UTC as "+00:00"; the UI gets one stable format. */
function isoUtc(value: string): string {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? value : new Date(parsed).toISOString();
}

type ContactNameRow = { first_name: string | null; last_name: string | null };

function contactName(contact: ContactNameRow | null | undefined): string {
  const name = [contact?.first_name, contact?.last_name]
    .map((part) => (part ?? "").trim())
    .filter((part) => part.length > 0)
    .join(" ");
  return name.length > 0 ? name : NO_NAME_LABEL;
}

/**
 * Runs one computation and turns its outcome into an indicator.
 *
 * An error result or an exception both become `unavailable`: the detail has
 * already been logged (or is logged here), and nothing technical is returned.
 */
async function measure<T>(
  label: string,
  scope: DashboardScope,
  compute: () => Promise<Result<T>>,
): Promise<DashboardIndicator<T>> {
  try {
    const result = await compute();
    if (result.error) return { status: "unavailable", scope };
    return { status: "ok", scope, value: result.data };
  } catch (cause) {
    console.error(`[dashboard] ${label} threw:`, cause);
    return { status: "unavailable", scope };
  }
}

type SampleResponse<Row> = {
  data: Row[] | null;
  error: { message?: string | null; code?: string | null } | null;
};

/**
 * Exact count + small sample, both required. The two reads run in parallel;
 * if either fails, the whole list is unavailable (a total without its links,
 * or links without a trustworthy total, is not shown).
 */
function actionList<Row, Item>(
  label: string,
  scope: DashboardScope,
  countQuery: () => PromiseLike<{ count: number | null; error: SampleResponse<Row>["error"] }>,
  sampleQuery: () => PromiseLike<SampleResponse<Row>>,
  toItem: (row: Row) => Item,
): Promise<DashboardActionList<Item>> {
  return measure(label, scope, async () => {
    const [countResponse, sampleResponse] = await Promise.all([countQuery(), sampleQuery()]);
    const total = requireExactCount(`dashboard.${label}.count`, countResponse);
    if (total.error) return { data: null, error: total.error };
    if (sampleResponse.error) {
      return failFromDatabase(`dashboard.${label}.sample`, sampleResponse.error);
    }
    const items = (sampleResponse.data ?? []).map(toItem);
    return ok({
      total: total.data,
      items,
      sampleLimit: DASHBOARD_SAMPLE_LIMIT,
      hasMore: total.data > items.length,
    });
  });
}

/** Sum of the 7-day window counts over EVERY agent row returned by SQL. */
function totalWindowRunCounts(rows: readonly AgentActivityRow[]): AgentRunCounts {
  return rows.reduce<AgentRunCounts>(
    (totals, row) => ({
      total: totals.total + Number(row.window_total),
      succeeded: totals.succeeded + Number(row.window_succeeded),
      failed: totals.failed + Number(row.window_failed),
      blocked: totals.blocked + Number(row.window_blocked),
      running: totals.running + Number(row.window_running),
    }),
    { total: 0, succeeded: 0, failed: 0, blocked: 0, running: 0 },
  );
}

/** Sum of the current-day counts over EVERY agent row returned by SQL. */
function totalTodayRunCounts(rows: readonly AgentActivityRow[]): AgentRunCounts {
  return rows.reduce<AgentRunCounts>(
    (totals, row) => ({
      total: totals.total + Number(row.today_total),
      succeeded: totals.succeeded + Number(row.today_succeeded),
      failed: totals.failed + Number(row.today_failed),
      blocked: totals.blocked + Number(row.today_blocked),
      running: totals.running + Number(row.today_running),
    }),
    { total: 0, succeeded: 0, failed: 0, blocked: 0, running: 0 },
  );
}

// -----------------------------------------------------------------------------
// Row → item
// -----------------------------------------------------------------------------

type AppointmentRow = {
  id: string;
  contact_id: string;
  status: DashboardAppointmentItem["status"];
  starts_at: string;
  ends_at: string;
  is_simulation: boolean;
  contacts: ContactNameRow | null;
};

function toAppointmentItem(row: AppointmentRow): DashboardAppointmentItem {
  return {
    id: row.id,
    contactId: row.contact_id,
    contactName: contactName(row.contacts),
    status: row.status,
    startsAt: isoUtc(row.starts_at),
    endsAt: isoUtc(row.ends_at),
    isSimulation: row.is_simulation,
  };
}

const APPOINTMENT_SAMPLE_COLUMNS =
  "id, contact_id, status, starts_at, ends_at, is_simulation, contacts!appointments_contact_fkey(first_name, last_name)";

// -----------------------------------------------------------------------------
// The summary
// -----------------------------------------------------------------------------

/**
 * Everything the `/dashboard` screen displays, for the caller's agency.
 *
 * `now` is injectable for the tests; the server always uses the real instant.
 */
export async function buildDashboardSummary(
  client: TypedClient,
  now: Date = new Date(),
): Promise<Result<DashboardSummary>> {
  try {
    const contextResult = await resolveAgentContext(client);
    if (contextResult.error) return { data: null, error: contextResult.error };
    const agencyId = contextResult.data.agencyId;

    const nowIso = now.toISOString();
    const dayStart = parisDayStart(now);
    const windowStart = parisWindowStart(LAST_DAYS_WINDOW, now);

    const pending: DashboardScope = { key: "pending_all_time" };
    const current: DashboardScope = { key: "current", at: nowIso };
    const todayScope: DashboardScope = {
      key: "today",
      startsAt: dayStart.toISOString(),
      endsAt: nowIso,
      days: 1,
      timeZone: TIME_ZONE,
    };
    const last7DaysScope: DashboardScope = {
      key: "last_7_days",
      startsAt: windowStart.toISOString(),
      endsAt: nowIso,
      days: 7,
      timeZone: TIME_ZONE,
    };
    const upcomingScope: DashboardScope = { key: "upcoming", startsAt: nowIso, timeZone: TIME_ZONE };

    // --- À faire maintenant ----------------------------------------------------

    const messagesToValidate = actionList(
      "messagesToValidate",
      pending,
      () =>
        client
        .from("outbound_messages")
        .select("id", { count: "exact", head: true })
        .eq("agency_id", agencyId)
        .in("status", AWAITING_HUMAN),
      () =>
        client
        .from("outbound_messages")
        .select(
          "id, contact_id, channel, status, is_simulation, created_by_agent, created_at, contacts!outbound_messages_contact_fkey(first_name, last_name)",
        )
        .eq("agency_id", agencyId)
        .in("status", AWAITING_HUMAN)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(DASHBOARD_SAMPLE_LIMIT),
      (row): DashboardMessageItem => ({
        id: row.id,
        contactId: row.contact_id,
        contactName: contactName(row.contacts),
        channel: row.channel,
        status: row.status as DashboardMessageItem["status"],
        createdByAgent: row.created_by_agent,
        isSimulation: row.is_simulation,
        createdAt: isoUtc(row.created_at),
      }),
    );

    const inboundLeadsToProcess = actionList(
      "inboundLeadsToProcess",
      pending,
      () =>
        client
        .from("inbound_leads")
        .select("id", { count: "exact", head: true })
        .eq("agency_id", agencyId)
        .eq("status", "pending"),
      () =>
        client
        .from("inbound_leads")
        .select("id, source, created_at")
        .eq("agency_id", agencyId)
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(DASHBOARD_SAMPLE_LIMIT),
      (row): DashboardInboundLeadItem => ({
        id: row.id,
        source: row.source,
        createdAt: isoUtc(row.created_at),
      }),
    );

    // Same condition as `canBeConfirmed`: `proposed`, and the contact is at a
    // stage the database accepts for the confirmation. The inner join makes
    // the contact's stage a filter of the count itself.
    const appointmentsToConfirm = actionList(
      "appointmentsToConfirm",
      pending,
      () =>
        client
        .from("appointments")
        .select("id, contacts!appointments_contact_fkey!inner(stage)", { count: "exact", head: true })
        .eq("agency_id", agencyId)
        .eq("status", "proposed")
        .in("contacts.stage", APPOINTMENT_CONFIRMABLE_STAGES),
      () =>
        client
        .from("appointments")
        .select(
          "id, contact_id, status, starts_at, ends_at, is_simulation, contacts!appointments_contact_fkey!inner(first_name, last_name, stage)",
        )
        .eq("agency_id", agencyId)
        .eq("status", "proposed")
        .in("contacts.stage", APPOINTMENT_CONFIRMABLE_STAGES)
        .order("starts_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(DASHBOARD_SAMPLE_LIMIT),
      (row) => toAppointmentItem(row as AppointmentRow),
    );

    // Same condition as `canBeCompleted`: `confirmed` (closed with a report).
    const appointmentsToClose = actionList(
      "appointmentsToClose",
      pending,
      () =>
        client
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("agency_id", agencyId)
        .eq("status", "confirmed"),
      () =>
        client
        .from("appointments")
        .select(APPOINTMENT_SAMPLE_COLUMNS)
        .eq("agency_id", agencyId)
        .eq("status", "confirmed")
        .order("starts_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(DASHBOARD_SAMPLE_LIMIT),
      (row) => toAppointmentItem(row as AppointmentRow),
    );

    const openTasks = actionList(
      "openTasks",
      { key: "open_all_time" },
      () =>
        client
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("agency_id", agencyId)
        .eq("status", OPEN_TASK_STATUS),
      () =>
        client
        .from("tasks")
        .select(
          "id, contact_id, type, title, due_at, created_by_agent, created_at, contacts!tasks_contact_fkey(first_name, last_name)",
        )
        .eq("agency_id", agencyId)
        .eq("status", OPEN_TASK_STATUS)
        .order("due_at", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(DASHBOARD_SAMPLE_LIMIT),
      (row): DashboardTaskItem => ({
        id: row.id,
        contactId: row.contact_id,
        contactName: row.contact_id === null ? null : contactName(row.contacts),
        type: row.type,
        title: row.title,
        dueAt: row.due_at ? isoUtc(row.due_at) : null,
        createdByAgent: row.created_by_agent,
        createdAt: isoUtc(row.created_at),
      }),
    );

    // --- Pipeline : one exact count per stage -----------------------------------

    const pipeline: Promise<DashboardPipeline> = Promise.all(
      DASHBOARD_PIPELINE_STAGES.map(async (stage) => ({
        stage,
        count: await measure(`pipeline.${stage}`, current, async () =>
          requireExactCount(
            `dashboard.pipeline.${stage}`,
            await client
              .from("contacts")
              .select("id", { count: "exact", head: true })
              .eq("agency_id", agencyId)
              .eq("stage", stage),
          ),
        ),
      })),
    ).then((stages) => ({ stages }));

    // --- Agents IA ---------------------------------------------------------------

    const killSwitch = measure("killSwitch", current, async () => {
      const state = await findAiPausedState(client);
      if (state.error) return { data: null, error: state.error };
      return ok({ aiPaused: state.data.aiPaused, canResume: state.data.canResume });
    });

    // One aggregate for both windows; parsed before use (an unexpected payload
    // is "unavailable", never a row of zeros).
    const activity: Promise<Result<AgentActivityRow[]>> = (async () => {
      try {
        const response = await client.rpc("agent_activity_summary", {
          target_agency: agencyId,
          day_start: dayStart.toISOString(),
          window_start: windowStart.toISOString(),
        });
        if (response.error) return failFromDatabase<AgentActivityRow[]>("dashboard.activity", response.error);
        return parseAgentActivityRows(response.data);
      } catch (cause) {
        return failFromUnexpected<AgentActivityRow[]>("dashboard.activity", cause);
      }
    })();

    const runsToday = measure("runsToday", todayScope, async () => {
      const rows = await activity;
      return rows.error ? { data: null, error: rows.error } : ok(totalTodayRunCounts(rows.data));
    });
    const runsLast7Days = measure("runsLast7Days", last7DaysScope, async () => {
      const rows = await activity;
      return rows.error ? { data: null, error: rows.error } : ok(totalWindowRunCounts(rows.data));
    });

    // --- Prochains rendez-vous ---------------------------------------------------

    const upcomingAppointments = actionList(
      "upcomingAppointments",
      upcomingScope,
      () =>
        client
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("agency_id", agencyId)
        .in("status", ACTIVE_APPOINTMENT_STATUSES)
        .gte("starts_at", nowIso),
      () =>
        client
        .from("appointments")
        .select(APPOINTMENT_SAMPLE_COLUMNS)
        .eq("agency_id", agencyId)
        .in("status", ACTIVE_APPOINTMENT_STATUSES)
        .gte("starts_at", nowIso)
        .order("starts_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(DASHBOARD_SAMPLE_LIMIT),
      (row) => toAppointmentItem(row as AppointmentRow),
    );

    const agents: Promise<DashboardAgents> = Promise.all([killSwitch, runsToday, runsLast7Days]).then(
      ([killSwitchValue, runsTodayValue, runsLast7DaysValue]) => ({
        killSwitch: killSwitchValue,
        runsToday: runsTodayValue,
        runsLast7Days: runsLast7DaysValue,
      }),
    );

    const [
      messagesValue,
      leadsValue,
      toConfirmValue,
      toCloseValue,
      tasksValue,
      pipelineValue,
      agentsValue,
      upcomingValue,
    ] = await Promise.all([
      messagesToValidate,
      inboundLeadsToProcess,
      appointmentsToConfirm,
      appointmentsToClose,
      openTasks,
      pipeline,
      agents,
      upcomingAppointments,
    ]);

    return ok({
      agencyId,
      generatedAt: nowIso,
      timeZone: TIME_ZONE,
      todo: {
        messagesToValidate: messagesValue,
        inboundLeadsToProcess: leadsValue,
        appointmentsToConfirm: toConfirmValue,
        appointmentsToClose: toCloseValue,
        openTasks: tasksValue,
      },
      pipeline: pipelineValue,
      agents: agentsValue,
      upcomingAppointments: upcomingValue,
    });
  } catch (cause) {
    return failFromUnexpected<DashboardSummary>("buildDashboardSummary", cause);
  }
}
