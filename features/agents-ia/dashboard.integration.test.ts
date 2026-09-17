import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AGENT_ORDER } from "@/lib/agents/messages";
import { parisDayStart, parisWindowStart } from "@/lib/agents/time";
import type { AiAgentName } from "@/lib/agents/types";
import { setupTestEnv, type TestEnv, type TypedClient } from "@/lib/supabase/testing/local-test-env";

import { findAiPausedState, getAgentsDashboard, listAgentRuns } from "./data";

/**
 * The "Agents IA" screen against the LOCAL Supabase stack, with real sessions
 * (RLS applies). `getAgentsOverview()` and `getAgentRuns()` (queries.ts) are
 * one-line wrappers that only build the request-scoped client, so the reads
 * themselves are exercised here.
 *
 * What is proved:
 *   * every figure equals a DIRECT count of the same rows — this is the test
 *     that keeps the old "500 most recent runs" sample from coming back;
 *   * `runsToday` counts exactly what the database guard counts against
 *     `ai_daily_run_limit` (everything except the refused attempts);
 *   * an agent that really ran is never displayed as "Jamais exécuté", even
 *     after hundreds of runs of another agent;
 *   * Léa's runs, which have no contact at all, come back cleanly;
 *   * an agency never sees a figure or a run of the other one.
 */

let env: TestEnv;
let agentA: TypedClient;
let directorA: TypedClient;
let userB: TypedClient;

/** Raised for agency A so the volume test can go past the old 500 bound. */
const HIGH_DAILY_LIMIT = 10_000;

type RunSeed = {
  agent: AiAgentName;
  count?: number;
  status?: "running" | "succeeded" | "failed" | "blocked";
  agency?: "a" | "b";
  withContact?: boolean;
  tokens?: number;
};

/** Inserts real runs through the real guard: nothing is faked in the journal. */
async function insertRuns(seed: RunSeed): Promise<string[]> {
  const agency = seed.agency === "b" ? env.agencyB : env.agencyA;
  const count = seed.count ?? 1;
  const status = seed.status ?? "succeeded";
  const blocked = status === "blocked";

  const rows = Array.from({ length: count }, () => ({
    agency_id: agency.agencyId,
    agent: seed.agent,
    contact_id: seed.withContact ? agency.contactId : null,
    // The guard only accepts 'running' or 'blocked' at insert time; the other
    // outcomes are reached by the same UPDATE the runner does.
    status: blocked ? ("blocked" as const) : ("running" as const),
    error: blocked ? "ai_paused" : null,
    decision: blocked ? "Arrêt : le coupe-circuit de l'agence est actif." : null,
    input_tokens: seed.tokens ?? 0,
    output_tokens: seed.tokens ?? 0,
  }));

  const inserted = await env.admin.from("ai_agent_runs").insert(rows).select("id");
  if (inserted.error) throw new Error(`insertRuns(${seed.agent}): ${inserted.error.message}`);
  const ids = (inserted.data ?? []).map((row) => row.id);

  if (status === "succeeded" || status === "failed") {
    // Chunked: a few hundred identifiers in one `in(...)` make a URL PostgREST
    // refuses ("URI too long"). The runner closes runs one by one anyway.
    for (let start = 0; start < ids.length; start += 50) {
      const updated = await env.admin
        .from("ai_agent_runs")
        .update({
          status,
          error: status === "failed" ? "ai_response_invalid" : null,
          decision:
            status === "failed" ? "Sortie refusée par le schéma." : "Qualification enregistrée.",
        })
        .in("id", ids.slice(start, start + 50));
      if (updated.error) throw new Error(`insertRuns(update ${seed.agent}): ${updated.error.message}`);
    }
  }
  return ids;
}

/**
 * A direct count of the runs of an agency, read on its own.
 *
 * This is the reference the dashboard is compared against: a different query,
 * a different code path (PostgREST `count: exact` instead of the SQL aggregate),
 * on the same rows.
 */
