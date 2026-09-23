import { afterEach, describe, expect, it, vi } from "vitest";

import type { TypedClient } from "@/lib/agents/types";

import { buildDashboardSummary } from "./data";
import { DASHBOARD_PIPELINE_STAGES, type DashboardIndicator } from "./types";

/**
 * The contract of the dashboard read, with a stub client instead of a database:
 *
 *   * a figure is `ok` only when its computation succeeded — `0` is a measured
 *     zero, never the fallback of a failed read;
 *   * one failing indicator is `unavailable` and does NOT hide the others
 *     (unlike `getAgentsDashboard`, which is all-or-nothing on purpose);
 *   * an invalid session or a caller without agency is `{ data: null, error }`;
 *   * no technical detail ever reaches the result.
 *
 * Exactness against real rows, > 50 items and isolation between two agencies
 * are proved in `dashboard.integration.test.ts`.
 */

const AGENCY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CONTACT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const NOW = new Date("2026-09-23T10:30:00Z");

type StubResponse = {
  data?: unknown;
  error?: { message: string; code?: string } | null;
  count?: number | null;
};

/** What one awaited query looked like, so a handler can answer it. */
type RecordedQuery = {
  table: string;
  head: boolean;
  columns: string;
  filters: Array<[string, string, unknown]>;
  limit: number | null;
};

type Handler = (query: RecordedQuery) => StubResponse | "throw" | undefined;

type StubConfig = {
  user?: { id: string } | null;
  membership?: StubResponse;
  agency?: StubResponse;
  activity?: StubResponse | "throw";
  /** Answers every business query; `undefined` → default (empty, count 0). */
  handler?: Handler;
};

const TECHNICAL = "relation \"secret_internal_table\" does not exist";

function makeClient(config: StubConfig = {}): { client: TypedClient; queries: RecordedQuery[] } {
  const queries: RecordedQuery[] = [];

  const settle = (response: StubResponse | undefined, fallback: StubResponse) => ({
    data: response && "data" in response ? response.data : (fallback.data ?? null),
    error: response?.error ?? null,
    count: response && "count" in response ? response.count : (fallback.count ?? null),
  });

  const businessBuilder = (table: string) => {
    const query: RecordedQuery = { table, head: false, columns: "", filters: [], limit: null };
    const self: Record<string, unknown> = {};
    self.select = (columns: string, options?: { head?: boolean }) => {
      query.columns = columns;
      query.head = options?.head === true;
      return self;
    };
    for (const method of ["eq", "in", "gte", "neq"]) {
      self[method] = (column: string, value: unknown) => {
        query.filters.push([method, column, value]);
        return self;
      };
    }
    self.order = () => self;
    self.limit = (value: number) => {
      query.limit = value;
      return self;
    };
    self.then = (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => {
      queries.push(query);
      const answer = config.handler?.(query);
      if (answer === "throw") return Promise.reject(new Error(TECHNICAL)).then(onFulfilled, onRejected);
      return Promise.resolve(settle(answer, { data: [], count: 0 })).then(onFulfilled, onRejected);
    };
    return self;
  };

  const singleBuilder = (response: () => StubResponse) => {
    const self: Record<string, unknown> = {};
    for (const method of ["select", "eq", "order", "limit"]) self[method] = () => self;
    self.maybeSingle = () => Promise.resolve(response());
    return self;
  };

  const client = {
    auth: {
      getUser: async () => ({
        data: { user: config.user === undefined ? { id: "user-1" } : config.user },
        error: config.user === null ? { message: "no session" } : null,
      }),
    },
    rpc: () => {
      if (config.activity === "throw") return Promise.reject(new Error(TECHNICAL));
      return Promise.resolve(settle(config.activity, { data: [] }));
    },
    from: (table: string) => {
      if (table === "memberships") {
        return singleBuilder(() =>
          settle(config.membership, { data: { agency_id: AGENCY_ID, role: "agent" } }),
        );
      }
      if (table === "agencies") {
        return singleBuilder(() =>
          settle(config.agency, { data: { id: AGENCY_ID, name: "Agence test (fictive)", ai_paused: false } }),
        );
      }
      return businessBuilder(table);
    },
  };

  return { client: client as unknown as TypedClient, queries };
}

function activityRow(agent: string, today: { total: number; failed: number }, week: { total: number; failed: number }) {
  return {
    agent_name: agent,
    today_total: today.total,
    today_succeeded: today.total - today.failed,
    today_failed: today.failed,
    today_blocked: 0,
    today_running: 0,
    today_input_tokens: 0,
    today_output_tokens: 0,
    // bigint serialised as a string by PostgREST: must be accepted.
    window_total: String(week.total),
    window_succeeded: week.total - week.failed,
    window_failed: week.failed,
    window_blocked: 0,
    window_running: 0,
    window_input_tokens: 0,
    window_output_tokens: 0,
  };
}

function hasFilter(query: RecordedQuery, column: string, value?: unknown): boolean {
  return query.filters.some(
    ([, name, filterValue]) =>
      name === column && (value === undefined || JSON.stringify(filterValue) === JSON.stringify(value)),
  );
}

function valueOf<T>(indicator: DashboardIndicator<T>): T {
  if (indicator.status !== "ok") throw new Error(`indicator unavailable: ${JSON.stringify(indicator.scope)}`);
  return indicator.value;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildDashboardSummary — session et agence", () => {
  it("sans session : tout est refusé, rien n'est compté", async () => {
    const { client, queries } = makeClient({ user: null });
    const result = await buildDashboardSummary(client, NOW);
    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("not_authenticated");
    expect(queries).toHaveLength(0);
  });

  it("sans agence : tout est refusé, rien n'est compté", async () => {
    const { client, queries } = makeClient({ membership: { data: null } });
    const result = await buildDashboardSummary(client, NOW);
    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("no_agency");
    expect(queries).toHaveLength(0);
  });
});

