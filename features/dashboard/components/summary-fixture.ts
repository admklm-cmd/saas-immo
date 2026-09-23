/**
 * Simulated `DashboardSummary` for the component tests (never imported by the
 * app). Fictitious names only.
 */
import {
  DASHBOARD_PIPELINE_STAGES,
  DASHBOARD_SAMPLE_LIMIT,
  type DashboardActionList,
  type DashboardAppointmentItem,
  type DashboardMessageItem,
  type DashboardScope,
  type DashboardSummary,
} from "../types";

export const NOW = "2026-09-23T10:00:00.000Z";

export const SCOPES = {
  pending: { key: "pending_all_time" },
  open: { key: "open_all_time" },
  current: { key: "current", at: NOW },
  today: { key: "today", startsAt: "2026-09-22T22:00:00.000Z", endsAt: NOW, days: 1, timeZone: "Europe/Paris" },
  last7: { key: "last_7_days", startsAt: "2026-09-16T22:00:00.000Z", endsAt: NOW, days: 7, timeZone: "Europe/Paris" },
  upcoming: { key: "upcoming", startsAt: NOW, timeZone: "Europe/Paris" },
} as const satisfies Record<string, DashboardScope>;

export function okList<T>(scope: DashboardScope, items: T[], total = items.length): DashboardActionList<T> {
  return {
    status: "ok",
    scope,
    value: { total, items, sampleLimit: DASHBOARD_SAMPLE_LIMIT, hasMore: total > items.length },
  };
}

export function message(overrides: Partial<DashboardMessageItem> = {}): DashboardMessageItem {
  return {
    id: "message-1",
    contactId: "contact-elodie",
    contactName: "Élodie Mercier",
    channel: "email",
    status: "pending_validation",
    createdByAgent: "louis",
    isSimulation: true,
    createdAt: "2026-09-20T08:00:00.000Z",
    ...overrides,
  };
}

export function appointment(overrides: Partial<DashboardAppointmentItem> = {}): DashboardAppointmentItem {
  return {
    id: "appointment-1",
    contactId: "contact-frederic",
    contactName: "Frédéric Masson",
    status: "confirmed",
    startsAt: "2026-09-28T08:00:00.000Z",
    endsAt: "2026-09-28T09:00:00.000Z",
    isSimulation: true,
    ...overrides,
  };
}

export function makeSummary(): DashboardSummary {
  return {
    agencyId: "agency-a",
    generatedAt: NOW,
    timeZone: "Europe/Paris",
    todo: {
      messagesToValidate: okList(SCOPES.pending, [message()]),
      inboundLeadsToProcess: okList(SCOPES.pending, [
        { id: "lead-1", source: "estimation_form", createdAt: "2026-09-21T09:00:00.000Z" },
      ]),
      appointmentsToConfirm: okList(SCOPES.pending, [appointment({ id: "appointment-2", status: "proposed" })]),
      appointmentsToClose: okList(SCOPES.pending, []),
      openTasks: okList(SCOPES.open, [
        {
          id: "task-1",
          contactId: "contact-camille",
          contactName: "Camille Berthier",
          type: "missing_information",
          title: "Compléter la motivation de vente",
          dueAt: null,
          createdByAgent: "hugo",
          createdAt: "2026-09-19T08:00:00.000Z",
        },
      ]),
    },
    pipeline: {
      stages: DASHBOARD_PIPELINE_STAGES.map((stage, index) => ({
        stage,
        count: { status: "ok", scope: SCOPES.current, value: index },
      })),
    },
    agents: {
      killSwitch: { status: "ok", scope: SCOPES.current, value: { aiPaused: false, canResume: true } },
      runsToday: {
        status: "ok",
        scope: SCOPES.today,
        value: { total: 4, succeeded: 2, failed: 1, blocked: 1, running: 0 },
      },
      runsLast7Days: {
        status: "ok",
        scope: SCOPES.last7,
        value: { total: 12, succeeded: 8, failed: 2, blocked: 2, running: 0 },
      },
    },
    upcomingAppointments: okList(SCOPES.upcoming, [appointment()]),
  };
}
