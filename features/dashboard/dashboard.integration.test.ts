import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { parisDayStart } from "@/lib/agents/time";
import { setupTestEnv, type TestEnv, type TypedClient } from "@/lib/supabase/testing/local-test-env";

import { buildDashboardSummary } from "./data";
import { DASHBOARD_PIPELINE_STAGES, type DashboardIndicator, type DashboardSummary } from "./types";

/**
 * The `/dashboard` read against the LOCAL Supabase stack, with real sessions
 * (RLS applies). `getDashboardSummary()` (queries.ts) is a one-line wrapper
 * that only builds the request-scoped client, so the read itself is exercised
 * here.
 *
 * What is proved:
 *   * every figure equals a DIRECT count of the same rows, made by another
 *     code path (service_role, outside RLS, filtered by agency);
 *   * a list above 50 rows (the page size of the linked screens) is counted
 *     exactly, and its sample stays bounded to 5;
 *   * « à confirmer », « à clôturer » and « à venir » follow the same
 *     conditions as the appointment screen;
 *   * agency A never sees a figure, an id or a name of agency B, and back.
 */

let env: TestEnv;
let agentA: TypedClient;
let userB: TypedClient;

/** More than the 50-row page of Léa's inbox. */
const EXTRA_LEADS_A = 60;
/** Enough `chaud` contacts to go past a 50-row page as well. */
const EXTRA_HOT_CONTACTS_A = 55;

const ids = {
  pastConfirmedA: "",
  futureConfirmedA: "",
  cancelledA: "",
  proposedNotConfirmableA: "",
  proposedB: "",
};

function valueOf<T>(indicator: DashboardIndicator<T>): T {
  if (indicator.status !== "ok") throw new Error(`indicator unavailable: ${JSON.stringify(indicator.scope)}`);
  return indicator.value;
}

async function summaryOf(client: TypedClient): Promise<DashboardSummary> {
  const result = await buildDashboardSummary(client);
  if (result.error) throw new Error(`buildDashboardSummary: ${result.error.code}`);
  return result.data;
}

/** The few filters the reference counts need, untyped per table on purpose. */
type CountFilter = PromiseLike<{ count: number | null; error: { message: string } | null }> & {
  eq(column: string, value: string): CountFilter;
  in(column: string, values: readonly string[]): CountFilter;
  gte(column: string, value: string): CountFilter;
};

/** A direct exact count, outside RLS, with the same filters as the dashboard. */
async function directCount(
  table: "outbound_messages" | "inbound_leads" | "appointments" | "tasks" | "contacts" | "ai_agent_runs",
  agency: "a" | "b",
  apply: (query: CountFilter) => CountFilter = (query) => query,
): Promise<number> {
  const agencyId = agency === "a" ? env.agencyA.agencyId : env.agencyB.agencyId;
  const base = env.admin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("agency_id", agencyId) as unknown as CountFilter;
  const { count, error } = await apply(base);
  if (error) throw new Error(`directCount(${table}): ${error.message}`);
  if (typeof count !== "number") throw new Error(`directCount(${table}): no exact count`);
  return count;
}