describe("buildDashboardSummary — chiffres mesurés", () => {
  it("renvoie les totaux exacts et un échantillon avec les identifiants des liens", async () => {
    const { client, queries } = makeClient({
      activity: {
        data: [
          activityRow("hugo", { total: 4, failed: 1 }, { total: 20, failed: 3 }),
          activityRow("emma", { total: 2, failed: 0 }, { total: 9, failed: 1 }),
        ],
      },
      handler: (query) => {
        if (query.table === "outbound_messages") {
          return query.head
            ? { count: 73 }
            : {
                data: [
                  {
                    id: "m1",
                    contact_id: CONTACT_ID,
                    channel: "email",
                    status: "pending_validation",
                    is_simulation: true,
                    created_by_agent: "louis",
                    created_at: "2026-09-20T08:00:00+00:00",
                    contacts: { first_name: "Jeanne", last_name: "Martin" },
                  },
                ],
              };
        }
        if (query.table === "contacts") {
          const stage = query.filters.find(([, column]) => column === "stage")?.[2];
          return { count: stage === "chaud" ? 1200 : 3 };
        }
        if (query.table === "tasks" && !query.head) {
          return {
            data: [
              {
                id: "t1",
                contact_id: null,
                type: "review",
                title: "Revoir les réglages",
                due_at: null,
                created_by_agent: null,
                created_at: "2026-09-22T08:00:00Z",
                contacts: null,
              },
            ],
          };
        }
        return undefined;
      },
    });

    const result = await buildDashboardSummary(client, NOW);
    expect(result.error).toBeNull();
    const summary = result.data!;

    expect(summary.agencyId).toBe(AGENCY_ID);
    expect(summary.generatedAt).toBe(NOW.toISOString());
    expect(summary.timeZone).toBe("Europe/Paris");

    // Total exact (73), échantillon limité, et « il y en a d'autres ».
    const messages = valueOf(summary.todo.messagesToValidate);
    expect(messages.total).toBe(73);
    expect(messages.sampleLimit).toBe(5);
    expect(messages.hasMore).toBe(true);
    expect(messages.items).toEqual([
      {
        id: "m1",
        contactId: CONTACT_ID,
        contactName: "Jeanne Martin",
        channel: "email",
        status: "pending_validation",
        createdByAgent: "louis",
        isSimulation: true,
        createdAt: "2026-09-20T08:00:00.000Z",
      },
    ]);
    expect(summary.todo.messagesToValidate.scope).toEqual({ key: "pending_all_time" });

    // Une tâche d'agence n'a ni contact ni nom inventé.
    const tasks = valueOf(summary.todo.openTasks);
    expect(tasks.items[0]).toMatchObject({ contactId: null, contactName: null, dueAt: null });
    expect(summary.todo.openTasks.scope).toEqual({ key: "open_all_time" });

    // Pipeline : un comptage par étape, dans l'ordre du parcours, au-delà de 1000.
    expect(summary.pipeline.stages.map((entry) => entry.stage)).toEqual([...DASHBOARD_PIPELINE_STAGES]);
    const chaud = summary.pipeline.stages.find((entry) => entry.stage === "chaud")!;
    expect(valueOf(chaud.count)).toBe(1200);
    expect(chaud.count.scope).toEqual({ key: "current", at: NOW.toISOString() });

    // Agents : sommes exactes par fenêtre, fenêtres nommées en heure de Paris.
    expect(valueOf(summary.agents.runsToday)).toEqual({ total: 6, succeeded: 5, failed: 1, blocked: 0, running: 0 });
    expect(valueOf(summary.agents.runsLast7Days)).toEqual({
      total: 29,
      succeeded: 25,
      failed: 4,
      blocked: 0,
      running: 0,
    });
    expect(summary.agents.runsToday.scope).toEqual({
      key: "today",
      // 23/09/2026 00:00 à Paris (UTC+2).
      startsAt: "2026-09-22T22:00:00.000Z",
      endsAt: NOW.toISOString(),
      days: 1,
      timeZone: "Europe/Paris",
    });
    expect(summary.agents.runsLast7Days.scope).toEqual({
      key: "last_7_days",
      startsAt: "2026-09-16T22:00:00.000Z",
      endsAt: NOW.toISOString(),
      days: 7,
      timeZone: "Europe/Paris",
    });
    expect(valueOf(summary.agents.killSwitch)).toEqual({ aiPaused: false, canResume: false });

    expect(summary.upcomingAppointments.scope).toEqual({
      key: "upcoming",
      startsAt: NOW.toISOString(),
      timeZone: "Europe/Paris",
    });

    // Chaque requête est filtrée par l'agence résolue côté serveur, et aucune
    // lecture de liste ne dépasse l'échantillon.
    for (const query of queries) {
      expect(hasFilter(query, "agency_id", AGENCY_ID)).toBe(true);
      if (!query.head) expect(query.limit).toBe(5);
    }
  });

  it("applique les mêmes définitions que les écrans liés", async () => {
    const { client, queries } = makeClient();
    await buildDashboardSummary(client, NOW);

    const counts = queries.filter((query) => query.head);
    const find = (table: string, predicate: (query: RecordedQuery) => boolean) =>
      counts.find((query) => query.table === table && predicate(query));

    // File « à valider » : brouillons à valider ET validés non envoyés.
    expect(find("outbound_messages", (q) => hasFilter(q, "status", ["pending_validation", "approved"]))).toBeDefined();
    // Leads : seulement ceux que Léa peut encore traiter.
    expect(find("inbound_leads", (q) => hasFilter(q, "status", "pending"))).toBeDefined();
    // À confirmer = canBeConfirmed : proposé ET étape du contact compatible.
    const toConfirm = find("appointments", (q) => hasFilter(q, "status", "proposed"))!;
    expect(hasFilter(toConfirm, "contacts.stage", ["qualifie", "chaud", "rdv_planifie"])).toBe(true);
    expect(toConfirm.columns).toContain("!inner");
    // À clôturer = canBeCompleted : confirmé.
    expect(find("appointments", (q) => hasFilter(q, "status", "confirmed"))).toBeDefined();
    // À venir : proposés ou confirmés, à partir de maintenant.
    const upcoming = find("appointments", (q) => hasFilter(q, "starts_at"))!;
    expect(hasFilter(upcoming, "status", ["proposed", "confirmed"])).toBe(true);
    expect(hasFilter(upcoming, "starts_at", NOW.toISOString())).toBe(true);
    expect(find("tasks", (q) => hasFilter(q, "status", "open"))).toBeDefined();
  });

  it("un zéro renvoyé est un zéro mesuré (status ok, value 0)", async () => {
    const { client } = makeClient();
    const summary = (await buildDashboardSummary(client, NOW)).data!;

    for (const list of [
      summary.todo.messagesToValidate,
      summary.todo.inboundLeadsToProcess,
      summary.todo.appointmentsToConfirm,
      summary.todo.appointmentsToClose,
      summary.todo.openTasks,
      summary.upcomingAppointments,
    ]) {
      expect(list).toMatchObject({ status: "ok", value: { total: 0, items: [], hasMore: false } });
    }
    for (const entry of summary.pipeline.stages) {
      expect(entry.count).toMatchObject({ status: "ok", value: 0 });
    }
    // Aucune exécution dans la fenêtre : un agrégat vide est un vrai zéro.
    expect(summary.agents.runsToday).toMatchObject({ status: "ok", value: { total: 0, failed: 0 } });
  });
});

