import { describe, expect, it } from "vitest";

import type { TypedClient } from "@/lib/agents/types";

import { completeOpenTask, isTaskOverdue, listOpenTasks } from "./data";

/**
 * The contract of the tasks layer, with a stub client instead of a database.
 * Exact totals against real rows, RLS and isolation between two agencies are
 * proved in `tasks.integration.test.ts`.
 */

const AGENCY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const TASK_ID = "22222222-2222-4222-8222-222222222222";
const CONTACT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const NOW = new Date("2026-09-23T10:30:00Z");
const TECHNICAL = 'relation "secret_internal_table" does not exist';

type StubResponse = { data?: unknown; error?: { message: string; code?: string } | null; count?: number | null };

type RecordedQuery = {
  table: string;
  kind: "select" | "update";
  head: boolean;
  columns: string;
  payload: unknown;
  filters: Array<[string, string, unknown]>;
  orders: Array<[string, { ascending?: boolean; nullsFirst?: boolean } | undefined]>;
  range: [number, number] | null;
  single: boolean;
};

type Handler = (query: RecordedQuery) => StubResponse | "throw" | undefined;

function makeClient(config: { user?: { id: string } | null; membership?: StubResponse; handler?: Handler } = {}) {
  const queries: RecordedQuery[] = [];

  const settle = (response: StubResponse | undefined) => ({
    data: response?.data ?? null,
    error: response?.error ?? null,
    count: response && "count" in response ? response.count : null,
  });

  const run = (query: RecordedQuery) => {
    queries.push(query);
    const answer = config.handler?.(query);
    if (answer === "throw") return Promise.reject(new Error(TECHNICAL));
    return Promise.resolve(settle(answer));
  };

  const builder = (table: string) => {
    const query: RecordedQuery = {
      table,
      kind: "select",
      head: false,
      columns: "",
      payload: null,
      filters: [],
      orders: [],
      range: null,
      single: false,
    };
    const self: Record<string, unknown> = {};
    self.select = (columns: string, options?: { head?: boolean }) => {
      query.columns = columns;
      query.head = options?.head === true;
      return self;
    };
    self.update = (payload: unknown) => {
      query.kind = "update";
      query.payload = payload;
      return self;
    };
    for (const method of ["eq", "in", "gte", "lt"]) {
      self[method] = (column: string, value: unknown) => {
        query.filters.push([method, column, value]);
        return self;
      };
    }
    self.order = (column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) => {
      query.orders.push([column, options]);
      return self;
    };
    self.range = (from: number, to: number) => {
      query.range = [from, to];
      return self;
    };
    self.maybeSingle = () => {
      query.single = true;
      return run(query);
    };
    self.then = (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
      run(query).then(onFulfilled, onRejected);
    return self;
  };

  const membershipBuilder = () => {
    const self: Record<string, unknown> = {};
    for (const method of ["select", "eq", "order", "limit"]) self[method] = () => self;
    self.maybeSingle = () =>
      Promise.resolve(
        config.membership ? settle(config.membership) : { data: { agency_id: AGENCY_ID, role: "agent" }, error: null },
      );
    return self;
  };

  const client = {
    auth: {
      getUser: async () => ({
        data: { user: config.user === undefined ? { id: USER_ID } : config.user },
        error: config.user === null ? { message: "no session" } : null,
      }),
    },
    from: (table: string) => (table === "memberships" ? membershipBuilder() : builder(table)),
  };
  return { client: client as unknown as TypedClient, queries };
}

function taskRow(overrides: Record<string, unknown> = {}) {
  return {
    id: TASK_ID,
    contact_id: CONTACT_ID,
    type: "missing_information",
    title: "Compléter la surface (test)",
    due_at: "2026-09-22T08:00:00+00:00",
    assigned_user_id: null,
    created_by_agent: "hugo",
    created_at: "2026-09-20T08:00:00+00:00",
    contacts: { first_name: "Claire", last_name: "Test" },
    ...overrides,
  };
}

function hasFilter(query: RecordedQuery, method: string, column: string, value?: unknown): boolean {
  return query.filters.some(([m, c, v]) => m === method && c === column && (value === undefined || v === value));
}

describe("isTaskOverdue", () => {
  it("is strictly before the instant of the read, and never without a due date", () => {
    expect(isTaskOverdue("2026-09-23T10:29:59Z", NOW)).toBe(true);
    expect(isTaskOverdue("2026-09-23T10:30:00Z", NOW)).toBe(false);
    expect(isTaskOverdue("2026-09-24T00:00:00+02:00", NOW)).toBe(false);
    expect(isTaskOverdue(null, NOW)).toBe(false);
    expect(isTaskOverdue("not a date", NOW)).toBe(false);
  });
});

describe("listOpenTasks", () => {
  it("lists the open tasks of the caller's agency, sorted and paginated, with the exact total", async () => {
    const { client, queries } = makeClient({
      handler: () => ({
        data: [
          taskRow(),
          taskRow({ id: "t2", due_at: "2030-01-01T09:00:00Z", contacts: { first_name: " ", last_name: null } }),
          taskRow({ id: "t3", contact_id: null, due_at: null, contacts: null }),
        ],
        count: 142,
      }),
    });

    const result = await listOpenTasks(client, { limit: 3, offset: 6 }, NOW);
    expect(result.error).toBeNull();
    const page = result.data!;

    expect(page.total).toBe(142);
    expect(page.limit).toBe(3);
    expect(page.offset).toBe(6);
    expect(page.hasMore).toBe(true);
    expect(page.scope).toBe("all");
    expect(page.timeZone).toBe("Europe/Paris");
    expect(page.generatedAt).toBe(NOW.toISOString());

    expect(page.items[0]).toEqual({
      id: TASK_ID,
      title: "Compléter la surface (test)",
      type: "missing_information",
      dueAt: "2026-09-22T08:00:00.000Z",
      isOverdue: true,
      contactId: CONTACT_ID,
      contactName: "Claire Test",
      assignedUserId: null,
      createdByAgent: "hugo",
      createdAt: "2026-09-20T08:00:00.000Z",
    });
    expect(page.items[1]).toMatchObject({ isOverdue: false, contactName: "Contact sans nom" });
    expect(page.items[2]).toMatchObject({ contactId: null, contactName: null, dueAt: null, isOverdue: false });

    // Minimisation: no email / phone / details asked, and none returned.
    const query = queries[0]!;
    expect(query.columns).not.toMatch(/email|phone|details/);
    expect(Object.keys(page.items[0]!)).not.toContain("email");

    // Same condition as the dashboard counter, agency resolved server-side.
    expect(hasFilter(query, "eq", "agency_id", AGENCY_ID)).toBe(true);
    expect(hasFilter(query, "eq", "status", "open")).toBe(true);
    expect(query.filters).toHaveLength(2);
    // Earliest due first, no due date last, then oldest, then id.
    expect(query.orders).toEqual([
      ["due_at", { ascending: true, nullsFirst: false }],
      ["created_at", { ascending: true }],
      ["id", { ascending: true }],
    ]);
    expect(query.range).toEqual([6, 8]);
  });

  it("filters the overdue tasks against the same instant", async () => {
    const { client, queries } = makeClient({ handler: () => ({ data: [], count: 0 }) });
    const result = await listOpenTasks(client, { scope: "overdue" }, NOW);
    expect(result.data?.total).toBe(0);
    expect(result.data?.hasMore).toBe(false);
    expect(hasFilter(queries[0]!, "lt", "due_at", NOW.toISOString())).toBe(true);
  });

  it("filters « mine » on the signed-in user, never on a value from the browser", async () => {
    const { client, queries } = makeClient({ handler: () => ({ data: [], count: 0 }) });
    await listOpenTasks(client, { scope: "mine" }, NOW);
    expect(hasFilter(queries[0]!, "eq", "assigned_user_id", USER_ID)).toBe(true);
  });

  it("answers an empty page with the exact total past the end (PGRST103)", async () => {
    const { client, queries } = makeClient({
      handler: (query) =>
        query.head ? { count: 7 } : { error: { message: "Requested range not satisfiable", code: "PGRST103" } },
    });
    const result = await listOpenTasks(client, { offset: 100 }, NOW);
    expect(result.error).toBeNull();
    expect(result.data).toMatchObject({ items: [], total: 7, hasMore: false });
    expect(queries).toHaveLength(2);
    expect(hasFilter(queries[1]!, "eq", "status", "open")).toBe(true);
  });

  it("refuses an invalid filter before any query", async () => {
    const { client, queries } = makeClient();
    const result = await listOpenTasks(client, { limit: 1000 } as never, NOW);
    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("invalid_task_filter");
    expect(queries).toHaveLength(0);
  });

  it("refuses an anonymous caller and a caller without agency", async () => {
    const anonymous = await listOpenTasks(makeClient({ user: null }).client, {}, NOW);
    expect(anonymous).toEqual({ data: null, error: expect.objectContaining({ code: "not_authenticated" }) });

    const orphan = await listOpenTasks(makeClient({ membership: { data: null } }).client, {}, NOW);
    expect(orphan.error?.code).toBe("no_agency");
  });

  it("turns a database error, a missing count or an exception into a safe error", async () => {
    for (const handler of [
      () => ({ error: { message: TECHNICAL, code: "42P01" } }),
      () => ({ data: [], count: null }),
      () => "throw" as const,
    ]) {
      const result = await listOpenTasks(makeClient({ handler }).client, {}, NOW);
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe("unexpected_error");
      expect(JSON.stringify(result)).not.toContain("secret_internal_table");
    }
  });
});

describe("completeOpenTask", () => {
  it("closes an open task of the agency with a conditional update", async () => {
    const { client, queries } = makeClient({
      handler: (query) =>
        query.kind === "update"
          ? { data: { id: TASK_ID, contact_id: CONTACT_ID, status: "done", completed_at: "2026-09-23T10:30:01+00:00" } }
          : undefined,
    });
    const result = await completeOpenTask(client, TASK_ID);
    expect(result).toEqual({
      data: { id: TASK_ID, contactId: CONTACT_ID, status: "done", completedAt: "2026-09-23T10:30:01.000Z" },
      error: null,
    });
    const update = queries[0]!;
    expect(update.kind).toBe("update");
    // The closure instant is stamped by the database, not sent by the server.
    expect(update.payload).toEqual({ status: "done", completed_by: USER_ID });
    expect(hasFilter(update, "eq", "id", TASK_ID)).toBe(true);
    expect(hasFilter(update, "eq", "agency_id", AGENCY_ID)).toBe(true);
    expect(hasFilter(update, "eq", "status", "open")).toBe(true);
  });

  it("is idempotent: a second call answers « déjà terminée », without a technical error", async () => {
    const { client } = makeClient({
      handler: (query) => (query.kind === "update" ? { data: null } : { data: { id: TASK_ID, status: "done" } }),
    });
    const result = await completeOpenTask(client, TASK_ID);
    expect(result).toEqual({
      data: null,
      error: { code: "task_already_done", message: "Cette tâche est déjà terminée." },
    });
  });

  it("refuses a cancelled task", async () => {
    const { client } = makeClient({
      handler: (query) => (query.kind === "update" ? { data: null } : { data: { id: TASK_ID, status: "cancelled" } }),
    });
    expect((await completeOpenTask(client, TASK_ID)).error?.code).toBe("task_cancelled");
  });

  it("answers « introuvable » for an unknown task or another agency's task", async () => {
    const { client } = makeClient({ handler: () => ({ data: null }) });
    expect((await completeOpenTask(client, TASK_ID)).error).toEqual({
      code: "task_not_found",
      message: "Tâche introuvable.",
    });
  });

  it("refuses an anonymous caller before any write", async () => {
    const { client, queries } = makeClient({ user: null });
    expect((await completeOpenTask(client, TASK_ID)).error?.code).toBe("not_authenticated");
    expect(queries).toHaveLength(0);
  });

  it("never leaks a database error", async () => {
    for (const handler of [
      () => ({ error: { message: TECHNICAL, code: "42P01" } }),
      () => "throw" as const,
    ]) {
      const result = await completeOpenTask(makeClient({ handler }).client, TASK_ID);
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe("unexpected_error");
      expect(JSON.stringify(result)).not.toContain("secret_internal_table");
    }
    const rls = await completeOpenTask(
      makeClient({ handler: () => ({ error: { message: "row-level security", code: "42501" } }) }).client,
      TASK_ID,
    );
    expect(rls.error?.code).toBe("forbidden");
  });
});
