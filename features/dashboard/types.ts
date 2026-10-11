/**
 * Dashboard domain — types read by the `/dashboard` screen.
 *
 * Three rules shape everything here (docs/plans/2026-09-23-dashboard.md):
 *
 *   1. Every figure is an EXACT count made in the database (`count: "exact",
 *      head: true`, or the `agent_activity_summary` aggregate), filtered by the
 *      caller's agency and subject to RLS. No figure is ever derived from the
 *      first page of a paginated list.
 *   2. Every indicator carries its scope (period or perimeter) as a typed
 *      value, with the window boundaries when there is a window, computed in
 *      Europe/Paris. The screen must display it next to the figure.
 *   3. An indicator whose computation failed is `{ status: "unavailable" }`.
 *      `0` is only ever a measured zero (`{ status: "ok", value: 0 }`). One
 *      failing indicator never hides the others.
 */

import type { AgentRunCounts } from "@/features/agents-ia/types";
import type { Enums } from "@/lib/agents/types";

// -----------------------------------------------------------------------------
// Scopes — what period or perimeter a figure is about
// -----------------------------------------------------------------------------

/** Time zone in which every window of the dashboard is computed. */
export type DashboardTimeZone = "Europe/Paris";

/**
 * The period or perimeter of an indicator. The UI maps `key` to its French
 * label (« en attente, toutes dates », « aujourd'hui », « sur 7 jours »…).
 *
 *   * `pending_all_time` — items waiting for a human, whatever their creation
 *     date (messages to validate, inbound leads to process, appointments to
 *     confirm or to close).
 *   * `open_all_time`    — open tasks, whatever their creation or due date.
 *   * `current`          — a snapshot of the state right now (pipeline stages,
 *     kill switch). No window.
 *   * `today`            — the current Paris calendar day, from its midnight.
 *   * `last_7_days`      — the last 7 Paris calendar days, today included.
 *   * `upcoming`         — from `startsAt` (the instant of the read) onwards,
 *     no end.
 */
export type DashboardScope =
  | { key: "pending_all_time" }
  | { key: "open_all_time" }
  | { key: "current"; at: string }
  | {
      key: "today";
      /** Midnight Europe/Paris of the current day, ISO-8601 UTC. */
      startsAt: string;
      /** Instant of the read, ISO-8601 UTC (the window ends "now"). */
      endsAt: string;
      days: 1;
      timeZone: DashboardTimeZone;
    }
  | {
      key: "last_7_days";
      /** Midnight Europe/Paris six days ago, ISO-8601 UTC. */
      startsAt: string;
      /** Instant of the read, ISO-8601 UTC. */
      endsAt: string;
      days: 7;
      timeZone: DashboardTimeZone;
    }
  | {
      key: "upcoming";
      /** Instant of the read, ISO-8601 UTC: appointments starting at or after it. */
      startsAt: string;
      timeZone: DashboardTimeZone;
    };

export type DashboardScopeKey = DashboardScope["key"];

// -----------------------------------------------------------------------------
// Indicator — a measured value, or an honest "unavailable"
// -----------------------------------------------------------------------------

/**
 * One figure of the dashboard.
 *
 * `unavailable` means the computation failed (the technical detail is logged
 * server-side, never returned). It must be displayed as « Indisponible », never
 * as `0` nor hidden.
 */
export type DashboardIndicator<T> =
  | { status: "ok"; scope: DashboardScope; value: T }
  | { status: "unavailable"; scope: DashboardScope };

/** How many sample items an action list carries at most. */
export const DASHBOARD_SAMPLE_LIMIT = 5;

/**
 * An action list: the EXACT total, plus a small sample to link to the files.
 *
 * `items` is a SAMPLE (at most `sampleLimit` rows, in the order described on
 * each list), never the whole list: display `total` as the figure, and the
 * items as "the first few". `hasMore` is `total > items.length`.
 *
 * The count and the sample are two reads; if either fails, the whole list is
 * `unavailable`.
 */
export type DashboardActionList<TItem> = DashboardIndicator<{
  total: number;
  items: TItem[];
  sampleLimit: typeof DASHBOARD_SAMPLE_LIMIT;
  hasMore: boolean;
}>;

// -----------------------------------------------------------------------------
// Sample items — only what the screen needs, with the ids for the links
// -----------------------------------------------------------------------------

/** A draft waiting in the « à valider » queue. Link: `/agents-ia/a-valider`, `/contacts/{contactId}`. */
export type DashboardMessageItem = {
  id: string;
  contactId: string;
  /** "Prénom Nom", or "Contact sans nom". */
  contactName: string;
  channel: Enums["consent_channel"];
  /** `pending_validation` (to validate) or `approved` (validated, not sent yet). */
  status: "pending_validation" | "approved";
  createdByAgent: Enums["ai_agent_name"] | null;
  isSimulation: boolean;
  /** ISO-8601 UTC. */
  createdAt: string;
};

/**
 * A raw inbound lead Léa has not processed yet. Link: `/agents-ia/leads-entrants`.
 *
 * Deliberately no free text: the prospect's words are untrusted data and are
 * shown on the inbox screen only.
 */
export type DashboardInboundLeadItem = {
  id: string;
  source: Enums["contact_source"];
  /** ISO-8601 UTC. */
  createdAt: string;
};

