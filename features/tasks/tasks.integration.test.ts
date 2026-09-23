import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildDashboardSummary } from "@/features/dashboard/data";
import { setupTestEnv, type TestEnv, type TypedClient } from "@/lib/supabase/testing/local-test-env";

import { completeOpenTask, listOpenTasks } from "./data";
import type { OpenTaskItem, OpenTasksInput } from "./types";

/**
 * The `/taches` data layer against the LOCAL Supabase stack, with real
 * sessions (RLS applies). `getOpenTasks()` / `completeTask()` are thin wrappers
 * that only build the request-scoped client (and validate the id), so the
 * logic itself is exercised here.
 *
 * What is proved:
 *   * the total is exact above one page (> 100 open tasks) and equals the
 *     dashboard's `openTasks` counter AND a direct count outside RLS;
 *   * pages are disjoint, cover every open task, and follow the documented order;
 *   * `overdue` and `mine` count exactly the expected rows;
 *   * « Marquer comme faite » closes the task once, stamps it server-side, and a
 *     second call answers « déjà terminée »;
 *   * agency B neither sees nor closes a task of agency A, and back;
 *   * an anonymous caller is refused.
 */

let env: TestEnv;
let agentA: TypedClient;
let userB: TypedClient;

/** More than the largest page (100). */
const EXTRA_OPEN_TASKS_A = 130;

const ids = { doneA: "", cancelledA: "", openB: "" };

async function directOpenCount(agencyId: string, extra?: (query: CountQuery) => CountQuery): Promise<number> {
  const base = env.admin
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("agency_id", agencyId)
    .eq("status", "open") as unknown as CountQuery;
  const { count, error } = await (extra ? extra(base) : base);
  if (error || typeof count !== "number") throw new Error(`directOpenCount: ${error?.message ?? "no count"}`);
  return count;
}

type CountQuery = PromiseLike<{ count: number | null; error: { message: string } | null }> & {
  eq(column: string, value: string): CountQuery;
  lt(column: string, value: string): CountQuery;
};

async function list(client: TypedClient, input: OpenTasksInput, now?: Date) {
  const result = await listOpenTasks(client, input, now);
  if (result.error) throw new Error(`listOpenTasks: ${result.error.code}`);
  return result.data;
}

async function dashboardOpenTasks(client: TypedClient): Promise<number> {
  const summary = await buildDashboardSummary(client);
  if (summary.error) throw new Error(`buildDashboardSummary: ${summary.error.code}`);
  const indicator = summary.data.todo.openTasks;
  if (indicator.status !== "ok") throw new Error("openTasks unavailable");
  return indicator.value.total;
}

async function taskStatus(taskId: string) {
  const { data, error } = await env.admin
    .from("tasks")
    .select("status, completed_at, completed_by")
    .eq("id", taskId)
    .single();
  if (error) throw new Error(`taskStatus: ${error.message}`);
  return data;
}

beforeAll(async () => {
  env = await setupTestEnv();
  agentA = env.users.agentA.client;
  userB = env.users.userB.client;

  const agencyId = env.agencyA.agencyId;
  const past = Date.parse("2026-01-05T09:00:00Z");
  const future = Date.parse("2031-01-05T09:00:00Z");
  const rows = Array.from({ length: EXTRA_OPEN_TASKS_A }, (_, index) => {
    // Three families: overdue, due in the future, and without a due date.
    const family = index % 3;
    const dueAt =
      family === 0
        ? new Date(past + index * 3_600_000).toISOString()
        : family === 1
          ? new Date(future + index * 3_600_000).toISOString()
          : null;
    return {
      agency_id: agencyId,
      // Agency-level tasks: not deduplicated by the (contact, type) index.
      type: "agency_review",
      title: `Tâche de test ${index} (fictive)`,
      status: "open" as const,
      due_at: dueAt,
      assigned_user_id: index % 4 === 0 ? env.users.agentA.id : null,
    };
  });
  const inserted = await env.admin.from("tasks").insert(rows);
  if (inserted.error) throw new Error(`insert tasks A: ${inserted.error.message}`);

  const closed = await env.admin
    .from("tasks")
    .insert([
      { agency_id: agencyId, type: "agency_done", title: "Déjà faite (test)", status: "done" as const },
      { agency_id: agencyId, type: "agency_cancelled", title: "Annulée (test)", status: "cancelled" as const },
    ])
    .select("id, status");
  if (closed.error || !closed.data) throw new Error(`insert closed tasks A: ${closed.error?.message}`);
  ids.doneA = closed.data.find((row) => row.status === "done")!.id;
  ids.cancelledA = closed.data.find((row) => row.status === "cancelled")!.id;

  const openB = await env.admin
    .from("tasks")
    .insert({ agency_id: env.agencyB.agencyId, type: "agency_review", title: "Tâche B (test)", status: "open" })
    .select("id")
    .single();
  if (openB.error || !openB.data) throw new Error(`insert task B: ${openB.error?.message}`);
  ids.openB = openB.data.id;
}, 180_000);

