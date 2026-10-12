import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { setupTestEnv, type TestEnv, type TypedClient } from "@/lib/supabase/testing/local-test-env";

import { buildDashboardPilotage } from "./pilotage";
import { resolvePilotagePeriod, type PilotagePeriodKey } from "./pilotage-periods";
import type { DashboardPilotage, PilotageBlock } from "./pilotage-types";

/**
 * The boss's statistics page against the LOCAL Supabase stack, with real
 * sessions (RLS applies). Two fictitious agencies with rows dated by hand.
 *
 * The period blocks are read "as of" an instant 400 days in the past: the test
 * environment's own baseline rows (created just now) are then after the read
 * instant and cannot disturb an exact figure. The snapshot blocks (dossiers
 * without a next action, agents) are read now, and compared by DIFFERENCE with
 * a read taken before the test rows were inserted.
 *
 * Covered: exact figures of every block for 30 days with the previous period,
 * the human-only rule for signed mandates (an agent's forged entry is ignored),
 * a mandate signed on an old dossier, the isolation A / B on every block, the
 * refusal without session and with an invalid period, the unavailable block
 * and the read times on a year of volume.
 */

let env: TestEnv;
let directorA: TypedClient;
let userB: TypedClient;

const REAL_NOW = new Date();
const PAST_NOW = new Date(REAL_NOW.getTime() - 400 * 86_400_000);
const PERIOD = resolvePilotagePeriod("30d", PAST_NOW);

/** An instant inside the day `back` days before the read instant (0 = the read day), `minutes` after midnight Paris. */
const current = (back: number, minutes: number): string =>
  new Date(Date.parse(PERIOD.currentBuckets[29 - back]!.startsAt) + minutes * 60_000).toISOString();
/** Same, for the previous period (bucket `index` counted from its start). */
const previous = (index: number, minutes: number): string =>
  new Date(Date.parse(PERIOD.previousBuckets[index]!.startsAt) + minutes * 60_000).toISOString();

type Stage = "nouveau" | "qualifie" | "chaud" | "rdv_planifie" | "estimation_faite" | "mandat_signe" | "perdu";
type Source = "estimation_form" | "website_form" | "inbound_call" | "inbound_email" | "referral" | "partner_api" | "software_import" | "manual_entry";