async function countRuns(options: {
  agency?: "a" | "b";
  agent?: AiAgentName;
  since?: Date;
  excludeBlocked?: boolean;
  status?: "running" | "succeeded" | "failed" | "blocked";
}): Promise<number> {
  const agency = options.agency === "b" ? env.agencyB : env.agencyA;
  let query = env.admin
    .from("ai_agent_runs")
    .select("id", { count: "exact", head: true })
    .eq("agency_id", agency.agencyId);
  if (options.agent) query = query.eq("agent", options.agent);
  if (options.status) query = query.eq("status", options.status);
  if (options.since) query = query.gte("started_at", options.since.toISOString());
  if (options.excludeBlocked) query = query.neq("status", "blocked");

  const { count, error } = await query;
  if (error) throw new Error(`countRuns: ${error.message}`);
  if (typeof count !== "number") throw new Error("countRuns: no exact count returned");
  return count;
}

beforeAll(async () => {
  env = await setupTestEnv();
  agentA = env.users.agentA.client;
  directorA = env.users.directorA.client;
  userB = env.users.userB.client;

  const { error } = await env.admin
    .from("agencies")
    .update({ ai_daily_run_limit: HIGH_DAILY_LIMIT })
    .eq("id", env.agencyA.agencyId);
  if (error) throw new Error(`raise daily limit: ${error.message}`);

  // Sarah runs once, early, and never again: the flood of Emma runs inserted
  // later must not make her look like she never ran.
  await insertRuns({ agent: "sarah", withContact: true, tokens: 12 });
}, 180_000);

afterAll(async () => {
  if (env) await env.cleanup();
});