describe("buildDashboardSummary — un indicateur en échec ne masque pas les autres", () => {
  const failure = { message: TECHNICAL, code: "42P01" };

  it("échec du comptage des messages : seul cet indicateur est indisponible", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = makeClient({
      handler: (query) => (query.table === "outbound_messages" && query.head ? { error: failure } : undefined),
    });
    const result = await buildDashboardSummary(client, NOW);

    expect(result.error).toBeNull();
    const summary = result.data!;
    expect(summary.todo.messagesToValidate).toEqual({ status: "unavailable", scope: { key: "pending_all_time" } });
    expect(summary.todo.inboundLeadsToProcess.status).toBe("ok");
    expect(summary.todo.openTasks.status).toBe("ok");
    expect(summary.pipeline.stages.every((entry) => entry.count.status === "ok")).toBe(true);
    expect(summary.agents.killSwitch.status).toBe("ok");
    expect(summary.upcomingAppointments.status).toBe("ok");
  });

  it("un comptage absent de la réponse n'est pas un zéro", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = makeClient({
      handler: (query) => (query.table === "inbound_leads" && query.head ? { count: null } : undefined),
    });
    const summary = (await buildDashboardSummary(client, NOW)).data!;
    expect(summary.todo.inboundLeadsToProcess.status).toBe("unavailable");
    expect(summary.todo.messagesToValidate.status).toBe("ok");
  });

  it("échec de l'échantillon : la liste est indisponible, pas un total sans liens", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = makeClient({
      handler: (query) => (query.table === "tasks" && !query.head ? { error: failure } : { count: 4 }),
    });
    const summary = (await buildDashboardSummary(client, NOW)).data!;
    expect(summary.todo.openTasks.status).toBe("unavailable");
    expect(valueOf(summary.todo.messagesToValidate).total).toBe(4);
  });

  it("une étape du pipeline en échec n'efface pas les autres étapes", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = makeClient({
      handler: (query) =>
        query.table === "contacts" && hasFilter(query, "stage", "mandat_signe") ? "throw" : { count: 2 },
    });
    const summary = (await buildDashboardSummary(client, NOW)).data!;
    for (const entry of summary.pipeline.stages) {
      expect(entry.count.status).toBe(entry.stage === "mandat_signe" ? "unavailable" : "ok");
    }
  });

  it("agrégat d'activité en échec ou invalide : exécutions indisponibles, coupe-circuit toujours là", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const activity of [{ error: failure }, { data: [{ agent_name: "hugo" }] }, "throw" as const]) {
      const summary = (await buildDashboardSummary(makeClient({ activity }).client, NOW)).data!;
      expect(summary.agents.runsToday.status).toBe("unavailable");
      expect(summary.agents.runsLast7Days.status).toBe("unavailable");
      expect(summary.agents.killSwitch).toMatchObject({ status: "ok", value: { aiPaused: false } });
      expect(summary.todo.messagesToValidate.status).toBe("ok");
    }
  });

  it("coupe-circuit illisible : indisponible, jamais « agents actifs » par défaut", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const summary = (await buildDashboardSummary(makeClient({ agency: { error: failure } }).client, NOW)).data!;
    expect(summary.agents.killSwitch.status).toBe("unavailable");
    expect(summary.agents.runsToday.status).toBe("ok");
  });

  it("tout en échec : le tableau reste renvoyé, tout indisponible, sans détail technique", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = makeClient({ activity: "throw", agency: { error: failure }, handler: () => "throw" });
    const result = await buildDashboardSummary(client, NOW);

    expect(result.error).toBeNull();
    const summary = result.data!;
    const indicators = [
      ...Object.values(summary.todo),
      ...summary.pipeline.stages.map((entry) => entry.count),
      summary.agents.killSwitch,
      summary.agents.runsToday,
      summary.agents.runsLast7Days,
      summary.upcomingAppointments,
    ];
    expect(indicators.every((indicator) => indicator.status === "unavailable")).toBe(true);
    expect(JSON.stringify(summary)).not.toContain("secret_internal_table");
    // Le détail technique est bien logué côté serveur.
    expect(logged).toHaveBeenCalled();
  });
});
