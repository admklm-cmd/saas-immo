import { describe, expect, it, vi } from "vitest";

import { AGENT_ORDER } from "@/lib/agents/messages";
import type { TypedClient } from "@/lib/agents/types";

import { findAiPausedState, getAgentsDashboard, listAgentRuns } from "./data";

/**
 * Tests of the "all-or-nothing" contract of the Agents IA reads, with a stub
 * client instead of a database.
 *
 * The rule they exist for is the one CLAUDE.md states about statistics: they
 * are computed from what was really recorded, never invented. The dangerous
 * failure is not a crash — it is a read that quietly fails and is rendered as
 * "0 exécution aujourd'hui" or "0 message à valider", which an agency would
 * read as "everything is fine, nothing is waiting".
 *
 * The exactness of the figures themselves is proved against direct SQL counts
 * in `dashboard.integration.test.ts`.
 */

type StubResponse = {
  data?: unknown;
  error?: { message: string; code?: string } | null;
  count?: number | null;
};

type StubConfig = {
  user?: { id: string } | null;
  membership?: StubResponse;
  agency?: StubResponse;
  activity?: StubResponse;
  pendingCount?: StubResponse;
  /** Answer of `…maybeSingle()` on `ai_agent_runs` (the per-agent last run). */
  lastRun?: StubResponse;
  /** Answers of the awaited `ai_agent_runs` queries, consumed in order. */
  runQueries?: StubResponse[];
};

const AGENCY_ROW = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Agence de test (fictive)",
  ai_paused: false,
  ai_daily_run_limit: 100,
};

function activityRow(agent: string, today: number, blocked = 0) {
  return {
    agent_name: agent,
    today_total: today,
    today_succeeded: today - blocked,
    today_failed: 0,
    today_blocked: blocked,
    today_running: 0,
    today_input_tokens: 0,
    today_output_tokens: 0,
    window_total: today,
    window_succeeded: today - blocked,
    window_failed: 0,
    window_blocked: blocked,
    window_running: 0,
    window_input_tokens: 0,
    window_output_tokens: 0,
  };
}

/** Minimal chainable stub of the Supabase client used by `data.ts`. */
function makeClient(config: StubConfig): TypedClient {
  // `in` and not `??`: a test that configures `{ data: null }` or
  // `{ count: null }` is testing exactly that case, and must not be given the
  // default value instead.
  const settle = (response: StubResponse | undefined, fallback: StubResponse): StubResponse => ({
    data: response && "data" in response ? response.data : (fallback.data ?? null),
    error: response?.error ?? null,
    count: response && "count" in response ? response.count : (fallback.count ?? null),
  });

  const queue = [...(config.runQueries ?? [])];

  const builder = (resolveMany: () => StubResponse, resolveOne: () => StubResponse) => {
    const self: Record<string, unknown> = {};
    for (const method of ["select", "eq", "in", "neq", "gte", "order", "limit", "range", "is"]) {
      self[method] = () => self;
    }
    self.maybeSingle = () => Promise.resolve(resolveOne());
    self.single = () => Promise.resolve(resolveOne());
    self.then = (onFulfilled: (value: StubResponse) => unknown, onRejected?: () => unknown) =>
      Promise.resolve(resolveMany()).then(onFulfilled, onRejected);
    return self;
  };

  const client = {
    auth: {
      getUser: async () => ({
        data: { user: config.user === undefined ? { id: "user-1" } : config.user },
        error: config.user === null ? { message: "no session" } : null,
      }),
    },
    rpc: () => builder(() => settle(config.activity, { data: [] }), () => settle(config.activity, {})),
    from: (table: string) => {
      switch (table) {
        case "memberships":
          return builder(
            () => settle(config.membership, { data: { agency_id: AGENCY_ROW.id, role: "agent" } }),
            () => settle(config.membership, { data: { agency_id: AGENCY_ROW.id, role: "agent" } }),
          );
        case "agencies":
          return builder(
            () => settle(config.agency, { data: AGENCY_ROW }),
            () => settle(config.agency, { data: AGENCY_ROW }),
          );
        case "outbound_messages":
          return builder(
            () => settle(config.pendingCount, { count: 0 }),
            () => settle(config.pendingCount, { count: 0 }),
          );
        case "ai_agent_runs":
          return builder(
            () => settle(queue.shift(), { data: [], count: 0 }),
            () => settle(config.lastRun, { data: null }),
          );
        default:
          throw new Error(`Unexpected table in stub: ${table}`);
      }
    },
  };

  return client as unknown as TypedClient;
}

// -----------------------------------------------------------------------------

