import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { parisDayKey, parisWindowStart } from "@/lib/agents/time";
import { setupTestEnv, type TestEnv, type TypedClient } from "@/lib/supabase/testing/local-test-env";

import { buildDashboardDailySeries } from "./data";
import type { DashboardDailySeries } from "./types";

/**
 * The 30-day series against the LOCAL Supabase stack, with real sessions (RLS
 * applies). Two fictitious agencies, rows dated by hand:
 *   * every figure equals what was inserted, day by day, in the Paris calendar;
 *   * the edge of the window and of the day (just before / after midnight Paris)
 *     is respected, whatever the clock offset on the day the test runs;
 *   * a dossier is « qualified » once; other activity types, other transitions
 *     and activities outside the window are not counted;
 *   * agency A never sees B's rows in the series, and back.
 */

let env: TestEnv;
let directorA: TypedClient;
let agentA: TypedClient;
let userB: TypedClient;

/** Read AFTER the test setup: the baseline contacts it creates are already in the past. */
let NOW = new Date();

/** An instant `minutes` after midnight Paris of the day `back` days ago (0 = today). */
function parisInstant(back: number, minutes: number): string {
  return new Date(parisWindowStart(back + 1, NOW).getTime() + minutes * 60_000).toISOString();
}

/** One minute before the midnight that ends the day `back` days ago (a day is 23 h or 25 h twice a year). */
function justBeforeMidnight(back: number): string {
  return new Date(parisWindowStart(back, NOW).getTime() - 60_000).toISOString();
}

type Contact = { id: string };

async function insertContacts(agencyId: string, createdAt: string[]): Promise<Contact[]> {
  const { data, error } = await env.admin
    .from("contacts")
    .insert(
      createdAt.map((instant, index) => ({
        agency_id: agencyId,
        first_name: "Série",
        last_name: `Test ${index}`,
        source: "estimation_form" as const,
        created_at: instant,
      })),
    )
    .select("id");
  if (error || !data) throw new Error(`insertContacts: ${error?.message ?? "no rows"}`);
  return data;
}

async function insertMoves(
  agencyId: string,
  moves: Array<{
    contactId: string;
    at: string;
    type?: string;
    previous?: string;
    stage?: string;
  }>,
): Promise<void> {
  const { error } = await env.admin.from("activities").insert(
    moves.map((move) => ({
      agency_id: agencyId,
      contact_id: move.contactId,
      type: move.type ?? "ai_qualification_done",
      summary: "Mouvement de test (simulation).",
      payload: { agent: "hugo", previous_stage: move.previous ?? "nouveau", stage: move.stage ?? "qualifie" },
      actor_type: "ai_agent" as const,
      actor_agent: "hugo" as const,
      is_simulation: true,
      occurred_at: move.at,
    })),
  );
  if (error) throw new Error(`insertMoves: ${error.message}`);
}

async function seriesOf(client: TypedClient): Promise<Extract<DashboardDailySeries, { status: "ok" }>> {
  const result = await buildDashboardDailySeries(client, NOW);
  if (result.error) throw new Error(`series: ${result.error.code}`);
  if (result.data.status !== "ok") throw new Error("series unavailable");
  return result.data;
}

function pointOf(series: Extract<DashboardDailySeries, { status: "ok" }>, back: number) {
  const key = parisDayKey(parisWindowStart(back + 1, NOW));
  const point = series.points.find((candidate) => candidate.date === key);
  if (!point) throw new Error(`no point for ${key}`);
  return point;
}