describe("Tableau de bord des agents IA", () => {
  it("montre les cinq agents, leurs missions et les deux fenêtres nommées", async () => {
    const result = await getAgentsDashboard(agentA);

    expect(result.error).toBeNull();
    const dashboard = result.data!;
    expect(dashboard.agencyId).toBe(env.agencyA.agencyId);
    expect(dashboard.agents.map((agent) => agent.agent)).toEqual([...AGENT_ORDER]);
    for (const agent of dashboard.agents) {
      expect(agent.label.length).toBeGreaterThan(0);
      expect(agent.mission.length).toBeGreaterThan(0);
    }

    // Les fenêtres sont explicites, et calculées en heure de Paris.
    const now = new Date();
    expect(dashboard.windows.today).toMatchObject({ key: "today", label: "aujourd'hui", days: 1 });
    expect(dashboard.windows.last7Days).toMatchObject({ key: "last7Days", days: 7 });
    expect(Date.parse(dashboard.windows.today.startsAt)).toBe(parisDayStart(now).getTime());
    expect(Date.parse(dashboard.windows.last7Days.startsAt)).toBe(
      parisWindowStart(7, now).getTime(),
    );
    expect(Date.parse(dashboard.windows.last7Days.startsAt)).toBeLessThanOrEqual(
      Date.parse(dashboard.windows.today.startsAt),
    );

    expect(dashboard.dailyRunLimit).toBe(HIGH_DAILY_LIMIT);
    expect(dashboard.aiPaused).toBe(false);
  });

  it("chaque compteur est identique à un comptage SQL direct", async () => {
    await insertRuns({ agent: "hugo", count: 3, status: "succeeded", withContact: true, tokens: 7 });
    await insertRuns({ agent: "hugo", count: 2, status: "failed", withContact: true });
    await insertRuns({ agent: "hugo", count: 4, status: "blocked", withContact: true });
    await insertRuns({ agent: "louis", count: 2, status: "succeeded", withContact: true });

    const dashboard = (await getAgentsDashboard(agentA)).data!;
    const dayStart = parisDayStart(new Date());

    for (const agent of AGENT_ORDER) {
      const overview = dashboard.agents.find((row) => row.agent === agent)!;
      expect(overview.today.runs.total).toBe(await countRuns({ agent, since: dayStart }));
      expect(overview.today.runs.succeeded).toBe(
        await countRuns({ agent, since: dayStart, status: "succeeded" }),
      );
      expect(overview.today.runs.failed).toBe(
        await countRuns({ agent, since: dayStart, status: "failed" }),
      );
      expect(overview.today.runs.blocked).toBe(
        await countRuns({ agent, since: dayStart, status: "blocked" }),
      );
      expect(overview.today.runs.running).toBe(
        await countRuns({ agent, since: dayStart, status: "running" }),
      );
      // Une tentative refusée est journalisée mais ne consomme aucun quota.
      expect(overview.runsTodayAgainstLimit).toBe(
        overview.today.runs.total - overview.today.runs.blocked,
      );
    }

    const hugo = dashboard.agents.find((row) => row.agent === "hugo")!;
    expect(hugo.today.tokens.input).toBeGreaterThan(0);
    expect(hugo.lastErrors.length).toBeGreaterThan(0);
    expect(hugo.lastErrors[0]!.statusLabel).toMatch(/Échec|Bloquée/);
  });

  it("runsToday est exactement ce que la base compte pour la limite quotidienne", async () => {
    const dashboard = (await getAgentsDashboard(agentA)).data!;
    const dayStart = parisDayStart(new Date());

    expect(dashboard.runsToday).toBe(await countRuns({ since: dayStart, excludeBlocked: true }));
    expect(dashboard.runsTodayTotal).toBe(await countRuns({ since: dayStart }));
    // Les tentatives refusées existent bien, et ne sont pas comptées deux fois.
    expect(dashboard.runsTodayTotal).toBeGreaterThan(dashboard.runsToday);
  });

  it("compte les brouillons en attente, et un zéro affiché est un zéro mesuré", async () => {
    const dashboard = (await getAgentsDashboard(agentA)).data!;
    const { count } = await env.admin
      .from("outbound_messages")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", env.agencyA.agencyId)
      .eq("status", "pending_validation");
    expect(dashboard.pendingValidationCount).toBe(count);
  });

  it("une exécution de Léa sans contact s'affiche proprement", async () => {
    const [runId] = await insertRuns({ agent: "lea", status: "succeeded" });

    const dashboard = (await getAgentsDashboard(agentA)).data!;
    const lea = dashboard.agents.find((agent) => agent.agent === "lea")!;

    expect(lea.label).toBe("Léa");
    expect(lea.lastRun).not.toBeNull();
    expect(lea.lastRun!.id).toBe(runId);
    // Léa travaille AVANT qu'un contact existe : `contactId` est nul, et ce
    // n'est pas une donnée manquante.
    expect(lea.lastRun!.contactId).toBeNull();
    expect(lea.lastRunLabel).toBe("Réussie");
    expect(lea.lastRun!.isSimulation).toBe(true);
    expect(lea.lastRun!.startedAt).toMatch(/Z$/);
  });

  it("seul un directeur peut réactiver les agents", async () => {
    expect((await getAgentsDashboard(agentA)).data!.canResume).toBe(false);
    expect((await getAgentsDashboard(directorA)).data!.canResume).toBe(true);
  });

  it("reste juste au-delà de 500 exécutions dans la journée", async () => {
    // L'ancienne version lisait les 500 exécutions les plus récentes et en
    // déduisait tous les chiffres : au-delà, `runsToday` était sous-évalué
    // alors qu'il est affiché à côté de la limite quotidienne.
    await insertRuns({ agent: "emma", count: 520, status: "succeeded", withContact: true });

    const dayStart = parisDayStart(new Date());
    const dashboard = (await getAgentsDashboard(agentA)).data!;

    expect(dashboard.runsTodayTotal).toBeGreaterThan(500);
    expect(dashboard.runsToday).toBe(await countRuns({ since: dayStart, excludeBlocked: true }));
    expect(dashboard.runsTodayTotal).toBe(await countRuns({ since: dayStart }));

    const emma = dashboard.agents.find((agent) => agent.agent === "emma")!;
    expect(emma.today.runs.total).toBe(await countRuns({ agent: "emma", since: dayStart }));

    // Sarah n'a tourné qu'une fois, avant les 520 exécutions d'Emma : elle ne
    // doit pas être affichée comme « Jamais exécuté ».
    const sarah = dashboard.agents.find((agent) => agent.agent === "sarah")!;
    expect(sarah.lastRun).not.toBeNull();
    expect(sarah.lastRunLabel).not.toBe("Jamais exécuté");
  }, 120_000);

  it("ne montre jamais les chiffres de l'autre agence", async () => {
    await insertRuns({ agent: "hugo", count: 2, status: "succeeded", agency: "b", withContact: true });

    const dashboardB = (await getAgentsDashboard(userB)).data!;
    const dayStart = parisDayStart(new Date());

    expect(dashboardB.agencyId).toBe(env.agencyB.agencyId);
    expect(dashboardB.runsTodayTotal).toBe(
      await countRuns({ agency: "b", since: dayStart }),
    );
    // L'agence A a des centaines d'exécutions : aucune ne fuit dans B.
    const totalA = await countRuns({ since: dayStart });
    expect(dashboardB.runsTodayTotal).toBeLessThan(totalA);
    expect(JSON.stringify(dashboardB)).not.toContain(env.agencyA.agencyId);
  });
});