describe("getAgentsDashboard", () => {
  it("assemble les cinq agents et les chiffres réellement lus", async () => {
    const result = await getAgentsDashboard(
      makeClient({
        activity: { data: [activityRow("hugo", 5, 2), activityRow("emma", 3)] },
        pendingCount: { count: 4 },
      }),
    );

    expect(result.error).toBeNull();
    const dashboard = result.data!;
    expect(dashboard.agents.map((agent) => agent.agent)).toEqual([...AGENT_ORDER]);
    expect(dashboard.runsTodayTotal).toBe(8);
    // 8 tentatives, 2 refusées : 6 seulement consomment le quota, comme dans la base.
    expect(dashboard.runsToday).toBe(6);
    expect(dashboard.pendingValidationCount).toBe(4);
    expect(dashboard.windows.today.label).toBe("aujourd'hui");
    expect(dashboard.windows.last7Days.label).toBe("sur 7 jours");
    // Tout membre peut suspendre, seul un directeur peut réactiver.
    expect(dashboard.canResume).toBe(false);
  });

  it("autorise la réactivation pour un directeur, et pour lui seul", async () => {
    const asDirector = await getAgentsDashboard(
      makeClient({ membership: { data: { agency_id: AGENCY_ROW.id, role: "director" } } }),
    );
    expect(asDirector.data!.canResume).toBe(true);
  });

  it("dit « Jamais exécuté » seulement quand la requête dédiée n'a rien trouvé", async () => {
    const dashboard = (await getAgentsDashboard(makeClient({}))).data!;
    for (const agent of dashboard.agents) {
      expect(agent.lastRun).toBeNull();
      expect(agent.lastRunLabel).toBe("Jamais exécuté");
      expect(agent.today.runs.total).toBe(0);
    }
  });

  it("une lecture en erreur ne devient JAMAIS un tableau de zéros", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = { message: "connection reset", code: "08006" };

    const cases: StubConfig[] = [
      { agency: { error: failure } },
      { activity: { error: failure } },
      { pendingCount: { error: failure } },
      // La requête « dernière exécution » de l'un des agents échoue.
      { lastRun: { error: failure } },
      // La requête « dernières erreurs » de l'un des agents échoue.
      { runQueries: [{ error: failure }] },
    ];

    for (const config of cases) {
      const result = await getAgentsDashboard(makeClient(config));
      expect(result.data).toBeNull();
      expect(result.error).not.toBeNull();
    }
  });

  it("un comptage absent de la réponse est une erreur, pas « 0 message à valider »", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await getAgentsDashboard(makeClient({ pendingCount: { count: null } }));
    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("unexpected_error");
  });

  it("une réponse d'agrégat inattendue est une erreur, pas une page de zéros", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const payload of [null, { rows: [] }, [{ agent_name: "hugo" }]]) {
      const result = await getAgentsDashboard(makeClient({ activity: { data: payload } }));
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe("unexpected_error");
    }
  });

  it("une agence introuvable ne révèle rien et n'affiche aucun chiffre", async () => {
    const result = await getAgentsDashboard(makeClient({ agency: { data: null } }));
    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("forbidden");
  });

  it("sans session, rien n'est lu", async () => {
    const result = await getAgentsDashboard(makeClient({ user: null }));
    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("not_authenticated");
  });
});

describe("findAiPausedState", () => {
  /**
   * The kill switch is a SAFETY control: it must not vanish from the screen
   * because a statistic could not be counted. These tests pin that promise —
   * the read must not touch anything but the agency row.
   */
  it("lit le coupe-circuit sans faire le moindre comptage", async () => {
    const client = makeClient({
      // If a count, an aggregate or a per-agent query were made, the stub would
      // throw ("Unexpected table") or consume the empty queue: this read must
      // only touch `memberships` and `agencies`.
      agency: { data: { ...AGENCY_ROW, ai_paused: true } },
    });
    const result = await findAiPausedState(client);

    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      agencyId: AGENCY_ROW.id,
      agencyName: AGENCY_ROW.name,
      aiPaused: true,
      canResume: false,
    });
  });

  it("reste lisible quand les compteurs du tableau de bord échouent", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const broken = {
      activity: { error: { message: "connection reset", code: "08006" } },
      pendingCount: { error: { message: "connection reset", code: "08006" } },
      runQueries: [{ error: { message: "connection reset", code: "08006" } }],
    } satisfies StubConfig;

    // Le tableau de bord est tout-ou-rien, et c'est voulu pour des chiffres.
    expect((await getAgentsDashboard(makeClient(broken))).data).toBeNull();
    // Le coupe-circuit, lui, reste atteignable : c'est un dispositif d'urgence.
    const killSwitch = await findAiPausedState(makeClient(broken));
    expect(killSwitch.error).toBeNull();
    expect(killSwitch.data?.aiPaused).toBe(false);
  });

  it("n'autorise la réactivation qu'à un directeur", async () => {
    const asDirector = await findAiPausedState(
      makeClient({ membership: { data: { agency_id: AGENCY_ROW.id, role: "director" } } }),
    );
    expect(asDirector.data?.canResume).toBe(true);
  });

  it("sans session, ne lit rien", async () => {
    const result = await findAiPausedState(makeClient({ user: null }));
    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("not_authenticated");
  });

  it("une agence introuvable ne révèle rien", async () => {
    const result = await findAiPausedState(makeClient({ agency: { data: null } }));
    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("forbidden");
  });

  it("une lecture en erreur n'est jamais renvoyée comme « agents actifs »", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await findAiPausedState(
      makeClient({ agency: { error: { message: "connection reset", code: "08006" } } }),
    );
    expect(result.data).toBeNull();
    expect(result.error).not.toBeNull();
  });
});