/** An estimation appointment. Links: `/agents-ia/suivi-rendez-vous`, `/contacts/{contactId}`. */
export type DashboardAppointmentItem = {
  id: string;
  contactId: string;
  /** "Prénom Nom", or "Contact sans nom". */
  contactName: string;
  status: Enums["appointment_status"];
  /** ISO-8601 UTC. */
  startsAt: string;
  /** ISO-8601 UTC. */
  endsAt: string;
  /** Always true in the prototype: no real calendar is connected. */
  isSimulation: boolean;
};

/** An open task. Link: `/contacts/{contactId}` when `contactId` is not null. */
export type DashboardTaskItem = {
  id: string;
  /** `null` for an agency-level task (not about one contact). */
  contactId: string | null;
  /** "Prénom Nom", "Contact sans nom", or `null` for an agency-level task. */
  contactName: string | null;
  type: string;
  title: string;
  /** ISO-8601 UTC, or `null` when no due date was set. */
  dueAt: string | null;
  createdByAgent: Enums["ai_agent_name"] | null;
  /** ISO-8601 UTC. */
  createdAt: string;
};

// -----------------------------------------------------------------------------
// The four blocks of the screen
// -----------------------------------------------------------------------------

/**
 * « À faire maintenant ». Each list uses the SAME definition as the screen it
 * links to, so the figure matches what the user sees when clicking:
 *
 *   * `messagesToValidate`   — `outbound_messages` in `pending_validation` or
 *     `approved` (the « à valider » queue). Sample: oldest first.
 *   * `inboundLeadsToProcess` — `inbound_leads` in `pending` (`canBeProcessed`
 *     of Léa's inbox). Sample: oldest first.
 *   * `appointmentsToConfirm` — `appointments` in `proposed` whose contact is
 *     at `qualifie`, `chaud` or `rdv_planifie` (`canBeConfirmed`). Sample:
 *     soonest first.
 *   * `appointmentsToClose`  — `appointments` in `confirmed` (`canBeCompleted`:
 *     to close with a report). Sample: oldest `startsAt` first.
 *   * `openTasks`            — `tasks` in `open`. Sample: earliest due date
 *     first, tasks without a due date last.
 *
 * Scope: `pending_all_time` for the first four, `open_all_time` for the tasks.
 */
export type DashboardTodo = {
  messagesToValidate: DashboardActionList<DashboardMessageItem>;
  inboundLeadsToProcess: DashboardActionList<DashboardInboundLeadItem>;
  appointmentsToConfirm: DashboardActionList<DashboardAppointmentItem>;
  appointmentsToClose: DashboardActionList<DashboardAppointmentItem>;
  openTasks: DashboardActionList<DashboardTaskItem>;
};

/** Pipeline stages, in the order of the seller's journey (`perdu` last). */
export const DASHBOARD_PIPELINE_STAGES = [
  "nouveau",
  "qualifie",
  "chaud",
  "rdv_planifie",
  "estimation_faite",
  "mandat_signe",
  "perdu",
] as const satisfies readonly Enums["pipeline_stage"][];

export type DashboardPipelineStage = (typeof DASHBOARD_PIPELINE_STAGES)[number];

/**
 * « Pipeline »: one EXACT count per stage, each computed on its own (scope
 * `current`). A stage whose count failed is `unavailable`; the others stay.
 */
export type DashboardPipeline = {
  stages: Array<{ stage: DashboardPipelineStage; count: DashboardIndicator<number> }>;
};

/** The kill switch, as `findAiPausedState` reads it. */
export type DashboardKillSwitch = {
  /** When true, no AI agent can run. */
  aiPaused: boolean;
  /** Any member may pause; only a director may resume (enforced by the RPC). */
  canResume: boolean;
};

/**
 * « Agents IA ».
 *
 *   * `killSwitch` — scope `current`. Read on its own, so it stays visible even
 *     if the activity figures are unavailable.
 *   * `runsToday` / `runsLast7Days` — EXACT counts from
 *     `public.agent_activity_summary`, summed over every agent of the agency.
 *     `failed` = errors; `blocked` = attempts refused by a guard rail (kill
 *     switch, daily limit, human takeover), which are not errors of the agent.
 *     Both come from one aggregate: if it fails, both are `unavailable`.
 */
export type DashboardAgents = {
  killSwitch: DashboardIndicator<DashboardKillSwitch>;
  runsToday: DashboardIndicator<AgentRunCounts>;
  runsLast7Days: DashboardIndicator<AgentRunCounts>;
};

/**
 * « Prochains rendez-vous »: `appointments` in `proposed` or `confirmed`
 * starting at or after the instant of the read. `total` is exact; `items` are
 * the next five, soonest first. Scope `upcoming`.
 */
export type DashboardUpcomingAppointments = DashboardActionList<DashboardAppointmentItem>;

/** Everything the `/dashboard` screen displays. */
export type DashboardSummary = {
  agencyId: string;
  /** Instant of the read, ISO-8601 UTC: every window ends here. */
  generatedAt: string;
  timeZone: DashboardTimeZone;
  todo: DashboardTodo;
  pipeline: DashboardPipeline;
  agents: DashboardAgents;
  upcomingAppointments: DashboardUpcomingAppointments;
};
