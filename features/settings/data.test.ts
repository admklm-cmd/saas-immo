import { afterEach, describe, expect, it, vi } from "vitest";

import type { TypedClient } from "@/lib/agents/types";

import { buildAgencySettings, SETTINGS_INTEGRATIONS } from "./data";
import { SETTINGS_INTEGRATION_KEYS } from "./types";

/**
 * Contract of the settings read, with a stub client instead of a database:
 *
 *   * each section is independent: one failing read is `unavailable`, the
 *     others stay `ok`;
 *   * invalid session / no agency → `{ data: null, error }`;
 *   * the member list comes from the RPC for the agency resolved server-side,
 *     is parsed strictly, and flags the signed-in user;
 *   * integrations: static, all `simulation`, none connected, no secret;
 *   * no technical detail ever reaches the result.
 *
 * Isolation between two agencies and the RPC privileges are proved in
 * `settings.integration.test.ts`.
 */

const AGENCY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "22222222-2222-4222-8222-222222222222";
const TECHNICAL = 'relation "secret_internal_table" does not exist';

type StubResponse = { data?: unknown; error?: { message: string; code?: string } | null };

type StubConfig = {
  user?: { id: string } | null;
  membership?: StubResponse;
  /** Answer to the `agencies` read of the profile/limit (columns include `city`). */
  agency?: StubResponse | "throw";
  /** Answer to the `agencies` read of `findAiPausedState` (columns include `ai_paused`). */
  killSwitch?: StubResponse | "throw";
  members?: StubResponse | "throw";
};

type RpcCall = { name: string; args: unknown };

function settle(response: StubResponse | undefined, fallback: unknown) {
  return {
    data: response && "data" in response ? response.data : fallback,
    error: response?.error ?? null,
  };
}