describe("listAgentRuns", () => {
  it("refuse un filtre invalide avant même de lire la base", async () => {
    // Aucune réponse n'est configurée : si une requête partait, le test
    // échouerait sur le stub. Le refus doit arriver avant.
    const result = await listAgentRuns(makeClient({ user: null }), {
      agent: "zoe",
    } as never);
    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("invalid_filters");
  });

  it("un comptage en erreur n'est jamais renvoyé comme « 0 exécution »", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await listAgentRuns(
      makeClient({ runQueries: [{ error: { message: "boom", code: "08006" } }] }),
    );
    expect(result.data).toBeNull();
    expect(result.error).not.toBeNull();
  });

  it("un comptage absent de la réponse est une erreur, pas un total de zéro", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await listAgentRuns(makeClient({ runQueries: [{ count: null }] }));
    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("unexpected_error");
  });

  it("renvoie une page vide et un total exact quand l'agence n'a rien exécuté", async () => {
    const result = await listAgentRuns(makeClient({ runQueries: [{ count: 0 }, { data: [] }] }));
    expect(result.error).toBeNull();
    expect(result.data).toMatchObject({ runs: [], total: 0, hasMore: false, offset: 0, limit: 25 });
  });
});

/**
 * `contactName` — le journal doit nommer une personne, pas proposer un lien.
 *
 * Le cas dangereux n'est pas l'affichage : c'est de fabriquer un nom là où il
 * n'y en a pas. Une exécution de Léa n'a pas de contact ; elle doit valoir
 * `null`, jamais une chaîne vide ni un tiret, pour que l'interface puisse dire
 * « lead entrant » au lieu de laisser croire à une donnée manquante.
 */
describe("contactName d'une exécution", () => {
  function runRow(overrides: Record<string, unknown> = {}) {
    return {
      id: "11111111-1111-4111-8111-111111111111",
      agent: "hugo",
      status: "succeeded",
      contact_id: "22222222-2222-4222-8222-222222222222",
      decision: "Qualification enregistrée.",
      error: null,
      provider: "simulator",
      model: "simulator-v1",
      input_tokens: 10,
      output_tokens: 5,
      is_simulation: true,
      started_at: "2026-09-17T08:00:00.000Z",
      finished_at: "2026-09-17T08:00:01.000Z",
      contacts: { first_name: "Sophie", last_name: "Marchand" },
      ...overrides,
    };
  }

  async function firstRun(row: Record<string, unknown>) {
    const result = await listAgentRuns(makeClient({ runQueries: [{ count: 1 }, { data: [row] }] }));
    expect(result.error).toBeNull();
    return result.data!.runs[0]!;
  }

  it("nomme le contact de l'exécution", async () => {
    expect((await firstRun(runRow())).contactName).toBe("Sophie Marchand");
  });

  it("vaut null — et rien d'autre — pour une exécution sans contact (Léa)", async () => {
    const run = await firstRun(runRow({ agent: "lea", contact_id: null, contacts: null }));
    expect(run.contactId).toBeNull();
    expect(run.contactName).toBeNull();
    // Explicite : ni chaîne vide, ni tiret, ni « — ».
    expect(run.contactName).not.toBe("");
    expect(run.contactName).not.toBe("-");
  });

  it("se contente du prénom ou du nom quand l'autre manque", async () => {
    expect((await firstRun(runRow({ contacts: { first_name: "Sophie", last_name: null } }))).contactName).toBe(
      "Sophie",
    );
    expect((await firstRun(runRow({ contacts: { first_name: null, last_name: "Marchand" } }))).contactName).toBe(
      "Marchand",
    );
    // Des espaces seuls ne font pas un nom.
    expect((await firstRun(runRow({ contacts: { first_name: "  ", last_name: "  " } }))).contactName).toBe(
      "Contact sans nom",
    );
  });

  it("ne fabrique aucun nom quand la fiche n'est pas lisible", async () => {
    // Cas théorique (la clé étrangère composite rattache le contact à la même
    // agence) : si la jointure ne ramène rien, on ne nomme personne.
    expect((await firstRun(runRow({ contacts: null }))).contactName).toBeNull();
  });
});