describe("Coupe-circuit — lecture dédiée", () => {
  /**
   * `findAiPausedState` existe pour une raison de sécurité : le coupe-circuit
   * est le dispositif d'urgence de l'agence, il ne doit pas dépendre de la
   * bonne santé d'un tableau de statistiques. Ici, sessions réelles et RLS
   * active : on vérifie qu'il est isolé entre agences comme tout le reste.
   */
  it("renvoie l'agence de l'appelant, son état et son droit de réactiver", async () => {
    const asAgent = await findAiPausedState(agentA);
    expect(asAgent.error).toBeNull();
    expect(asAgent.data).toEqual({
      agencyId: env.agencyA.agencyId,
      agencyName: expect.stringContaining("(fictive)"),
      aiPaused: false,
      canResume: false,
    });

    // Tout membre peut suspendre ; seul un directeur peut réactiver.
    expect((await findAiPausedState(directorA)).data!.canResume).toBe(true);
  });

  it("suit l'état réel du coupe-circuit, dans les deux sens", async () => {
    const setPaused = async (paused: boolean) => {
      const { error } = await env.admin
        .from("agencies")
        .update({ ai_paused: paused })
        .eq("id", env.agencyA.agencyId);
      if (error) throw new Error(`setPaused: ${error.message}`);
    };

    try {
      await setPaused(true);
      expect((await findAiPausedState(agentA)).data!.aiPaused).toBe(true);
      await setPaused(false);
      expect((await findAiPausedState(agentA)).data!.aiPaused).toBe(false);
    } finally {
      await setPaused(false);
    }
  });

  it("ne dit jamais rien de l'autre agence", async () => {
    const stateB = await findAiPausedState(userB);
    expect(stateB.data!.agencyId).toBe(env.agencyB.agencyId);
    expect(JSON.stringify(stateB.data)).not.toContain(env.agencyA.agencyId);

    const stateA = await findAiPausedState(agentA);
    expect(JSON.stringify(stateA.data)).not.toContain(env.agencyB.agencyId);
  });
});