async function insertAppointment(row: {
  agency: "a" | "b";
  contactId: string;
  startsAt: string;
  status: "proposed" | "confirmed" | "cancelled";
}): Promise<string> {
  const agency = row.agency === "a" ? env.agencyA : env.agencyB;
  const startsAt = new Date(row.startsAt);
  const { data, error } = await env.admin
    .from("appointments")
    .insert({
      agency_id: agency.agencyId,
      contact_id: row.contactId,
      assigned_user_id: agency.directorUserId,
      starts_at: startsAt.toISOString(),
      ends_at: new Date(startsAt.getTime() + 60 * 60 * 1000).toISOString(),
      status: row.status,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`insertAppointment: ${error?.message ?? "no row"}`);
  return data.id;
}

beforeAll(async () => {
  env = await setupTestEnv();
  agentA = env.users.agentA.client;
  userB = env.users.userB.client;

  // The seeded appointment of A becomes confirmable: its contact is qualified.
  const staged = await env.admin
    .from("contacts")
    .update({ stage: "qualifie" })
    .eq("id", env.agencyA.contactId);
  if (staged.error) throw new Error(`stage contact A: ${staged.error.message}`);

  // Agency A: > 50 pending leads, and a few that are no longer to process.
  const leads = await env.admin.from("inbound_leads").insert([
    ...Array.from({ length: EXTRA_LEADS_A }, (_, index) => ({
      agency_id: env.agencyA.agencyId,
      source: "website_form" as const,
      raw_text: `Demande de test ${index} (fictive).`,
      status: "pending" as const,
    })),
    ...Array.from({ length: 2 }, () => ({
      agency_id: env.agencyA.agencyId,
      source: "website_form" as const,
      raw_text: "Demande écartée (fictive).",
      status: "rejected" as const,
    })),
  ]);
  if (leads.error) throw new Error(`insert leads A: ${leads.error.message}`);

  const hot = await env.admin.from("contacts").insert(
    Array.from({ length: EXTRA_HOT_CONTACTS_A }, (_, index) => ({
      agency_id: env.agencyA.agencyId,
      first_name: "Chaud",
      last_name: `Test ${index}`,
      source: "manual_entry" as const,
      stage: "chaud" as const,
    })),
  );
  if (hot.error) throw new Error(`insert hot contacts A: ${hot.error.message}`);

  // Appointments of A. The seeded one (2030-01-07, proposed) stays as is.
  ids.pastConfirmedA = await insertAppointment({
    agency: "a",
    contactId: env.agencyA.contactId,
    startsAt: "2026-01-05T09:00:00Z",
    status: "confirmed",
  });
  ids.futureConfirmedA = await insertAppointment({
    agency: "a",
    contactId: env.agencyA.contactId,
    startsAt: "2030-02-04T09:00:00Z",
    status: "confirmed",
  });
  ids.cancelledA = await insertAppointment({
    agency: "a",
    contactId: env.agencyA.contactId,
    startsAt: "2030-03-04T09:00:00Z",
    status: "cancelled",
  });
  // Proposed, but its contact is still `nouveau`: not confirmable, yet upcoming.
  ids.proposedNotConfirmableA = await insertAppointment({
    agency: "a",
    contactId: env.agencyA.deletableContactId,
    startsAt: "2030-01-14T09:00:00Z",
    status: "proposed",
  });

  // Agency-level task with a due date, and a cancelled one (not open).
  const tasks = await env.admin.from("tasks").insert([
    {
      agency_id: env.agencyA.agencyId,
      type: "agency_review",
      title: "Revoir les réglages (test)",
      status: "open" as const,
      due_at: "2030-01-01T09:00:00Z",
    },
    {
      agency_id: env.agencyA.agencyId,
      type: "agency_cancelled",
      title: "Tâche annulée (test)",
      status: "cancelled" as const,
      due_at: null,
    },
  ]);
  if (tasks.error) throw new Error(`insert tasks A: ${tasks.error.message}`);

  // Agency B: a few rows of its own, so that a leak would show.
  const leadsB = await env.admin.from("inbound_leads").insert(
    Array.from({ length: 3 }, (_, index) => ({
      agency_id: env.agencyB.agencyId,
      source: "website_form" as const,
      raw_text: `Demande B ${index} (fictive).`,
    })),
  );
  if (leadsB.error) throw new Error(`insert leads B: ${leadsB.error.message}`);
  ids.proposedB = await insertAppointment({
    agency: "b",
    contactId: env.agencyB.contactId,
    startsAt: "2030-01-21T09:00:00Z",
    status: "proposed",
  });
}, 180_000);

afterAll(async () => {
  if (env) await env.cleanup();
});

describe("Tableau de bord — chiffres exacts", () => {
  it("renvoie un tableau complet, sans aucun indicateur indisponible", async () => {
    const summary = await summaryOf(agentA);
    expect(summary.agencyId).toBe(env.agencyA.agencyId);
    expect(summary.timeZone).toBe("Europe/Paris");

    const indicators = [
      ...Object.values(summary.todo),
      ...summary.pipeline.stages.map((entry) => entry.count),
      summary.agents.killSwitch,
      summary.agents.runsToday,
      summary.agents.runsLast7Days,
      summary.upcomingAppointments,
    ];
    expect(indicators.every((indicator) => indicator.status === "ok")).toBe(true);
  });

  it("compte exactement au-delà d'une page de 50, avec un échantillon borné", async () => {
    const summary = await summaryOf(agentA);
    const leads = valueOf(summary.todo.inboundLeadsToProcess);

    const expected = await directCount("inbound_leads", "a", (q) => q.eq("status", "pending"));
    expect(expected).toBeGreaterThan(50);
    expect(leads.total).toBe(expected);
    expect(leads.items).toHaveLength(5);
    expect(leads.hasMore).toBe(true);

    const { data: pendingA } = await env.admin
      .from("inbound_leads")
      .select("id")
      .eq("agency_id", env.agencyA.agencyId)
      .eq("status", "pending");
    const pendingIds = new Set((pendingA ?? []).map((row) => row.id));
    expect(leads.items.every((item) => pendingIds.has(item.id))).toBe(true);
    // Échantillon : les plus anciens d'abord.
    const instants = leads.items.map((item) => Date.parse(item.createdAt));
    expect([...instants].sort((a, b) => a - b)).toEqual(instants);
  });

  it("chaque étape du pipeline est un comptage exact, au-delà de 50", async () => {
    const summary = await summaryOf(agentA);
    expect(summary.pipeline.stages.map((entry) => entry.stage)).toEqual([...DASHBOARD_PIPELINE_STAGES]);

    for (const entry of summary.pipeline.stages) {
      expect(valueOf(entry.count)).toBe(await directCount("contacts", "a", (q) => q.eq("stage", entry.stage)));
    }
    const chaud = summary.pipeline.stages.find((entry) => entry.stage === "chaud")!;
    expect(valueOf(chaud.count)).toBeGreaterThan(50);
  });

  it("messages à valider et tâches ouvertes = comptages directs", async () => {
    const summary = await summaryOf(agentA);

    const messages = valueOf(summary.todo.messagesToValidate);
    expect(messages.total).toBe(
      await directCount("outbound_messages", "a", (q) => q.in("status", ["pending_validation", "approved"])),
    );
    expect(messages.items.map((item) => item.id)).toContain(env.agencyA.outboundMessageId);
    expect(messages.items[0]!.contactId).toBe(env.agencyA.contactId);
    expect(messages.items[0]!.contactName).toBe("Test Contact A");

    const tasks = valueOf(summary.todo.openTasks);
    expect(tasks.total).toBe(await directCount("tasks", "a", (q) => q.eq("status", "open")));
    expect(tasks.total).toBe(2);
    // Échéance la plus proche d'abord, sans échéance en dernier.
    expect(tasks.items[0]).toMatchObject({ contactId: null, contactName: null, dueAt: "2030-01-01T09:00:00.000Z" });
    expect(tasks.items[1]).toMatchObject({ id: env.agencyA.taskId, contactId: env.agencyA.contactId, dueAt: null });
  });

  it("rendez-vous à confirmer / à clôturer : mêmes conditions que l'écran de suivi", async () => {
    const summary = await summaryOf(agentA);

    // À confirmer : proposé ET contact à une étape confirmable.
    const toConfirm = valueOf(summary.todo.appointmentsToConfirm);
    expect(toConfirm.total).toBe(1);
    expect(toConfirm.items.map((item) => item.id)).toEqual([env.agencyA.appointmentId]);
    expect(toConfirm.items[0]).toMatchObject({ contactId: env.agencyA.contactId, isSimulation: true });
    // Le rendez-vous proposé d'un contact « nouveau » n'est pas confirmable.
    expect(toConfirm.items.map((item) => item.id)).not.toContain(ids.proposedNotConfirmableA);

    // À clôturer : confirmé, passé ou non ; plus ancien d'abord.
    const toClose = valueOf(summary.todo.appointmentsToClose);
    expect(toClose.total).toBe(await directCount("appointments", "a", (q) => q.eq("status", "confirmed")));
    expect(toClose.items.map((item) => item.id)).toEqual([ids.pastConfirmedA, ids.futureConfirmedA]);
  });

  it("prochains rendez-vous : actifs, à venir, le plus proche d'abord", async () => {
    const summary = await summaryOf(agentA);
    const upcoming = valueOf(summary.upcomingAppointments);

    expect(upcoming.total).toBe(
      await directCount("appointments", "a", (q) =>
        q.in("status", ["proposed", "confirmed"]).gte("starts_at", summary.generatedAt),
      ),
    );
    expect(upcoming.items.map((item) => item.id)).toEqual([
      env.agencyA.appointmentId,
      ids.proposedNotConfirmableA,
      ids.futureConfirmedA,
    ]);
    // Ni le rendez-vous annulé, ni celui déjà passé.
    expect(upcoming.items.map((item) => item.id)).not.toContain(ids.cancelledA);
    expect(upcoming.items.map((item) => item.id)).not.toContain(ids.pastConfirmedA);
    expect(upcoming.items.every((item) => item.isSimulation)).toBe(true);
    expect(upcoming.items[1]!.contactName).toBe("Test Supprimable A");
    expect(summary.upcomingAppointments.scope).toMatchObject({ key: "upcoming", startsAt: summary.generatedAt });
  });

  it("agents IA : coupe-circuit réel et exécutions du jour = comptage direct", async () => {
    const summary = await summaryOf(agentA);
    expect(valueOf(summary.agents.killSwitch)).toEqual({ aiPaused: false, canResume: false });

    const dayStart = parisDayStart(new Date(summary.generatedAt));
    const runsToday = valueOf(summary.agents.runsToday);
    expect(runsToday.total).toBe(
      await directCount("ai_agent_runs", "a", (q) => q.gte("started_at", dayStart.toISOString())),
    );
    expect(runsToday.total).toBeGreaterThan(0);
    expect(valueOf(summary.agents.runsLast7Days).total).toBeGreaterThanOrEqual(runsToday.total);
    expect(summary.agents.runsToday.scope).toMatchObject({ key: "today", startsAt: dayStart.toISOString() });
  });
});

describe("Tableau de bord — isolation entre agences", () => {
  it("l'agence B ne voit que ses chiffres, jamais un identifiant ou un nom de A", async () => {
    const summaryB = await summaryOf(userB);
    const serialized = JSON.stringify(summaryB);

    expect(summaryB.agencyId).toBe(env.agencyB.agencyId);
    expect(serialized).not.toContain(env.agencyA.agencyId);
    expect(serialized).not.toContain(env.agencyA.contactId);
    expect(serialized).not.toContain(env.agencyA.appointmentId);
    expect(serialized).not.toContain("Test Contact A");

    expect(valueOf(summaryB.todo.inboundLeadsToProcess).total).toBe(
      await directCount("inbound_leads", "b", (q) => q.eq("status", "pending")),
    );
    expect(valueOf(summaryB.todo.inboundLeadsToProcess).total).toBeLessThan(10);
    const chaudB = summaryB.pipeline.stages.find((entry) => entry.stage === "chaud")!;
    expect(valueOf(chaudB.count)).toBe(await directCount("contacts", "b", (q) => q.eq("stage", "chaud")));
    expect(valueOf(summaryB.upcomingAppointments).items.map((item) => item.id)).toEqual([
      env.agencyB.appointmentId,
      ids.proposedB,
    ]);
    // Le contact de B est encore « nouveau » : rien à confirmer, un vrai zéro.
    expect(summaryB.todo.appointmentsToConfirm).toMatchObject({ status: "ok", value: { total: 0, items: [] } });
  });

  it("l'agence A ne voit jamais un identifiant ou un nom de B", async () => {
    const serialized = JSON.stringify(await summaryOf(agentA));
    expect(serialized).not.toContain(env.agencyB.agencyId);
    expect(serialized).not.toContain(env.agencyB.contactId);
    expect(serialized).not.toContain(ids.proposedB);
    expect(serialized).not.toContain("Test Contact B");
  });

  it("sans session, rien n'est renvoyé", async () => {
    const result = await buildDashboardSummary(env.anon);
    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("not_authenticated");
  });
});
