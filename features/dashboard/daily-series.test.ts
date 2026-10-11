import { afterEach, describe, expect, it, vi } from "vitest";

import type { TypedClient } from "@/lib/agents/types";

import {
  bucketDailySeries,
  buildDashboardDailySeries,
  firstQualificationPerContact,
  parisDayKeys,
} from "./data";

/**
 * The 30-day series, without a database:
 *   * days are Europe/Paris calendar days (an instant just after midnight Paris
 *     belongs to the NEW day even if it is still the previous day in UTC),
 *     summer time and winter time, and the clock-change weekends;
 *   * a day without activity is a real 0, every one of the 30 days is present;
 *   * a dossier is « qualified » once;
 *   * a failed read is « unavailable », never a flat line of zeros.
 * Exactness against real rows and isolation between agencies are proved in
 * `daily-series.integration.test.ts`.
 */

const AGENCY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NOW = new Date("2026-10-11T10:30:00Z");

afterEach(() => {
  vi.restoreAllMocks();
});

function daysBetween(first: string, second: string): number {
  return Math.round((Date.parse(`${second}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / 86_400_000);
}

describe("parisDayKeys", () => {
  it("lists 30 consecutive Paris days, today last", () => {
    const keys = parisDayKeys(30, NOW);
    expect(keys).toHaveLength(30);
    expect(keys[29]).toBe("2026-10-11");
    expect(keys[0]).toBe("2026-09-12");
    for (let index = 1; index < keys.length; index += 1) expect(daysBetween(keys[index - 1]!, keys[index]!)).toBe(1);
  });

  it("stays contiguous across both clock changes (23 h and 25 h days)", () => {
    // Spring forward: 2026-03-29, fall back: 2026-10-25.
    for (const now of [new Date("2026-04-05T09:00:00Z"), new Date("2026-11-01T09:00:00Z")]) {
      const keys = parisDayKeys(30, now);
      expect(new Set(keys).size).toBe(30);
      for (let index = 1; index < keys.length; index += 1) expect(daysBetween(keys[index - 1]!, keys[index]!)).toBe(1);
    }
    expect(parisDayKeys(30, new Date("2026-04-05T09:00:00Z"))).toContain("2026-03-29");
    expect(parisDayKeys(30, new Date("2026-11-01T09:00:00Z"))).toContain("2026-10-25");
  });

  it("uses the Paris date, not the UTC date, when it is already tomorrow in Paris", () => {
    // 23:30 UTC on 10 Oct = 01:30 on 11 Oct in Paris (summer time).
    expect(parisDayKeys(3, new Date("2026-10-10T23:30:00Z"))).toEqual(["2026-10-09", "2026-10-10", "2026-10-11"]);
  });
});

describe("bucketDailySeries", () => {
  const days = parisDayKeys(30, NOW);

  it("returns every day, with a real 0 for the quiet ones", () => {
    const points = bucketDailySeries({ days, received: [], qualified: [] });
    expect(points).toHaveLength(30);
    expect(points.every((point) => point.received === 0 && point.qualified === 0)).toBe(true);
    expect(points.map((point) => point.date)).toEqual(days);
  });

  it("cuts days at midnight Paris in summer time (UTC+2)", () => {
    const points = bucketDailySeries({
      days,
      received: [
        "2026-10-09T21:59:59Z", // 23:59:59 on the 9th in Paris
        "2026-10-09T22:00:00Z", // 00:00:00 on the 10th in Paris
        "2026-10-10T08:00:00Z",
      ],
      qualified: ["2026-10-10T21:59:59Z", "2026-10-10T22:00:00Z"],
    });
    const byDate = new Map(points.map((point) => [point.date, point]));
    expect(byDate.get("2026-10-09")!.received).toBe(1);
    expect(byDate.get("2026-10-10")!.received).toBe(2);
    expect(byDate.get("2026-10-10")!.qualified).toBe(1);
    expect(byDate.get("2026-10-11")!.qualified).toBe(1);
  });

  it("cuts days at midnight Paris in winter time (UTC+1)", () => {
    const winterDays = parisDayKeys(5, new Date("2026-12-12T10:00:00Z"));
    const points = bucketDailySeries({
      days: winterDays,
      received: ["2026-12-10T22:59:59Z", "2026-12-10T23:00:00Z"],
      qualified: [],
    });
    const byDate = new Map(points.map((point) => [point.date, point]));
    expect(byDate.get("2026-12-10")!.received).toBe(1);
    expect(byDate.get("2026-12-11")!.received).toBe(1);
  });

  it("ignores instants outside the window and invalid instants (never put in a wrong day)", () => {
    const points = bucketDailySeries({
      days,
      received: ["2026-09-11T10:00:00Z", "2026-10-12T10:00:00Z", "not-a-date", ""],
      qualified: ["nonsense"],
    });
    expect(points.reduce((sum, point) => sum + point.received + point.qualified, 0)).toBe(0);
  });

  it("counts several events of the same day", () => {
    const points = bucketDailySeries({
      days,
      received: ["2026-10-05T07:10:00Z", "2026-10-05T08:12:00Z", "2026-10-05T15:40:00Z"],
      qualified: [],
    });
    expect(points.find((point) => point.date === "2026-10-05")!.received).toBe(3);
  });
});

describe("firstQualificationPerContact", () => {
  it("keeps the earliest move of each dossier, once", () => {
    const result = firstQualificationPerContact([
      { contact_id: "c1", occurred_at: "2026-10-05T10:00:00Z" },
      { contact_id: "c1", occurred_at: "2026-10-03T10:00:00Z" },
      { contact_id: "c2", occurred_at: "2026-10-04T10:00:00Z" },
    ]);
    expect(result.sort()).toEqual(["2026-10-03T10:00:00.000Z", "2026-10-04T10:00:00.000Z"]);
  });

  it("ignores rows without contact or with an invalid date", () => {
    expect(
      firstQualificationPerContact([
        { contact_id: null, occurred_at: "2026-10-05T10:00:00Z" },
        { contact_id: "c1", occurred_at: "garbage" },
      ]),
    ).toEqual([]);
  });
});

// -----------------------------------------------------------------------------
// The read, with a stub client
// -----------------------------------------------------------------------------

type Recorded = { table: string; filters: Array<[string, string, unknown]> };

function makeClient(config: {
  user?: { id: string } | null;
  contacts?: { data: unknown; error?: { message: string } | null } | "throw";
  activities?: { data: unknown; error?: { message: string } | null };
}): { client: TypedClient; recorded: Recorded[] } {
  const recorded: Recorded[] = [];
  const builder = (table: string) => {
    const query: Recorded = { table, filters: [] };
    const self: Record<string, unknown> = {};
    for (const method of ["select", "order", "range", "limit"]) self[method] = () => self;
    for (const method of ["eq", "in", "gte", "lte"]) {
      self[method] = (column: string, value: unknown) => {
        query.filters.push([method, column, value]);
        return self;
      };
    }
    self.then = (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => {
      recorded.push(query);
      const answer = table === "contacts" ? config.contacts : config.activities;
      if (answer === "throw") return Promise.reject(new Error("boom")).then(onFulfilled, onRejected);
      return Promise.resolve({ data: answer?.data ?? [], error: answer?.error ?? null }).then(onFulfilled, onRejected);
    };
    return self;
  };
  const client = {
    auth: {
      getUser: async () => ({
        data: { user: config.user === undefined ? { id: "user-1" } : config.user },
        error: config.user === null ? { message: "no session" } : null,
      }),
    },
    from: (table: string) => {
      if (table === "memberships") {
        const self: Record<string, unknown> = {};
        for (const method of ["select", "eq", "order", "limit"]) self[method] = () => self;
        self.maybeSingle = () => Promise.resolve({ data: { agency_id: AGENCY_ID, role: "agent" }, error: null });
        return self;
      }
      return builder(table);
    },
  } as unknown as TypedClient;
  return { client, recorded };
}

describe("buildDashboardDailySeries", () => {
  it("builds 30 points, with the totals, from the rows read", async () => {
    const { client } = makeClient({
      contacts: {
        data: [
          { created_at: "2026-10-11T08:00:00+00:00" },
          { created_at: "2026-10-10T08:00:00+00:00" },
          { created_at: "2026-10-10T09:00:00+00:00" },
        ],
      },
      activities: {
        data: [
          { contact_id: "c1", occurred_at: "2026-10-10T10:00:00+00:00" },
          { contact_id: "c1", occurred_at: "2026-10-11T07:00:00+00:00" },
        ],
      },
    });
    const result = await buildDashboardDailySeries(client, NOW);
    expect(result.error).toBeNull();
    const series = result.data!;
    if (series.status !== "ok") throw new Error("expected ok");
    expect(series.points).toHaveLength(30);
    expect(series.scope).toMatchObject({ key: "last_30_days", days: 30, timeZone: "Europe/Paris", endsAt: NOW.toISOString() });
    expect(series.scope.startsAt).toBe("2026-09-11T22:00:00.000Z"); // midnight Paris on 12 Sept
    expect(series.totals).toEqual({ received: 3, qualified: 1 });
    expect(series.points.find((point) => point.date === "2026-10-10")).toEqual({
      date: "2026-10-10",
      received: 2,
      qualified: 1,
    });
  });

  it("filters both reads by the agency of the session and by the 30-day window", async () => {
    const { client, recorded } = makeClient({});
    await buildDashboardDailySeries(client, NOW);
    for (const query of recorded) {
      expect(query.filters).toContainEqual(["eq", "agency_id", AGENCY_ID]);
    }
    const contacts = recorded.find((query) => query.table === "contacts")!;
    expect(contacts.filters).toContainEqual(["gte", "created_at", "2026-09-11T22:00:00.000Z"]);
    expect(contacts.filters).toContainEqual(["lte", "created_at", NOW.toISOString()]);
    const activities = recorded.find((query) => query.table === "activities")!;
    expect(activities.filters).toContainEqual(["eq", "payload->>previous_stage", "nouveau"]);
  });

  it("a quiet agency is a successful 0, not unavailable", async () => {
    const { client } = makeClient({});
    const result = await buildDashboardDailySeries(client, NOW);
    expect(result.data).toMatchObject({ status: "ok", totals: { received: 0, qualified: 0 } });
  });

  it("is unavailable (never zeros) when a read fails", async () => {
    const technical = 'relation "secret_internal_table" does not exist';
    const failing = makeClient({ activities: { data: null, error: { message: technical } } });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await buildDashboardDailySeries(failing.client, NOW);
    expect(result.error).toBeNull();
    expect(result.data).toMatchObject({ status: "unavailable", scope: { key: "last_30_days" } });
    expect(JSON.stringify(result)).not.toContain("secret_internal_table");
  });

  it("is unavailable when a read throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = makeClient({ contacts: "throw" });
    const result = await buildDashboardDailySeries(client, NOW);
    expect(result.data).toMatchObject({ status: "unavailable" });
  });

  it("refuses an invalid session", async () => {
    const { client } = makeClient({ user: null });
    const result = await buildDashboardDailySeries(client, NOW);
    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("not_authenticated");
  });
});
