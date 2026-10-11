import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildDashboardSummary } from "@/features/dashboard/data";
import { setupTestEnv, type TestEnv, type TypedClient } from "@/lib/supabase/testing/local-test-env";

import { listAppointments } from "./data";
import type { AppointmentListItem, AppointmentsInput } from "./types";

/**
 * The `/rendez-vous` data layer against the LOCAL Supabase stack, with real
 * sessions (RLS applies). `getAppointments()` only builds the request-scoped
 * client, so the read itself is exercised here.
 *
 * What is proved:
 *   * « à venir » is exactly the dashboard's `upcomingAppointments` (same `now`),
 *     with an exact total above one page (> 100);
 *   * it excludes cancelled, done and past appointments;
 *   * « passés » holds every appointment started before now, whatever its
 *     status, most recent first, with an exact total;
 *   * the action flags follow the follow-through screen's rules;
 *   * agency A never sees an appointment of agency B, and back;
 *   * an anonymous caller is refused.
 */

let env: TestEnv;
let agentA: TypedClient;
let userB: TypedClient;

/** More than the largest page (100). */
const EXTRA_UPCOMING_A = 105;
const HOUR = 3_600_000;

const ids = {
  cancelledFutureA: "",
  doneFutureA: "",
  pastProposedA: "",
  pastConfirmedA: "",
  pastCancelledA: "",
  pastDoneA: "",
  confirmableA: "",
  futureB: "",
  pastB: "",
};

type Status = "proposed" | "confirmed" | "cancelled" | "done";

type AppointmentSeed = { contactId: string; startsAt: number; status: Status };

/** Inserts the rows and returns their ids, in the order of `rows` (matched by start). */
async function insertAppointments<const Rows extends readonly AppointmentSeed[]>(
  agency: "a" | "b",
  rows: Rows,
): Promise<{ -readonly [Key in keyof Rows]: string }> {
  const seeded = agency === "a" ? env.agencyA : env.agencyB;
  const { data, error } = await env.admin
    .from("appointments")
    .insert(
      rows.map((row) => ({
        agency_id: seeded.agencyId,
        contact_id: row.contactId,
        assigned_user_id: seeded.directorUserId,
        starts_at: new Date(row.startsAt).toISOString(),
        ends_at: new Date(row.startsAt + HOUR).toISOString(),
        status: row.status,
      })),
    )
    .select("id, starts_at");
  if (error || !data) throw new Error(`insertAppointments: ${error?.message ?? "no rows"}`);
  const idByStart = new Map(data.map((row) => [Date.parse(row.starts_at), row.id]));
  const ids = rows.map((row) => {
    const id = idByStart.get(row.startsAt);
    if (!id) throw new Error("insertAppointments: inserted row not found");
    return id;
  });
  return ids as { -readonly [Key in keyof Rows]: string };
}

type CountQuery = PromiseLike<{ count: number | null; error: { message: string } | null }> & {
  in(column: string, values: readonly string[]): CountQuery;
  gte(column: string, value: string): CountQuery;
  lt(column: string, value: string): CountQuery;
};

async function directCount(agencyId: string, apply: (query: CountQuery) => CountQuery): Promise<number> {
  const base = env.admin
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("agency_id", agencyId) as unknown as CountQuery;
  const { count, error } = await apply(base);
  if (error || typeof count !== "number") throw new Error(`directCount: ${error?.message ?? "no count"}`);
  return count;
}

async function list(client: TypedClient, input: AppointmentsInput, now: Date) {
  const result = await listAppointments(client, input, now);
  if (result.error) throw new Error(`listAppointments: ${result.error.code}`);
  return result.data;
}

async function listAll(client: TypedClient, view: "upcoming" | "past", now: Date): Promise<AppointmentListItem[]> {
  const items: AppointmentListItem[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await list(client, { view, limit: 100, offset }, now);
    items.push(...page.items);
    if (!page.hasMore) return items;
  }
}