beforeAll(async () => {
  env = await setupTestEnv();
  NOW = new Date();
  directorA = env.users.directorA.client;
  agentA = env.users.agentA.client;
  userB = env.users.userB.client;

  // --- Agency A: received -----------------------------------------------------
  //  day -2: 3 requests (morning, noon, evening)
  //  day -4: 1 just AFTER midnight Paris, and 1 just BEFORE it (belongs to day -5)
  //  day -29: 1 (first day of the window), day -30: 1 (outside)
  const received = await insertContacts(env.agencyA.agencyId, [
    parisInstant(2, 8 * 60 + 12),
    parisInstant(2, 12 * 60 + 41),
    parisInstant(2, 18 * 60 + 5),
    parisInstant(4, 30),
    justBeforeMidnight(5),
    parisInstant(29, 9 * 60),
    parisInstant(30, 9 * 60),
  ]);

  // --- Agency A: qualified ------------------------------------------------------
  const [c1, c2, c3, c4] = [received[0]!, received[1]!, received[2]!, received[3]!];
  await insertMoves(env.agencyA.agencyId, [
    { contactId: c1.id, at: parisInstant(2, 9 * 60) }, // counted on day -2
    { contactId: c1.id, at: parisInstant(1, 9 * 60), previous: "nouveau", stage: "chaud" }, // same dossier again: ignored (first move wins)
    { contactId: c2.id, at: parisInstant(1, 10 * 60 + 3), stage: "chaud" }, // counted on day -1
    { contactId: c3.id, at: parisInstant(1, 14 * 60), type: "ai_follow_through_done", stage: "estimation_faite" }, // counted on day -1
    { contactId: c4.id, at: parisInstant(4, 25) }, // just after midnight: day -4
    // Not counted:
    { contactId: c2.id, at: parisInstant(3, 9 * 60), previous: "qualifie", stage: "chaud" }, // not leaving nouveau
    { contactId: c3.id, at: parisInstant(3, 9 * 60), stage: "perdu" }, // leaving nouveau for lost is not a qualification
    { contactId: c4.id, at: parisInstant(3, 9 * 60), type: "note_added" }, // another activity type
    { contactId: c1.id, at: parisInstant(30, 9 * 60) }, // outside the window
  ]);

  // --- Agency B: its own, different shape -----------------------------------------
  const b = await insertContacts(env.agencyB.agencyId, [
    parisInstant(2, 9 * 60),
    parisInstant(2, 10 * 60),
    parisInstant(2, 11 * 60),
    parisInstant(2, 12 * 60),
    parisInstant(6, 9 * 60),
  ]);
  await insertMoves(env.agencyB.agencyId, [
    { contactId: b[0]!.id, at: parisInstant(2, 15 * 60) },
    { contactId: b[1]!.id, at: parisInstant(2, 16 * 60) },
    { contactId: b[2]!.id, at: parisInstant(6, 16 * 60) },
  ]);
}, 120_000);

afterAll(async () => {
  await env?.cleanup();
});

describe("buildDashboardDailySeries (real sessions)", () => {
  it("returns 30 Paris days, today last, with the window boundaries", async () => {
    const series = await seriesOf(directorA);
    expect(series.points).toHaveLength(30);
    expect(series.points[29]!.date).toBe(parisDayKey(NOW));
    expect(series.scope).toMatchObject({ key: "last_30_days", days: 30, timeZone: "Europe/Paris" });
    expect(series.scope.startsAt).toBe(parisWindowStart(30, NOW).toISOString());
  });

  it("counts the received requests day by day, edges of the Paris day included", async () => {
    const series = await seriesOf(directorA);
    expect(pointOf(series, 2).received).toBe(3);
    expect(pointOf(series, 4).received).toBe(1); // 00:30 Paris
    expect(pointOf(series, 5).received).toBe(1); // 23:59 Paris
    expect(pointOf(series, 29).received).toBe(1); // first day of the window
    // Today also holds the 2 baseline contacts created by the test setup.
    expect(pointOf(series, 0).received).toBe(2);
    // The contact of day -30 is outside the window: 3 + 1 + 1 + 1 + 2.
    expect(series.totals.received).toBe(8);
  });

  it("counts the qualified dossiers once, only for a move out of « nouveau » towards a qualified stage", async () => {
    const series = await seriesOf(directorA);
    expect(pointOf(series, 2).qualified).toBe(1); // c1's first move
    expect(pointOf(series, 1).qualified).toBe(2); // c2 and c3 (c1's second move is ignored)
    expect(pointOf(series, 4).qualified).toBe(1);
    expect(pointOf(series, 3).qualified).toBe(0);
    expect(series.totals.qualified).toBe(4);
  });

  it("shows a quiet day as a real 0 and the sums are the sums of the points", async () => {
    const series = await seriesOf(directorA);
    expect(pointOf(series, 10)).toEqual({ date: expect.any(String), received: 0, qualified: 0 });
    expect(series.totals.received).toBe(series.points.reduce((sum, point) => sum + point.received, 0));
    expect(series.totals.qualified).toBe(series.points.reduce((sum, point) => sum + point.qualified, 0));
  });

  it("gives every member of the agency the same series", async () => {
    expect((await seriesOf(agentA)).points).toEqual((await seriesOf(directorA)).points);
  });

  it("isolates the agencies: B sees only its own rows, and A none of B's", async () => {
    const seriesB = await seriesOf(userB);
    expect(pointOf(seriesB, 2).received).toBe(4);
    expect(pointOf(seriesB, 6).received).toBe(1);
    expect(pointOf(seriesB, 0).received).toBe(2); // its own baseline contacts
    expect(seriesB.totals.received).toBe(7);
    expect(pointOf(seriesB, 2).qualified).toBe(2);
    expect(pointOf(seriesB, 6).qualified).toBe(1);
    expect(seriesB.totals.qualified).toBe(3);
    // Nothing of A's story in B.
    expect(pointOf(seriesB, 4).received).toBe(0);
    expect(pointOf(seriesB, 1).qualified).toBe(0);

    const seriesA = await seriesOf(directorA);
    expect(pointOf(seriesA, 6).received).toBe(0);
    expect(pointOf(seriesA, 2).received).toBe(3);
  });

  it("refuses a request without session", async () => {
    const result = await buildDashboardDailySeries(env.anon, NOW);
    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("not_authenticated");
  });
});