afterAll(async () => {
  if (env) await env.cleanup();
});

describe("Tâches ouvertes — total exact et pagination", () => {
  it("total exact > 100, égal au compteur du tableau de bord et à un comptage direct", async () => {
    const page = await list(agentA, { limit: 100 });
    const direct = await directOpenCount(env.agencyA.agencyId);
    // Seeded task of the test env + the extra ones.
    expect(direct).toBe(EXTRA_OPEN_TASKS_A + 1);
    expect(page.total).toBe(direct);
    expect(await dashboardOpenTasks(agentA)).toBe(page.total);
    expect(page.items).toHaveLength(100);
    expect(page.hasMore).toBe(true);
  });

  it("les pages sont disjointes, couvrent tout, et suivent l'ordre documenté", async () => {
    const first = await list(agentA, { limit: 100, offset: 0 });
    const second = await list(agentA, { limit: 100, offset: 100 });
    expect(second.hasMore).toBe(false);
    const all: OpenTaskItem[] = [...first.items, ...second.items];
    expect(all).toHaveLength(first.total);
    expect(new Set(all.map((item) => item.id)).size).toBe(first.total);
    expect(all.some((item) => item.id === ids.doneA || item.id === ids.cancelledA)).toBe(false);

    // Earliest due first, tasks without a due date last, then oldest first.
    for (let index = 1; index < all.length; index += 1) {
      const previous = all[index - 1]!;
      const current = all[index]!;
      if (previous.dueAt === null) {
        expect(current.dueAt).toBeNull();
        expect(Date.parse(current.createdAt)).toBeGreaterThanOrEqual(Date.parse(previous.createdAt));
      } else if (current.dueAt !== null) {
        expect(Date.parse(current.dueAt)).toBeGreaterThanOrEqual(Date.parse(previous.dueAt));
      }
    }

    // Agency-level tasks carry no contact; the seeded one carries its name.
    const seeded = all.find((item) => item.id === env.agencyA.taskId)!;
    expect(seeded.contactName).toBe("Test Contact A");
    expect(all.find((item) => item.contactId === null)!.contactName).toBeNull();
    // Minimisation: no contact detail beyond the name.
    expect(Object.keys(seeded).sort()).toEqual(
      [
        "assignedUserId",
        "contactId",
        "contactName",
        "createdAt",
        "createdByAgent",
        "dueAt",
        "id",
        "isOverdue",
        "title",
        "type",
      ].sort(),
    );
  });

  it("une page au-delà de la fin est vide, avec le total exact", async () => {
    const page = await list(agentA, { limit: 50, offset: 5000 });
    expect(page.items).toEqual([]);
    expect(page.total).toBe(await directOpenCount(env.agencyA.agencyId));
    expect(page.hasMore).toBe(false);
  });

  it("« en retard » et « les miennes » comptent exactement les bonnes lignes", async () => {
    const now = new Date();
    const overdue = await list(agentA, { scope: "overdue", limit: 100 }, now);
    expect(overdue.total).toBe(
      await directOpenCount(env.agencyA.agencyId, (query) => query.lt("due_at", now.toISOString())),
    );
    expect(overdue.total).toBeGreaterThan(0);
    expect(overdue.items.every((item) => item.isOverdue)).toBe(true);

    const all = await list(agentA, { limit: 100 }, now);
    expect(all.items.filter((item) => item.dueAt === null).every((item) => !item.isOverdue)).toBe(true);

    const mine = await list(agentA, { scope: "mine", limit: 100 });
    expect(mine.total).toBe(
      await directOpenCount(env.agencyA.agencyId, (query) => query.eq("assigned_user_id", env.users.agentA.id)),
    );
    expect(mine.total).toBeGreaterThan(0);
    expect(mine.items.every((item) => item.assignedUserId === env.users.agentA.id)).toBe(true);
  });
});