async function dashboardUpcoming(client: TypedClient, now: Date): Promise<number> {
  const summary = await buildDashboardSummary(client, now);
  if (summary.error) throw new Error(`buildDashboardSummary: ${summary.error.code}`);
  const indicator = summary.data.upcomingAppointments;
  if (indicator.status !== "ok") throw new Error("upcomingAppointments unavailable");
  return indicator.value.total;
}

beforeAll(async () => {
  env = await setupTestEnv();
  agentA = env.users.agentA.client;
  userB = env.users.userB.client;

  // A qualified contact: its `proposed` appointment is confirmable.
  const qualified = await env.admin
    .from("contacts")
    .insert({
      agency_id: env.agencyA.agencyId,
      first_name: "Qualifié",
      last_name: "Test",
      source: "manual_entry",
      stage: "qualifie",
    })
    .select("id")
    .single();
  if (qualified.error || !qualified.data) throw new Error(`insert contact: ${qualified.error?.message}`);
  const qualifiedId = qualified.data.id;
  const contactA = env.agencyA.contactId; // stage `nouveau`: not confirmable.

  // > 100 upcoming appointments of A, one hour apart (no overlap), from 2031.
  const upcomingStart = Date.parse("2031-01-06T08:00:00Z");
  await insertAppointments(
    "a",
    Array.from({ length: EXTRA_UPCOMING_A }, (_, index) => ({
      contactId: contactA,
      startsAt: upcomingStart + index * 2 * HOUR,
      status: (index % 2 === 0 ? "proposed" : "confirmed") as Status,
    })),
  );

  const futureMisc = Date.parse("2032-03-01T08:00:00Z");
  [ids.cancelledFutureA, ids.doneFutureA, ids.confirmableA] = await insertAppointments("a", [
    { contactId: contactA, startsAt: futureMisc, status: "cancelled" },
    { contactId: contactA, startsAt: futureMisc + 2 * HOUR, status: "done" },
    { contactId: qualifiedId, startsAt: futureMisc + 4 * HOUR, status: "proposed" },
  ]);

  const pastStart = Date.parse("2026-01-05T08:00:00Z");
  [ids.pastProposedA, ids.pastConfirmedA, ids.pastCancelledA, ids.pastDoneA] = await insertAppointments("a", [
    { contactId: contactA, startsAt: pastStart, status: "proposed" },
    { contactId: contactA, startsAt: pastStart + 2 * HOUR, status: "confirmed" },
    { contactId: contactA, startsAt: pastStart + 4 * HOUR, status: "cancelled" },
    { contactId: contactA, startsAt: pastStart + 6 * HOUR, status: "done" },
  ]);

  [ids.futureB, ids.pastB] = await insertAppointments("b", [
    { contactId: env.agencyB.contactId, startsAt: Date.parse("2031-01-06T08:00:00Z"), status: "confirmed" },
    { contactId: env.agencyB.contactId, startsAt: Date.parse("2026-02-02T08:00:00Z"), status: "done" },
  ]);
}, 180_000);

afterAll(async () => {
  if (env) await env.cleanup();
});