describe("Historique des exécutions", () => {
  it("renvoie une page bornée, la plus récente d'abord, avec un total exact", async () => {
    const result = await listAgentRuns(agentA);

    expect(result.error).toBeNull();
    const page = result.data!;
    expect(page.appliedFilters).toEqual({ limit: 25, offset: 0 });
    expect(page.runs.length).toBeLessThanOrEqual(25);
    expect(page.total).toBe(await countRuns({}));
    expect(page.hasMore).toBe(true);

    const instants = page.runs.map((run) => Date.parse(run.startedAt));
    expect([...instants].sort((a, b) => b - a)).toEqual(instants);

    for (const run of page.runs) {
      expect(run.agentLabel.length).toBeGreaterThan(0);
      expect(run.statusLabel.length).toBeGreaterThan(0);
      expect(run.startedAt).toMatch(/Z$/);
    }
  });

  it("filtre par agent, sans jamais mélanger les journaux", async () => {
    const page = (await listAgentRuns(agentA, { agent: "hugo" })).data!;

    expect(page.runs.every((run) => run.agent === "hugo")).toBe(true);
    expect(page.runs.every((run) => run.agentLabel === "Hugo")).toBe(true);
    expect(page.total).toBe(await countRuns({ agent: "hugo" }));
  });

  it("filtre par issue, y compris les tentatives refusées", async () => {
    const blocked = (await listAgentRuns(agentA, { status: "blocked" })).data!;
    expect(blocked.runs.every((run) => run.status === "blocked")).toBe(true);
    expect(blocked.runs.every((run) => run.statusLabel === "Bloquée")).toBe(true);
    expect(blocked.total).toBe(await countRuns({ status: "blocked" }));

    const failed = (await listAgentRuns(agentA, { agent: "hugo", status: "failed" })).data!;
    expect(failed.total).toBe(await countRuns({ agent: "hugo", status: "failed" }));
    expect(failed.runs.every((run) => run.error === "ai_response_invalid")).toBe(true);
  });

  it("pagine sans doublon ni trou", async () => {
    const first = (await listAgentRuns(agentA, { limit: 5, offset: 0 })).data!;
    const second = (await listAgentRuns(agentA, { limit: 5, offset: 5 })).data!;

    expect(first.runs).toHaveLength(5);
    expect(second.runs).toHaveLength(5);
    expect(first.total).toBe(second.total);
    const ids = new Set([...first.runs, ...second.runs].map((run) => run.id));
    expect(ids.size).toBe(10);
    expect(first.hasMore).toBe(true);
  });

  it("une page au-delà de la fin est vide, pas une erreur", async () => {
    const total = await countRuns({});
    const page = (await listAgentRuns(agentA, { limit: 10, offset: Math.min(total + 50, 5_000) })).data!;

    expect(page.runs).toEqual([]);
    expect(page.total).toBe(total);
    expect(page.hasMore).toBe(false);
  });

  it("refuse un filtre invalide plutôt que de l'ignorer", async () => {
    for (const filters of [
      { agent: "zoe" },
      { status: "envoyé" },
      { limit: 5_000 },
      { offset: -1 },
      { agencyId: env.agencyB.agencyId },
    ] as never[]) {
      const result = await listAgentRuns(agentA, filters);
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe("invalid_filters");
      expect(result.error?.message).toContain("filtres");
    }
  });

  it("une exécution de Léa apparaît dans l'historique, sans contact", async () => {
    const page = (await listAgentRuns(agentA, { agent: "lea" })).data!;
    expect(page.total).toBeGreaterThan(0);
    expect(page.runs.every((run) => run.contactId === null)).toBe(true);
    // Pas de contact, donc aucun nom à afficher : `null`, jamais « — » ni "".
    expect(page.runs.every((run) => run.contactName === null)).toBe(true);
  });

  it("nomme le contact d'une exécution qui en a un", async () => {
    const page = (await listAgentRuns(agentA, { agent: "hugo", limit: 5 })).data!;
    expect(page.runs.length).toBeGreaterThan(0);
    for (const run of page.runs) {
      expect(run.contactId).toBe(env.agencyA.contactId);
      expect(run.contactName).toBe("Test Contact A");
    }

    // Même nom sur les autres chemins qui renvoient un AgentRunSummary.
    const sarah = (await getAgentsDashboard(agentA)).data!.agents.find((a) => a.agent === "sarah")!;
    expect(sarah.lastRun!.contactName).toBe("Test Contact A");
  });

  it("ne montre jamais une exécution de l'autre agence", async () => {
    const pageB = (await listAgentRuns(userB)).data!;

    expect(pageB.total).toBe(await countRuns({ agency: "b" }));
    const idsA = new Set((await listAgentRuns(agentA, { limit: 100 })).data!.runs.map((r) => r.id));
    expect(pageB.runs.some((run) => idsA.has(run.id))).toBe(false);
    expect(JSON.stringify(pageB)).not.toContain(env.agencyA.contactId);
    // Et surtout pas le NOM d'un contact de l'autre agence, même par jointure.
    expect(JSON.stringify(pageB)).not.toContain("Test Contact A");
    expect(pageB.runs.every((run) => run.contactName === null || run.contactName === "Test Contact B")).toBe(
      true,
    );

    const pageA = (await listAgentRuns(agentA, { limit: 100 })).data!;
    expect(JSON.stringify(pageA)).not.toContain("Test Contact B");
  });
});