function makeClient(config: StubConfig = {}): { client: TypedClient; rpcCalls: RpcCall[]; writes: string[] } {
  const rpcCalls: RpcCall[] = [];
  const writes: string[] = [];

  const builder = (resolve: (columns: string) => StubResponse | "throw", fallback: (columns: string) => unknown) => {
    let columns = "";
    const self: Record<string, unknown> = {};
    self.select = (value: string) => {
      columns = value;
      return self;
    };
    for (const method of ["eq", "order", "limit"]) self[method] = () => self;
    for (const method of ["insert", "update", "upsert", "delete"]) {
      self[method] = () => {
        writes.push(method);
        return self;
      };
    }
    self.maybeSingle = () => {
      const answer = resolve(columns);
      if (answer === "throw") return Promise.reject(new Error(TECHNICAL));
      return Promise.resolve(settle(answer, fallback(columns)));
    };
    return self;
  };

  const client = {
    auth: {
      getUser: async () => ({
        data: { user: config.user === undefined ? { id: USER_ID } : config.user },
        error: config.user === null ? { message: "no session" } : null,
      }),
    },
    rpc: (name: string, args: unknown) => {
      rpcCalls.push({ name, args });
      if (config.members === "throw") return Promise.reject(new Error(TECHNICAL));
      return Promise.resolve(
        settle(config.members, [
          { user_id: USER_ID, email: "moi@example.test", role: "agent", created_at: "2026-09-01T08:00:00+00:00" },
          { user_id: OTHER_ID, email: "directeur@example.test", role: "director", created_at: "2026-08-01T08:00:00+00:00" },
        ]),
      );
    },
    from: (table: string) => {
      if (table === "memberships") {
        return builder(
          () => config.membership ?? {},
          () => ({ agency_id: AGENCY_ID, role: "agent" }),
        );
      }
      if (table === "agencies") {
        return builder(
          (columns) => (columns.includes("ai_paused") ? (config.killSwitch ?? {}) : (config.agency ?? {})),
          (columns) =>
            columns.includes("ai_paused")
              ? { id: AGENCY_ID, name: "Agence test (fictive)", ai_paused: true }
              : { name: "Agence test (fictive)", city: "La Ciotat", sector: null, ai_daily_run_limit: 120 },
        );
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as unknown as TypedClient;

  return { client, rpcCalls, writes };
}

afterEach(() => {
  vi.restoreAllMocks();
});

function silenceLogs() {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
}

describe("buildAgencySettings — cas nominal", () => {
  it("renvoie chaque section, l'agence résolue côté serveur et l'indicateur « vous »", async () => {
    const { client, rpcCalls, writes } = makeClient();
    const result = await buildAgencySettings(client);

    expect(result.error).toBeNull();
    const data = result.data!;
    expect(data.agencyId).toBe(AGENCY_ID);
    expect(data.viewer).toEqual({ userId: USER_ID, role: "agent" });
    expect(data.agency).toEqual({
      status: "ok",
      value: { name: "Agence test (fictive)", city: "La Ciotat", sector: null },
    });
    expect(data.agents).toEqual({
      killSwitch: { status: "ok", value: { aiPaused: true, canResume: false } },
      dailyRunLimit: { status: "ok", value: 120 },
    });
    expect(data.members).toEqual({
      status: "ok",
      value: [
        {
          userId: USER_ID,
          email: "moi@example.test",
          role: "agent",
          memberSince: "2026-09-01T08:00:00.000Z",
          isCurrentUser: true,
        },
        {
          userId: OTHER_ID,
          email: "directeur@example.test",
          role: "director",
          memberSince: "2026-08-01T08:00:00.000Z",
          isCurrentUser: false,
        },
      ],
    });
    expect(data.retention).toEqual({ status: "undefined" });

    // The RPC receives the agency resolved server-side, nothing else.
    expect(rpcCalls).toEqual([{ name: "list_agency_members", args: { target_agency: AGENCY_ID } }]);
    // Read-only.
    expect(writes).toEqual([]);
  });

  it("un directeur peut réactiver (canResume vrai)", async () => {
    const { client } = makeClient({ membership: { data: { agency_id: AGENCY_ID, role: "director" } } });
    const result = await buildAgencySettings(client);
    expect(result.data!.viewer.role).toBe("director");
    expect(result.data!.agents.killSwitch).toEqual({ status: "ok", value: { aiPaused: true, canResume: true } });
  });
});

describe("buildAgencySettings — intégrations", () => {
  it("liste statique : les sept intégrations prévues, toutes en simulation, aucune connectée", async () => {
    const { client } = makeClient();
    const { integrations } = (await buildAgencySettings(client)).data!;

    expect(integrations.map((integration) => integration.key)).toEqual([...SETTINGS_INTEGRATION_KEYS]);
    expect(integrations.map((integration) => integration.name)).toEqual([
      "Hektor",
      "Apimo",
      "Netty",
      "WhatsApp Business",
      "SMS",
      "Google Agenda",
      "Outlook",
    ]);
    for (const integration of integrations) {
      expect(integration.status).toBe("simulation");
      expect(integration.connected).toBe(false);
      // Nothing that looks like a credential is part of an entry.
      expect(Object.keys(integration).sort()).toEqual(["category", "connected", "key", "name", "simulates", "status"]);
    }
  });

  it("les logiciels immo n'échangent rien, même en simulation", () => {
    const software = SETTINGS_INTEGRATIONS.filter((integration) => integration.category === "real_estate_software");
    expect(software).toHaveLength(3);
    for (const integration of software) expect(integration.simulates).toBeNull();
  });

  it("la liste renvoyée est une copie : la modifier ne change pas la constante", async () => {
    const { client } = makeClient();
    const { integrations } = (await buildAgencySettings(client)).data!;
    (integrations[0] as { name: string }).name = "Modifié";
    expect(SETTINGS_INTEGRATIONS[0]!.name).toBe("Hektor");
  });
});

describe("buildAgencySettings — sections indépendantes", () => {
  it("membres en échec (erreur base) => seule la section membres est indisponible", async () => {
    silenceLogs();
    const { client } = makeClient({ members: { error: { message: TECHNICAL, code: "42P01" } } });
    const result = await buildAgencySettings(client);

    expect(result.error).toBeNull();
    expect(result.data!.members).toEqual({ status: "unavailable" });
    expect(result.data!.agency.status).toBe("ok");
    expect(result.data!.agents.killSwitch.status).toBe("ok");
    expect(result.data!.agents.dailyRunLimit.status).toBe("ok");
    expect(JSON.stringify(result)).not.toContain("secret_internal_table");
  });

  it("membres : exception => indisponible, sans fuite technique", async () => {
    silenceLogs();
    const { client } = makeClient({ members: "throw" });
    const result = await buildAgencySettings(client);
    expect(result.data!.members).toEqual({ status: "unavailable" });
    expect(result.data!.agency.status).toBe("ok");
    expect(JSON.stringify(result)).not.toContain("secret_internal_table");
  });

  it.each([
    ["un champ en trop (téléphone)", [{ user_id: USER_ID, email: "a@example.test", role: "agent", created_at: "2026-09-01T08:00:00Z", phone: "0600000000" }]],
    ["un rôle inconnu", [{ user_id: USER_ID, email: "a@example.test", role: "admin", created_at: "2026-09-01T08:00:00Z" }]],
    ["un identifiant invalide", [{ user_id: "x", email: "a@example.test", role: "agent", created_at: "2026-09-01T08:00:00Z" }]],
    ["une date invalide", [{ user_id: USER_ID, email: "a@example.test", role: "agent", created_at: "hier" }]],
    ["pas un tableau", { user_id: USER_ID }],
    ["null", null],
  ])("membres : charge inattendue (%s) => indisponible, jamais transmise telle quelle", async (_label, payload) => {
    silenceLogs();
    const { client } = makeClient({ members: { data: payload } });
    const result = await buildAgencySettings(client);
    expect(result.data!.members).toEqual({ status: "unavailable" });
  });

  it("membres : un e-mail absent reste null (jamais inventé)", async () => {
    const { client } = makeClient({
      members: { data: [{ user_id: USER_ID, email: null, role: "agent", created_at: "2026-09-01T08:00:00Z" }] },
    });
    const result = await buildAgencySettings(client);
    expect(result.data!.members).toMatchObject({ status: "ok", value: [{ email: null, isCurrentUser: true }] });
  });

  it("lecture de l'agence en échec => profil et limite indisponibles, coupe-circuit et membres conservés", async () => {
    silenceLogs();
    const { client } = makeClient({ agency: { error: { message: TECHNICAL } } });
    const result = await buildAgencySettings(client);

    expect(result.data!.agency).toEqual({ status: "unavailable" });
    expect(result.data!.agents.dailyRunLimit).toEqual({ status: "unavailable" });
    expect(result.data!.agents.killSwitch).toEqual({ status: "ok", value: { aiPaused: true, canResume: false } });
    expect(result.data!.members.status).toBe("ok");
    expect(result.data!.integrations).toHaveLength(7);
    expect(result.data!.retention).toEqual({ status: "undefined" });
  });

  it("lecture de l'agence qui lève une exception => indisponible, pas de rejet non géré", async () => {
    silenceLogs();
    const { client } = makeClient({ agency: "throw" });
    const result = await buildAgencySettings(client);
    expect(result.error).toBeNull();
    expect(result.data!.agency).toEqual({ status: "unavailable" });
    expect(result.data!.agents.dailyRunLimit).toEqual({ status: "unavailable" });
  });

  it("agence introuvable (RLS) => profil indisponible, jamais un profil vide", async () => {
    silenceLogs();
    const { client } = makeClient({ agency: { data: null } });
    const result = await buildAgencySettings(client);
    expect(result.data!.agency).toEqual({ status: "unavailable" });
  });

  it("coupe-circuit en échec => seul le coupe-circuit est indisponible", async () => {
    silenceLogs();
    const { client } = makeClient({ killSwitch: { error: { message: TECHNICAL } } });
    const result = await buildAgencySettings(client);
    expect(result.data!.agents.killSwitch).toEqual({ status: "unavailable" });
    expect(result.data!.agents.dailyRunLimit).toEqual({ status: "ok", value: 120 });
    expect(result.data!.agency.status).toBe("ok");
    expect(result.data!.members.status).toBe("ok");
  });
});

describe("buildAgencySettings — session et agence", () => {
  it("session invalide => { data: null, error }, aucune lecture métier", async () => {
    const { client, rpcCalls } = makeClient({ user: null });
    const result = await buildAgencySettings(client);
    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("not_authenticated");
    expect(rpcCalls).toEqual([]);
  });

  it("utilisateur sans agence => { data: null, error: no_agency }", async () => {
    const { client, rpcCalls } = makeClient({ membership: { data: null } });
    const result = await buildAgencySettings(client);
    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("no_agency");
    expect(rpcCalls).toEqual([]);
  });

  it("lecture de l'appartenance en échec => erreur claire, sans détail technique", async () => {
    silenceLogs();
    const { client } = makeClient({ membership: { error: { message: TECHNICAL } } });
    const result = await buildAgencySettings(client);
    expect(result.data).toBeNull();
    expect(result.error).not.toBeNull();
    expect(JSON.stringify(result)).not.toContain("secret_internal_table");
  });
});