describe("Rendez-vous à venir", () => {
  it("total exact > 100, identique au compteur du tableau de bord et à un comptage direct", async () => {
    const now = new Date();
    const page = await list(agentA, { view: "upcoming", limit: 100 }, now);
    const direct = await directCount(env.agencyA.agencyId, (query) =>
      query.in("status", ["proposed", "confirmed"]).gte("starts_at", now.toISOString()),
    );
    // The seeded appointment (2030-01-07, proposed) + the extra ones + the confirmable one.
    expect(direct).toBe(1 + EXTRA_UPCOMING_A + 1);
    expect(page.total).toBe(direct);
    expect(await dashboardUpcoming(agentA, now)).toBe(page.total);
    expect(page.items).toHaveLength(100);
    expect(page.hasMore).toBe(true);
  });

  it("exclut annulés, réalisés et passés ; trie du plus proche au plus lointain", async () => {
    const now = new Date();
    const all = await listAll(agentA, "upcoming", now);
    expect(new Set(all.map((item) => item.id)).size).toBe(all.length);
    const listed = new Set(all.map((item) => item.id));
    for (const excluded of [
      ids.cancelledFutureA,
      ids.doneFutureA,
      ids.pastProposedA,
      ids.pastConfirmedA,
      ids.pastCancelledA,
      ids.pastDoneA,
    ]) {
      expect(listed.has(excluded)).toBe(false);
    }
    for (const item of all) {
      expect(["proposed", "confirmed"]).toContain(item.status);
      expect(Date.parse(item.startsAt)).toBeGreaterThanOrEqual(now.getTime());
      expect(item.isSimulation).toBe(true);
    }
    for (let index = 1; index < all.length; index += 1) {
      expect(Date.parse(all[index]!.startsAt)).toBeGreaterThanOrEqual(Date.parse(all[index - 1]!.startsAt));
    }
  });

  it("drapeaux d'action : mêmes règles que l'écran de suivi des rendez-vous", async () => {
    const all = await listAll(agentA, "upcoming", new Date());
    const confirmable = all.find((item) => item.id === ids.confirmableA)!;
    expect(confirmable).toMatchObject({ status: "proposed", canBeConfirmed: true, canBeCompleted: false });
    expect(confirmable.contactName).toBe("Qualifié Test");

    const seeded = all.find((item) => item.id === env.agencyA.appointmentId)!;
    // Contact still `nouveau`: not confirmable yet.
    expect(seeded).toMatchObject({ status: "proposed", canBeConfirmed: false, canBeCompleted: false });

    const confirmed = all.find((item) => item.status === "confirmed")!;
    expect(confirmed).toMatchObject({ canBeConfirmed: false, canBeCompleted: true });
  });
});

describe("Rendez-vous passés", () => {
  it("tous statuts confondus, du plus récent au plus ancien, total exact", async () => {
    const now = new Date();
    const page = await list(agentA, { view: "past", limit: 100 }, now);
    expect(page.total).toBe(await directCount(env.agencyA.agencyId, (query) => query.lt("starts_at", now.toISOString())));
    expect(page.items.map((item) => item.id)).toEqual([
      ids.pastDoneA,
      ids.pastCancelledA,
      ids.pastConfirmedA,
      ids.pastProposedA,
    ]);
    // A past `confirmed` still needs to be closed: the link stays useful.
    expect(page.items.find((item) => item.id === ids.pastConfirmedA)?.canBeCompleted).toBe(true);
    expect(page.hasMore).toBe(false);
  });

  it("une page au-delà de la fin est vide, avec le total exact", async () => {
    const now = new Date();
    const page = await list(agentA, { view: "past", limit: 10, offset: 5000 }, now);
    expect(page.items).toEqual([]);
    expect(page.total).toBe(4);
  });
});

describe("Isolation entre agences", () => {
  it("l'agence B ne voit que ses rendez-vous, et A jamais ceux de B", async () => {
    const now = new Date();
    const upcomingB = await listAll(userB, "upcoming", now);
    const pastB = await listAll(userB, "past", now);
    expect(upcomingB.map((item) => item.id).sort()).toEqual([env.agencyB.appointmentId, ids.futureB].sort());
    expect(pastB.map((item) => item.id)).toEqual([ids.pastB]);
    expect(await dashboardUpcoming(userB, now)).toBe(upcomingB.length);

    const idsA = [...(await listAll(agentA, "upcoming", now)), ...(await listAll(agentA, "past", now))].map(
      (item) => item.id,
    );
    expect(idsA).not.toContain(ids.futureB);
    expect(idsA).not.toContain(ids.pastB);
    expect(idsA).not.toContain(env.agencyB.appointmentId);
  });

  it("un appel anonyme est refusé", async () => {
    const result = await listAppointments(env.anon, { view: "upcoming" });
    expect(result).toEqual({ data: null, error: expect.objectContaining({ code: "not_authenticated" }) });
  });
});
