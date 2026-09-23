import { describe, expect, it } from "vitest";

import type { TypedClient } from "@/lib/agents/types";

import { canAppointmentBeConfirmed, listAppointments } from "./data";

/**
 * The contract of the `/rendez-vous` read, with a stub client. Exact totals,
 * equality with the dashboard, RLS and isolation between two agencies are
 * proved in `appointments.integration.test.ts`.
 */

const AGENCY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CONTACT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const NOW = new Date("2026-09-23T10:30:00Z");
const TECHNICAL = 'relation "secret_internal_table" does not exist';

type StubResponse = { data?: unknown; error?: { message: string; code?: string } | null; count?: number | null };

type RecordedQuery = {
  head: boolean;
  columns: string;
  filters: Array<[string, string, unknown]>;
  orders: Array<[string, { ascending?: boolean } | undefined]>;
  range: [number, number] | null;
};

type Handler = (query: RecordedQuery) => StubResponse | "throw" | undefined;

function makeClient(config: { user?: { id: string } | null; handler?: Handler } = {}) {
  const queries: RecordedQuery[] = [];
  const settle = (response: StubResponse | undefined) => ({
    data: response?.data ?? null,
    error: response?.error ?? null,
    count: response && "count" in response ? response.count : null,
  });

  const builder = () => {
    const query: RecordedQuery = { head: false, columns: "", filters: [], orders: [], range: null };
    const self: Record<string, unknown> = {};
    self.select = (columns: string, options?: { head?: boolean }) => {
      query.columns = columns;
      query.head = options?.head === true;
      return self;
    };
    for (const method of ["eq", "in", "gte", "lt"]) {
      self[method] = (column: string, value: unknown) => {
        query.filters.push([method, column, value]);
        return self;
      };
    }
    self.order = (column: string, options?: { ascending?: boolean }) => {
      query.orders.push([column, options]);
      return self;
    };
    self.range = (from: number, to: number) => {
      query.range = [from, to];
      return self;
    };
    self.then = (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => {
      queries.push(query);
      const answer = config.handler?.(query);
      const promise = answer === "throw" ? Promise.reject(new Error(TECHNICAL)) : Promise.resolve(settle(answer));
      return promise.then(onFulfilled, onRejected);
    };
    return self;
  };

  const membershipBuilder = () => {
    const self: Record<string, unknown> = {};
    for (const method of ["select", "eq", "order", "limit"]) self[method] = () => self;
    self.maybeSingle = () => Promise.resolve({ data: { agency_id: AGENCY_ID, role: "agent" }, error: null });
    return self;
  };

  const client = {
    auth: {
      getUser: async () => ({
        data: { user: config.user === undefined ? { id: "user-1" } : config.user },
        error: config.user === null ? { message: "no session" } : null,
      }),
    },
    from: (table: string) => (table === "memberships" ? membershipBuilder() : builder()),
  };
  return { client: client as unknown as TypedClient, queries };
}

function appointmentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "a1",
    contact_id: CONTACT_ID,
    status: "proposed",
    starts_at: "2026-09-25T08:00:00+00:00",
    ends_at: "2026-09-25T09:00:00+00:00",
    is_simulation: true,
    contacts: { first_name: "Claire", last_name: "Test", stage: "qualifie" },
    ...overrides,
  };
}

function hasFilter(query: RecordedQuery, method: string, column: string, value?: unknown): boolean {
  return query.filters.some(
    ([m, c, v]) => m === method && c === column && (value === undefined || JSON.stringify(v) === JSON.stringify(value)),
  );
}

describe("canAppointmentBeConfirmed", () => {
  it("follows the confirmation rule of the follow-through screen", () => {
    expect(canAppointmentBeConfirmed("proposed", "qualifie")).toBe(true);
    expect(canAppointmentBeConfirmed("proposed", "chaud")).toBe(true);
    expect(canAppointmentBeConfirmed("proposed", "rdv_planifie")).toBe(true);
    expect(canAppointmentBeConfirmed("proposed", "nouveau")).toBe(false);
    expect(canAppointmentBeConfirmed("proposed", "mandat_signe")).toBe(false);
    expect(canAppointmentBeConfirmed("proposed", null)).toBe(false);
    expect(canAppointmentBeConfirmed("confirmed", "qualifie")).toBe(false);
  });
});

