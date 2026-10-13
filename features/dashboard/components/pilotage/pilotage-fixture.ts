import type { DashboardPilotage, PilotageAgentActivity } from "../../pilotage-types";
import type { PilotagePeriodKey } from "../../pilotage-periods";

/** Synthetic `DashboardPilotage` for the component tests (no real data). */
export function makePilotage(key: PilotagePeriodKey = "365d", override: Partial<DashboardPilotage> = {}): DashboardPilotage {
  const point = (day: number, signed: number) => ({
    bucketStart: `2026-10-${String(day).padStart(2, "0")}`,
    startsAt: "2026-10-01T00:00:00.000Z",
    endsAt: "2026-10-02T00:00:00.000Z",
    partial: false,
    received: 2,
    signed,
  });
  const agent = (name: PilotageAgentActivity["agent"], blocked = 0, failed = 0): PilotageAgentActivity => ({
    agent: name,
    runs: { total: blocked + failed, succeeded: 0, blocked, failed, running: 0 },
    recordedActions: 10,
    lastActivityAt: null,
  });
  return {
    generatedAt: "2026-10-12T10:00:00.000Z",
    period: {
      key,
      granularity: "day",
      timeZone: "Europe/Paris",
      current: { startsAt: "2026-10-06T00:00:00.000Z", endsAt: "2026-10-12T10:00:00.000Z" },
      previous: { startsAt: "2026-09-30T00:00:00.000Z", endsAt: "2026-10-06T10:00:00.000Z" },
      historyStartsAt: "2025-10-13T00:00:00.000Z",
      previousCoverage: "full",
    },
    mandates: { status: "ok", value: { value: 5, previous: 3 } },
    requests: { status: "ok", value: { value: 40, previous: 25 } },
    conversion: {
      status: "ok",
      value: {
        current: { numerator: 5, denominator: 40, rate: 0.125 },
        previous: { numerator: 3, denominator: 25, rate: 0.12 },
      },
    },
    firstHandling: {
      status: "ok",
      value: {
        current: { medianMinutes: 200, measured: 30, unhandled: 10, created: 40 },
        previous: { medianMinutes: 247, measured: 20, unhandled: 5, created: 25 },
      },
    },
    withoutNextAction: {
      status: "ok",
      value: { count: 2, openTotal: 10, sample: [{ contactId: "c1", contactName: "Contact test", stage: "qualifie", updatedAt: "2026-10-01T00:00:00.000Z" }] },
    },
    series: {
      status: "ok",
      value: {
        granularity: "day",
        points: [point(6, 1), point(7, 0), point(8, 4)],
        previousPoints: [point(1, 1), point(2, 1), point(3, 1)],
      },
    },
    origins: {
      status: "ok",
      value: [
        { source: "estimation_form", count: 20, previousCount: 10 },
        { source: "website_form", count: 10, previousCount: 10 },
        { source: "inbound_call", count: 6, previousCount: 3 },
        { source: "manual_entry", count: 4, previousCount: 2 },
      ],
    },
    flow: {
      status: "ok",
      value: {
        entrants: 40,
        steps: [
          { stage: "nouveau", reached: 40 },
          { stage: "qualifie", reached: 30 },
          { stage: "chaud", reached: 20 },
          { stage: "rdv_planifie", reached: 12 },
          { stage: "estimation_faite", reached: 8 },
          { stage: "mandat_signe", reached: 5 },
        ],
        signed: 5,
        inProgress: 25,
        lost: {
          total: 10,
          byFurthestStage: { nouveau: 3, qualifie: 3, chaud: 2, rdv_planifie: 1, estimation_faite: 1, mandat_signe: 0 },
          untraced: 1,
          reasons: { available: false, recorded: 0 },
        },
      },
    },
    agents: {
      status: "ok",
      value: { paused: false, agents: [agent("lea"), agent("hugo", 3), agent("emma", 0, 1), agent("louis"), agent("sarah")] },
    },
    ...override,
  };
}