async function insertContact(agencyId: string, row: { name: string; stage: Stage; source: Source; createdAt: string }): Promise<string> {
  const { data, error } = await env.admin
    .from("contacts")
    .insert({
      agency_id: agencyId,
      first_name: "Pilotage",
      last_name: row.name,
      source: row.source,
      stage: row.stage,
      created_at: row.createdAt,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`insertContact ${row.name}: ${error?.message}`);
  return data.id;
}

type ActivityInput = {
  contactId: string;
  type: string;
  at: string;
  actor: "user" | "ai_agent";
  agent?: "lea" | "hugo" | "emma" | "louis" | "sarah";
  userId?: string;
  payload?: Record<string, unknown>;
};

async function insertActivities(agencyId: string, rows: ActivityInput[]): Promise<void> {
  const { error } = await env.admin.from("activities").insert(
    rows.map((row) => ({
      agency_id: agencyId,
      contact_id: row.contactId,
      type: row.type,
      summary: "Donnée de test (simulation).",
      payload: (row.payload ?? {}) as never,
      actor_type: row.actor,
      ...(row.actor === "ai_agent" ? { actor_agent: row.agent ?? ("hugo" as const) } : { actor_user_id: row.userId }),
      is_simulation: true,
      occurred_at: row.at,
    })),
  );
  if (error) throw new Error(`insertActivities: ${error.message}`);
}

function ok<T>(block: PilotageBlock<T>): T {
  if (block.status !== "ok") throw new Error("block unavailable");
  return block.value;
}

async function pilotage(client: TypedClient, key: PilotagePeriodKey, now: Date): Promise<DashboardPilotage> {
  const result = await buildDashboardPilotage(client, key, now);
  if (result.error) throw new Error(`pilotage: ${result.error.code}`);
  return result.data;
}

let beforeSnapshot: DashboardPilotage;
let afterSnapshot: DashboardPilotage;

beforeAll(async () => {
  env = await setupTestEnv();
  directorA = env.users.directorA.client;
  userB = env.users.userB.client;
  const director = env.users.directorA.id;
  const agencyA = env.agencyA.agencyId;
  const agencyB = env.agencyB.agencyId;

  // Taken before any row of this file exists: the baseline of the snapshot blocks.
  beforeSnapshot = await pilotage(directorA, "30d", REAL_NOW);

  // --- Agency A, current period --------------------------------------------------
  const c1 = await insertContact(agencyA, { name: "C1", stage: "mandat_signe", source: "referral", createdAt: current(10, 9 * 60) });
  const c2 = await insertContact(agencyA, { name: "C2", stage: "chaud", source: "estimation_form", createdAt: current(5, 10 * 60) });
  const c3 = await insertContact(agencyA, { name: "C3", stage: "perdu", source: "inbound_call", createdAt: current(5, 15 * 60) });
  await insertContact(agencyA, { name: "C4", stage: "nouveau", source: "website_form", createdAt: current(0, 10) });
  // --- Agency A, previous period ----------------------------------------------------
  const p1 = await insertContact(agencyA, { name: "P1", stage: "mandat_signe", source: "estimation_form", createdAt: previous(3, 9 * 60) });
  const p2 = await insertContact(agencyA, { name: "P2", stage: "perdu", source: "referral", createdAt: previous(8, 9 * 60) });
  await insertContact(agencyA, { name: "P3", stage: "nouveau", source: "referral", createdAt: previous(8, 11 * 60) });
  // --- Agency A, older dossiers: a mandate signed now on an old dossier; one outside both periods ----
  const o1 = await insertContact(agencyA, {
    name: "O1",
    stage: "mandat_signe",
    source: "manual_entry",
    createdAt: new Date(PAST_NOW.getTime() - 300 * 86_400_000).toISOString(),
  });
  const o2 = await insertContact(agencyA, {
    name: "O2",
    stage: "mandat_signe",
    source: "manual_entry",
    createdAt: new Date(PAST_NOW.getTime() - 200 * 86_400_000).toISOString(),
  });

  await insertActivities(agencyA, [
    // Handling: c1 after 30 min, c2 after 60 min, c3 after 120 min (Hugo); c4 untouched.
    { contactId: c1, type: "contact_created_from_lead", at: current(10, 9 * 60 + 1), actor: "ai_agent", agent: "lea" },
    { contactId: c1, type: "ai_qualification_done", at: current(10, 9 * 60 + 30), actor: "ai_agent", payload: { previous_stage: "nouveau", stage: "qualifie" } },
    { contactId: c2, type: "ai_qualification_done", at: current(5, 11 * 60), actor: "ai_agent", payload: { previous_stage: "nouveau", stage: "chaud" } },
    { contactId: c3, type: "ai_qualification_done", at: current(5, 17 * 60), actor: "ai_agent", payload: { previous_stage: "nouveau", stage: "qualifie" } },
    { contactId: c3, type: "ai_qualification_done", at: current(4, 17 * 60), actor: "ai_agent", payload: { previous_stage: "qualifie", stage: "chaud" } },
    // Signed mandates (human): c1 on day -2, the old dossier o2 on day -3.
    { contactId: c1, type: "mandate_signed", at: current(2, 14 * 60), actor: "user", userId: director },
    { contactId: o2, type: "mandate_signed", at: current(3, 11 * 60), actor: "user", userId: director },
    // An AI agent "signing" is ignored.
    { contactId: c2, type: "mandate_signed", at: current(1, 9 * 60), actor: "ai_agent", agent: "sarah" },
    // Previous period: p1 handled after 600 min then signed; p2 flagged by Hugo after 60 min.
    { contactId: p1, type: "appointment_confirmed", at: previous(3, 19 * 60), actor: "user", userId: director },
    { contactId: p1, type: "mandate_signed", at: previous(20, 10 * 60), actor: "user", userId: director },
    { contactId: p2, type: "ai_information_missing", at: previous(8, 10 * 60), actor: "ai_agent", payload: { missing: ["motivation"] } },
    // Outside both periods: a mandate 100 days before the read instant.
    { contactId: o1, type: "mandate_signed", at: new Date(PAST_NOW.getTime() - 100 * 86_400_000).toISOString(), actor: "user", userId: director },
  ]);

  // --- Agency B: its own, different shape -----------------------------------------------
  const b1 = await insertContact(agencyB, { name: "B1", stage: "mandat_signe", source: "partner_api", createdAt: current(3, 9 * 60) });
  await insertContact(agencyB, { name: "B2", stage: "nouveau", source: "partner_api", createdAt: current(3, 11 * 60) });
  await insertActivities(agencyB, [
    { contactId: b1, type: "mandate_signed", at: current(1, 10 * 60), actor: "user", userId: env.users.userB.id },
    { contactId: b1, type: "ai_qualification_done", at: current(3, 9 * 60 + 15), actor: "ai_agent", payload: { previous_stage: "nouveau", stage: "chaud" } },
  ]);

  // --- Snapshot rows (real time): dossiers with and without a next action ---------------------
  const now = REAL_NOW.toISOString();
  const s1 = await insertContact(agencyA, { name: "S1 seul", stage: "nouveau", source: "manual_entry", createdAt: now });
  const s2 = await insertContact(agencyA, { name: "S2 tâche", stage: "qualifie", source: "manual_entry", createdAt: now });
  const s3 = await insertContact(agencyA, { name: "S3 rdv", stage: "chaud", source: "manual_entry", createdAt: now });
  const s4 = await insertContact(agencyA, { name: "S4 brouillon", stage: "rdv_planifie", source: "manual_entry", createdAt: now });
  await insertContact(agencyA, { name: "S5 clos", stage: "perdu", source: "manual_entry", createdAt: now });
  expect(s1).toBeTruthy();

  const task = await env.admin.from("tasks").insert({
    agency_id: agencyA,
    contact_id: s2,
    type: "call_back_seller",
    title: "Rappeler le vendeur",
  });
  if (task.error) throw new Error(`task: ${task.error.message}`);
  const appointment = await env.admin.from("appointments").insert({
    agency_id: agencyA,
    contact_id: s3,
    assigned_user_id: director,
    status: "confirmed",
    is_simulation: true,
    starts_at: new Date(REAL_NOW.getTime() + 2 * 86_400_000).toISOString(),
    ends_at: new Date(REAL_NOW.getTime() + 2 * 86_400_000 + 3_600_000).toISOString(),
  });
  if (appointment.error) throw new Error(`appointment: ${appointment.error.message}`);
  const draft = await env.admin.from("outbound_messages").insert({
    agency_id: agencyA,
    contact_id: s4,
    channel: "email",
    subject: "Test",
    body: "Bonjour, ceci est un test.\n\nPour ne plus recevoir nos messages, répondez STOP.",
    status: "pending_validation",
    is_simulation: true,
    created_by_agent: "emma",
    idempotency_key: `pilotage-test-${env.runId}`,
  });
  if (draft.error) throw new Error(`draft: ${draft.error.message}`);

  // A recent agent entry, for the agents block.
  await insertActivities(agencyA, [
    { contactId: s2, type: "ai_qualification_done", at: new Date(REAL_NOW.getTime() - 3_600_000).toISOString(), actor: "ai_agent", payload: { previous_stage: "nouveau", stage: "qualifie" } },
  ]);

  afterSnapshot = await pilotage(directorA, "30d", REAL_NOW);
}, 180_000);

afterAll(async () => {
  await env?.cleanup();
});

describe("getDashboardPilotage — agency A, 30 days as of 400 days ago (exact figures)", () => {
  let result: DashboardPilotage;
  beforeAll(async () => {
    result = await pilotage(directorA, "30d", PAST_NOW);
  });

  it("describes the period and its previous period", () => {
    expect(result.period.key).toBe("30d");
    expect(result.period.granularity).toBe("day");
    expect(result.period.timeZone).toBe("Europe/Paris");
    expect(result.period.current).toEqual(PERIOD.current);
    expect(result.period.previous).toEqual(PERIOD.previous);
    expect(result.generatedAt).toBe(PAST_NOW.toISOString());
  });

  it("counts the requests received in the period and in the previous one", () => {
    expect(ok(result.requests)).toEqual({ value: 4, previous: 3 });
  });

  it("counts the mandates confirmed by a human, including one signed on an old dossier, ignoring an agent's entry", () => {
    // current: c1 (day -2) and the old dossier o2 (day -3); c2's « signature » by an agent is ignored.
    // previous: p1; the mandate 100 days before is outside both.
    expect(ok(result.mandates)).toEqual({ value: 2, previous: 1 });
  });

  it("computes the conversion with its numerator and denominator", () => {
    const conversion = ok(result.conversion);
    expect(conversion.current).toEqual({ numerator: 2, denominator: 4, rate: 0.5 });
    expect(conversion.previous).toEqual({ numerator: 1, denominator: 3, rate: 1 / 3 });
  });

  it("measures the median first handling delay and counts the dossiers nobody touched", () => {
    const handling = ok(result.firstHandling);
    // current: c1 30 min (Léa's creation entry is ignored), c2 60, c3 120; c4 not handled.
    expect(handling.current).toEqual({ medianMinutes: 60, measured: 3, unhandled: 1, created: 4 });
    // previous: p1 600 min, p2 60 min; p3 not handled.
    expect(handling.previous).toEqual({ medianMinutes: 330, measured: 2, unhandled: 1, created: 3 });
  });

  it("builds the daily series, the previous one aligned with it, and their sums are the totals", () => {
    const series = ok(result.series);
    expect(series.granularity).toBe("day");
    expect(series.points).toHaveLength(30);
    expect(series.previousPoints).toHaveLength(30);
    const at = (back: number) => series.points[29 - back]!;
    expect(at(10)).toMatchObject({ received: 1, signed: 0 });
    expect(at(5)).toMatchObject({ received: 2, signed: 0 });
    expect(at(3)).toMatchObject({ received: 0, signed: 1 });
    expect(at(2)).toMatchObject({ received: 0, signed: 1 });
    expect(at(1).signed).toBe(0); // the agent's entry
    expect(at(0)).toMatchObject({ received: 1, signed: 0, partial: true });
    expect(series.points.reduce((sum, point) => sum + point.received, 0)).toBe(ok(result.requests).value);
    expect(series.points.reduce((sum, point) => sum + point.signed, 0)).toBe(ok(result.mandates).value);
    expect(series.previousPoints.reduce((sum, point) => sum + point.received, 0)).toBe(ok(result.requests).previous);
    expect(series.previousPoints.reduce((sum, point) => sum + point.signed, 0)).toBe(ok(result.mandates).previous);
    expect(series.previousPoints[3]).toMatchObject({ received: 1, signed: 0 });
    expect(series.previousPoints[8]!.received).toBe(2);
    expect(series.previousPoints[20]!.signed).toBe(1);
    expect(series.points[0]!.startsAt).toBe(PERIOD.current.startsAt);
    expect(series.previousPoints[0]!.startsAt).toBe(PERIOD.previous.startsAt);
  });

  it("gives the origins of the requests with the previous counts", () => {
    expect(ok(result.origins)).toEqual([
      { source: "referral", count: 1, previousCount: 2 },
      { source: "estimation_form", count: 1, previousCount: 1 },
      { source: "inbound_call", count: 1, previousCount: 0 },
      { source: "website_form", count: 1, previousCount: 0 },
    ]);
  });

  it("follows the dossiers created in the period to where they stand", () => {
    const flow = ok(result.flow);
    expect(flow.entrants).toBe(4);
    expect(flow.steps.map((step) => [step.stage, step.reached])).toEqual([
      ["nouveau", 4],
      ["qualifie", 3],
      ["chaud", 3],
      ["rdv_planifie", 1],
      ["estimation_faite", 1],
      ["mandat_signe", 1],
    ]);
    expect(flow.signed).toBe(1);
    expect(flow.inProgress).toBe(2);
    expect(flow.lost.total).toBe(1);
    expect(flow.lost.byFurthestStage.chaud).toBe(1); // c3, through its recorded history
    expect(flow.lost.untraced).toBe(0);
    expect(flow.lost.reasons).toEqual({ available: false, recorded: 0 });
  });

  it("knows when the history starts (the oldest dossier) and that it covers the previous period", () => {
    // The oldest dossier of the file was created 300 days before the read instant.
    expect(result.period.historyStartsAt).toBe(new Date(PAST_NOW.getTime() - 300 * 86_400_000).toISOString());
    expect(result.period.previousCoverage).toBe("full");
    // Agency B's history starts inside the period: the previous one is not covered.
    // (checked in the isolation block)
  });

  it("gives every member of the agency the same figures", async () => {
    const asAgent = await pilotage(env.users.agentA.client, "30d", PAST_NOW);
    expect(asAgent.requests).toEqual(result.requests);
    expect(asAgent.mandates).toEqual(result.mandates);
    expect(asAgent.series).toEqual(result.series);
  });

  it("answers for the four periods, each with its own buckets", async () => {
    const expected: Record<PilotagePeriodKey, [string, number]> = { "7d": ["day", 7], "30d": ["day", 30], "90d": ["week", 13], "365d": ["month", 12] };
    for (const key of Object.keys(expected) as PilotagePeriodKey[]) {
      const data = await pilotage(directorA, key, PAST_NOW);
      const series = ok(data.series);
      expect(series.granularity).toBe(expected[key][0]);
      expect(series.points).toHaveLength(expected[key][1]);
      expect(series.previousPoints).toHaveLength(expected[key][1]);
      // The sums of the series are always the totals of the blocks.
      expect(series.points.reduce((sum, point) => sum + point.received, 0)).toBe(ok(data.requests).value);
      expect(series.points.reduce((sum, point) => sum + point.signed, 0)).toBe(ok(data.mandates).value);
    }
    // 1 year as of 400 days ago: every row of the file is in the year or the one before.
    const year = await pilotage(directorA, "365d", PAST_NOW);
    expect(ok(year.requests).value).toBeGreaterThanOrEqual(9);
  });
});

describe("getDashboardPilotage — snapshot blocks (read now)", () => {
  it("counts the open dossiers with no task, no upcoming appointment and no draft (difference with the read before the rows)", () => {
    const before = ok(beforeSnapshot.withoutNextAction);
    const after = ok(afterSnapshot.withoutNextAction);
    // Open dossiers added: C2 (chaud), C4 (nouveau), P3 (nouveau), S1..S4. Closed ones (signed, lost) are not counted.
    expect(after.openTotal - before.openTotal).toBe(7);
    // Without next action: C2, C4, P3 and S1. S2 has a task, S3 an appointment, S4 a draft.
    expect(after.count - before.count).toBe(4);
    expect(after.sample.length).toBeLessThanOrEqual(5);
    expect(after.sample.every((item) => item.contactName.length > 0)).toBe(true);
  });

  it("gives the five agents in order with the entries of the period, the last activity and the kill switch", () => {
    const agents = ok(afterSnapshot.agents);
    expect(agents.paused).toBe(false);
    expect(agents.agents.map((agent) => agent.agent)).toEqual(["lea", "hugo", "emma", "louis", "sarah"]);
    const hugo = agents.agents[1]!;
    const hugoBefore = ok(beforeSnapshot.agents).agents[1]!;
    expect(hugo.recordedActions - hugoBefore.recordedActions).toBe(1); // the entry one hour ago
    expect(hugo.lastActivityAt).not.toBeNull();
    expect(Date.parse(hugo.lastActivityAt!)).toBeGreaterThanOrEqual(REAL_NOW.getTime() - 3_600_000);
    for (const agent of agents.agents) {
      const { total, succeeded, blocked, failed, running } = agent.runs;
      expect(succeeded + blocked + failed + running).toBe(total);
    }
  });

  it("reflects the kill switch of the agency", async () => {
    const pause = await env.admin.from("agencies").update({ ai_paused: true }).eq("id", env.agencyA.agencyId);
    if (pause.error) throw new Error(pause.error.message);
    try {
      expect(ok((await pilotage(directorA, "7d", REAL_NOW)).agents).paused).toBe(true);
    } finally {
      await env.admin.from("agencies").update({ ai_paused: false }).eq("id", env.agencyA.agencyId);
    }
    expect(ok((await pilotage(directorA, "7d", REAL_NOW)).agents).paused).toBe(false);
  });
});

describe("getDashboardPilotage — isolation between agencies", () => {
  it("gives B only its own figures, on every block", async () => {
    const b = await pilotage(userB, "30d", PAST_NOW);
    expect(ok(b.requests)).toEqual({ value: 2, previous: 0 });
    expect(ok(b.mandates)).toEqual({ value: 1, previous: 0 });
    expect(ok(b.conversion).current).toEqual({ numerator: 1, denominator: 2, rate: 0.5 });
    expect(ok(b.origins)).toEqual([{ source: "partner_api", count: 2, previousCount: 0 }]);
    const handling = ok(b.firstHandling);
    expect(handling.current).toEqual({ medianMinutes: 15, measured: 1, unhandled: 1, created: 2 });
    expect(handling.previous).toEqual({ medianMinutes: null, measured: 0, unhandled: 0, created: 0 });
    const flow = ok(b.flow);
    expect(flow.entrants).toBe(2);
    expect(flow.signed).toBe(1);
    // B's history starts inside the period: nothing to compare with before it.
    expect(b.period.previousCoverage).toBe("none");
    const series = ok(b.series);
    expect(series.points[29 - 3]!.received).toBe(2);
    expect(series.points[29 - 1]!.signed).toBe(1);
    expect(series.points.reduce((sum, point) => sum + point.signed, 0)).toBe(1);
  });

  it("keeps B's rows out of A and A's rows out of B (snapshot blocks included)", async () => {
    const a = await pilotage(directorA, "30d", PAST_NOW);
    expect(ok(a.origins).some((origin) => origin.source === "partner_api")).toBe(false);
    const bSnapshot = await pilotage(userB, "30d", REAL_NOW);
    // B has no dossier of A's story: it never sees the 4 open dossiers without next action added to A.
    const bAlone = ok(bSnapshot.withoutNextAction);
    expect(bAlone.sample.some((item) => item.contactName.startsWith("Pilotage S"))).toBe(false);
    expect(ok(bSnapshot.agents).agents.find((agent) => agent.agent === "hugo")!.recordedActions).toBe(0);
  });
});

describe("getDashboardPilotage — refusals", () => {
  it("refuses a request without session", async () => {
    const result = await buildDashboardPilotage(env.anon, "30d", PAST_NOW);
    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("not_authenticated");
  });

  it("refuses a period that is not one of the four, before any read", async () => {
    for (const bad of ["1y", "14d", "", "7d ", 30] as unknown[]) {
      const result = await buildDashboardPilotage(directorA, bad as PilotagePeriodKey, PAST_NOW);
      expect(result.data, String(bad)).toBeNull();
      expect(result.error?.code).toBe("invalid_period");
      expect(result.error?.message).toContain("Période invalide");
    }
  });

  it("turns a failing block into « unavailable » without hiding the others", async () => {
    // A client whose `rpc` fails: the agents block (which relies on it) is unavailable, the rest stays.
    const failingRpc = new Proxy(directorA, {
      get(target, property, receiver) {
        if (property === "rpc") return () => Promise.resolve({ data: null, error: { message: "boom", code: "XX000" } });
        return Reflect.get(target, property, receiver);
      },
    }) as TypedClient;
    const data = await pilotage(failingRpc, "30d", PAST_NOW);
    expect(data.agents).toEqual({ status: "unavailable" });
    expect(data.requests.status).toBe("ok");
    expect(data.mandates.status).toBe("ok");
    expect(data.flow.status).toBe("ok");
  });
});