describe("listAppointments", () => {
  it("upcoming: same filter as the dashboard, soonest first, exact total, action flags", async () => {
    const { client, queries } = makeClient({
      handler: () => ({
        data: [
          appointmentRow(),
          appointmentRow({ id: "a2", contacts: { first_name: null, last_name: "", stage: "nouveau" } }),
          appointmentRow({ id: "a3", status: "confirmed" }),
        ],
        count: 3,
      }),
    });
    const result = await listAppointments(client, {}, NOW);
    expect(result.error).toBeNull();
    const page = result.data!;

    expect(page).toMatchObject({ view: "upcoming", total: 3, limit: 25, offset: 0, hasMore: false });
    expect(page.timeZone).toBe("Europe/Paris");
    expect(page.items[0]).toEqual({
      id: "a1",
      contactId: CONTACT_ID,
      contactName: "Claire Test",
      status: "proposed",
      startsAt: "2026-09-25T08:00:00.000Z",
      endsAt: "2026-09-25T09:00:00.000Z",
      isSimulation: true,
      canBeConfirmed: true,
      canBeCompleted: false,
    });
    expect(page.items[1]).toMatchObject({ contactName: "Contact sans nom", canBeConfirmed: false });
    expect(page.items[2]).toMatchObject({ canBeConfirmed: false, canBeCompleted: true });

    const query = queries[0]!;
    expect(hasFilter(query, "eq", "agency_id", AGENCY_ID)).toBe(true);
    expect(hasFilter(query, "in", "status", ["proposed", "confirmed"])).toBe(true);
    expect(hasFilter(query, "gte", "starts_at", NOW.toISOString())).toBe(true);
    expect(query.filters).toHaveLength(3);
    expect(query.orders).toEqual([
      ["starts_at", { ascending: true }],
      ["id", { ascending: true }],
    ]);
    // No free text (report, notes) is read for the list.
    expect(query.columns).not.toMatch(/report|notes|email|phone/);
  });

  it("past: every status starting before now, most recent first", async () => {
    const { client, queries } = makeClient({ handler: () => ({ data: [appointmentRow({ status: "done" })], count: 240 }) });
    const result = await listAppointments(client, { view: "past", limit: 1, offset: 10 }, NOW);
    expect(result.data).toMatchObject({ view: "past", total: 240, hasMore: true });
    expect(result.data?.items[0]).toMatchObject({ canBeConfirmed: false, canBeCompleted: false });

    const query = queries[0]!;
    expect(hasFilter(query, "lt", "starts_at", NOW.toISOString())).toBe(true);
    expect(query.filters.some(([, column]) => column === "status")).toBe(false);
    expect(query.orders).toEqual([
      ["starts_at", { ascending: false }],
      ["id", { ascending: false }],
    ]);
    expect(query.range).toEqual([10, 10]);
  });

  it("answers an empty page with the exact total past the end (PGRST103)", async () => {
    const { client } = makeClient({
      handler: (query) => (query.head ? { count: 4 } : { error: { message: "range", code: "PGRST103" } }),
    });
    const result = await listAppointments(client, { offset: 4000 }, NOW);
    expect(result.data).toMatchObject({ items: [], total: 4, hasMore: false });
  });

  it("refuses an invalid view or page before any query", async () => {
    const { client, queries } = makeClient();
    for (const input of [{ view: "cancelled" }, { limit: 101 }, { offset: 5001 }]) {
      const result = await listAppointments(client, input as never, NOW);
      expect(result.error?.code).toBe("invalid_appointment_filter");
    }
    expect(queries).toHaveLength(0);
  });

  it("refuses an anonymous caller", async () => {
    const result = await listAppointments(makeClient({ user: null }).client, {}, NOW);
    expect(result.error?.code).toBe("not_authenticated");
  });

  it("never leaks a database error, a missing count or an exception", async () => {
    for (const handler of [
      () => ({ error: { message: TECHNICAL, code: "42P01" } }),
      () => ({ data: [], count: null }),
      () => "throw" as const,
    ]) {
      const result = await listAppointments(makeClient({ handler }).client, {}, NOW);
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe("unexpected_error");
      expect(JSON.stringify(result)).not.toContain("secret_internal_table");
    }
  });
});