describe("Marquer comme faite", () => {
  it("ferme la tâche une seule fois, horodatée par la base ; le second appel répond « déjà terminée »", async () => {
    const before = await dashboardOpenTasks(agentA);
    const taskId = (await list(agentA, { limit: 1 })).items[0]!.id;

    const first = await completeOpenTask(agentA, taskId);
    expect(first.error).toBeNull();
    expect(first.data).toMatchObject({ id: taskId, status: "done" });

    const stored = await taskStatus(taskId);
    expect(stored.status).toBe("done");
    expect(stored.completed_by).toBe(env.users.agentA.id);
    expect(stored.completed_at).not.toBeNull();
    expect(Date.parse(stored.completed_at!)).toBe(Date.parse(first.data!.completedAt));

    const second = await completeOpenTask(agentA, taskId);
    expect(second).toEqual({
      data: null,
      error: { code: "task_already_done", message: "Cette tâche est déjà terminée." },
    });
    // The closure stamp was not rewritten.
    expect((await taskStatus(taskId)).completed_at).toBe(stored.completed_at);

    const after = await dashboardOpenTasks(agentA);
    expect(after).toBe(before - 1);
    expect((await list(agentA, { limit: 1 })).total).toBe(after);
  });

  it("refuse une tâche annulée et une tâche inconnue", async () => {
    expect((await completeOpenTask(agentA, ids.cancelledA)).error?.code).toBe("task_cancelled");
    expect((await taskStatus(ids.cancelledA)).status).toBe("cancelled");
    expect((await completeOpenTask(agentA, "00000000-0000-4000-8000-000000000000")).error?.code).toBe(
      "task_not_found",
    );
  });
});

describe("Isolation entre agences", () => {
  it("l'agence B ne voit aucune tâche de A, et A aucune de B", async () => {
    const pageB = await list(userB, { limit: 100 });
    expect(pageB.total).toBe(await directOpenCount(env.agencyB.agencyId));
    expect(pageB.items.map((item) => item.id)).toContain(ids.openB);
    expect(pageB.items.some((item) => item.id === env.agencyA.taskId)).toBe(false);
    expect(await dashboardOpenTasks(userB)).toBe(pageB.total);

    const idsA = [
      ...(await list(agentA, { limit: 100 })).items,
      ...(await list(agentA, { limit: 100, offset: 100 })).items,
    ].map((item) => item.id);
    expect(idsA).not.toContain(ids.openB);
    expect(idsA).not.toContain(env.agencyB.taskId);
  });

  it("l'agence B ne peut pas terminer une tâche de A, et réciproquement", async () => {
    const fromB = await completeOpenTask(userB, env.agencyA.taskId);
    expect(fromB.error).toEqual({ code: "task_not_found", message: "Tâche introuvable." });
    expect((await taskStatus(env.agencyA.taskId)).status).toBe("open");

    const fromA = await completeOpenTask(agentA, ids.openB);
    expect(fromA.error).toEqual({ code: "task_not_found", message: "Tâche introuvable." });
    expect((await taskStatus(ids.openB)).status).toBe("open");
  });

  it("RLS seule refuse aussi la mise à jour directe d'une tâche d'une autre agence", async () => {
    const direct = await userB
      .from("tasks")
      .update({ status: "done" })
      .eq("id", env.agencyA.taskId)
      .select("id");
    expect(direct.data ?? []).toEqual([]);
    expect((await taskStatus(env.agencyA.taskId)).status).toBe("open");
  });

  it("un appel anonyme est refusé", async () => {
    expect((await listOpenTasks(env.anon, {})).error?.code).toBe("not_authenticated");
    expect((await completeOpenTask(env.anon, env.agencyA.taskId)).error?.code).toBe("not_authenticated");
    expect((await taskStatus(env.agencyA.taskId)).status).toBe("open");
  });
});
