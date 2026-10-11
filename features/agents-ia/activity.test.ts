import { describe, expect, it, vi } from "vitest";

import { AGENT_ACTIVITY_TEXTS, AGENT_LABELS, AGENT_ORDER } from "@/lib/agents/messages";
import { parisDayStart, parisWindowStart } from "@/lib/agents/time";
import type { AiAgentName } from "@/lib/agents/types";

import {
  AGENT_LAST_ERRORS_LIMIT,
  buildAgentOverviews,
  describeWindow,
  emptyRunCounts,
  parseAgentActivityRows,
  requireExactCount,
  runsAgainstLimit,
  totalTodayRunCounts,
  type AgentActivityRow,
} from "./activity";
import type { AgentRunError, AgentRunSummary } from "./types";

/**
 * Pure tests (no database) of the figures of the "Agents IA" screen.
 *
 * What is proved here is what CLAUDE.md demands of any statistic: it is
 * computed from what was really recorded, it always carries the window it was
 * counted in, and **a figure that could not be read is never shown as a zero**.
 *
 * The exact counting itself happens in SQL (`public.agent_activity_summary`)
 * and is proved against a direct SQL count in `dashboard.integration.test.ts`.
 * This file covers the assembly: windows, aggregation, labels, missing values.
 */

function activityRow(agent: AiAgentName, overrides: Partial<AgentActivityRow> = {}): AgentActivityRow {
  return {
    agent_name: agent,
    today_total: 0,
    today_succeeded: 0,
    today_failed: 0,
    today_blocked: 0,
    today_running: 0,
    today_input_tokens: 0,
    today_output_tokens: 0,
    window_total: 0,
    window_succeeded: 0,
    window_failed: 0,
    window_blocked: 0,
    window_running: 0,
    window_input_tokens: 0,
    window_output_tokens: 0,
    ...overrides,
  };
}

function runSummary(agent: AiAgentName, overrides: Partial<AgentRunSummary> = {}): AgentRunSummary {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    agent,
    agentLabel: AGENT_LABELS[agent],
    status: "succeeded",
    statusLabel: "Réussie",
    contactId: null,
    contactName: null,
    decision: null,
    error: null,
    provider: "simulator",
    model: "simulator-v1",
    inputTokens: 10,
    outputTokens: 20,
    isSimulation: true,
    startedAt: "2026-09-17T08:00:00.000Z",
    finishedAt: "2026-09-17T08:00:01.000Z",
    ...overrides,
  };
}

// -----------------------------------------------------------------------------

describe("describeWindow", () => {
  it("nomme la fenêtre du jour et celle des 7 jours, en heure de Paris", () => {
    const now = new Date("2026-09-17T21:30:00Z"); // 23h30 à Paris (CEST)

    const today = describeWindow("today", parisDayStart(now));
    const last7Days = describeWindow("last7Days", parisWindowStart(7, now));

    expect(today).toEqual({
      key: "today",
      label: "aujourd'hui",
      startsAt: "2026-09-16T22:00:00.000Z",
      days: 1,
    });
    expect(last7Days).toEqual({
      key: "last7Days",
      label: "sur 7 jours",
      startsAt: "2026-09-10T22:00:00.000Z",
      days: 7,
    });
  });

  it("suit le passage à l'heure d'été : minuit à Paris, pas minuit UTC", () => {
    // Nuit du 28 au 29 mars 2026 : le jour parisien du 29 dure 23 heures.
    const duringTheShortDay = new Date("2026-03-29T12:00:00Z");
    expect(describeWindow("today", parisDayStart(duringTheShortDay)).startsAt).toBe(
      "2026-03-28T23:00:00.000Z", // CET, UTC+1
    );
    // Le lendemain, Paris est en CEST : le même « minuit » vaut 22:00 UTC.
    const theDayAfter = new Date("2026-03-30T09:00:00Z");
    expect(describeWindow("today", parisDayStart(theDayAfter)).startsAt).toBe(
      "2026-03-29T22:00:00.000Z", // CEST, UTC+2
    );
    // Une fenêtre de 7 jours à cheval sur le changement d'heure ne perd pas
    // l'heure que donnerait une soustraction de 6 x 24 h.
    expect(describeWindow("last7Days", parisWindowStart(7, theDayAfter)).startsAt).toBe(
      "2026-03-23T23:00:00.000Z",
    );
  });

  it("suit le retour à l'heure d'hiver (journée de 25 heures)", () => {
    const beforeTheChange = new Date("2026-10-25T12:00:00Z");
    const afterTheChange = new Date("2026-10-26T09:00:00Z");
    expect(describeWindow("today", parisDayStart(beforeTheChange)).startsAt).toBe(
      "2026-10-24T22:00:00.000Z",
    );
    expect(describeWindow("today", parisDayStart(afterTheChange)).startsAt).toBe(
      "2026-10-25T23:00:00.000Z",
    );
  });

  it("donne toujours un libellé : un chiffre sans sa période ne veut rien dire", () => {
    for (const key of ["today", "last7Days"] as const) {
      const window = describeWindow(key, new Date("2026-09-17T22:00:00Z"));
      expect(window.label.length).toBeGreaterThan(0);
      expect(window.days).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("runsAgainstLimit", () => {
  it("compte exactement ce que compte le garde-fou de la base : tout sauf « bloqué »", () => {
    const counts = { total: 10, succeeded: 5, failed: 2, blocked: 2, running: 1 };
    expect(runsAgainstLimit(counts)).toBe(8);
  });

  it("vaut zéro quand toutes les tentatives ont été refusées", () => {
    expect(runsAgainstLimit({ total: 4, succeeded: 0, failed: 0, blocked: 4, running: 0 })).toBe(0);
  });

  it("vaut zéro sur une journée sans aucune exécution", () => {
    expect(runsAgainstLimit(emptyRunCounts())).toBe(0);
  });
});

describe("totalTodayRunCounts", () => {
  it("additionne les comptages exacts de tous les agents", () => {
    const rows = [
      activityRow("lea", { today_total: 4, today_succeeded: 3, today_blocked: 1 }),
      activityRow("hugo", { today_total: 2, today_succeeded: 1, today_failed: 1 }),
      activityRow("emma", { today_total: 3, today_running: 3 }),
    ];

    expect(totalTodayRunCounts(rows)).toEqual({
      total: 9,
      succeeded: 4,
      failed: 1,
      blocked: 1,
      running: 3,
    });
    // C'est ce total-là, et pas le total brut, qui se compare à la limite.
    expect(runsAgainstLimit(totalTodayRunCounts(rows))).toBe(8);
  });

  it("compte aussi un agent que l'écran ne connaît pas encore", () => {
    // Le garde-fou de la base compte TOUTES les exécutions de l'agence, quel
    // que soit l'agent. Un sixième agent ajouté à l'enum avant cet écran ne
    // doit pas disparaître du quota consommé.
    const rows = [
      activityRow("lea", { today_total: 2, today_succeeded: 2 }),
      activityRow("zoe" as AiAgentName, { today_total: 5, today_succeeded: 5 }),
    ];
    expect(totalTodayRunCounts(rows).total).toBe(7);
  });

  it("tolère un bigint sérialisé en chaîne par PostgREST", () => {
    const row = activityRow("hugo", {
      today_total: "3" as unknown as number,
      today_succeeded: "3" as unknown as number,
    });
    expect(totalTodayRunCounts([row])).toMatchObject({ total: 3, succeeded: 3 });
  });

  it("vaut zéro mesuré sur une agence sans aucune exécution", () => {
    expect(totalTodayRunCounts([])).toEqual(emptyRunCounts());
  });
});

describe("requireExactCount", () => {
  it("renvoie le comptage quand la base a répondu", () => {
    const result = requireExactCount("test", { count: 1_248, error: null });
    expect(result.error).toBeNull();
    expect(result.data).toBe(1_248);
  });

  it("garde un vrai zéro : « rien à valider » est une information", () => {
    const result = requireExactCount("test", { count: 0, error: null });
    expect(result.data).toBe(0);
  });

  it("une lecture en ERREUR ne devient jamais un zéro", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = requireExactCount("test", {
      count: null,
      error: { message: "connection reset", code: "08006" },
    });
    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("unexpected_error");
    expect(result.error?.message).toContain("Aucune action");
  });

  it("un comptage absent de la réponse est une erreur, pas un zéro", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const count of [null, Number.NaN, undefined as unknown as number]) {
      const result = requireExactCount("test", { count, error: null });
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe("unexpected_error");
    }
  });
});

describe("parseAgentActivityRows", () => {
  it("accepte la réponse de l'agrégat SQL, bigints sérialisés compris", () => {
    const result = parseAgentActivityRows([
      { ...activityRow("lea", { today_total: 2 }), window_total: "9" },
    ]);
    expect(result.error).toBeNull();
    expect(result.data![0]).toMatchObject({ agent_name: "lea", today_total: 2, window_total: 9 });
  });

  it("accepte une agence sans aucune exécution : une liste vide est une mesure", () => {
    const result = parseAgentActivityRows([]);
    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });

  it("accepte un agent que l'écran ne connaît pas encore", () => {
    const result = parseAgentActivityRows([activityRow("zoe" as AiAgentName, { today_total: 1 })]);
    expect(result.error).toBeNull();
  });

  it("une réponse inattendue est une ERREUR, jamais une page de zéros", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const payload of [
      null,
      undefined,
      {},
      "3",
      // Un compteur absent : les chiffres sont inconnus, pas nuls.
      [{ agent_name: "lea" }],
      // Un compteur nul ou négatif ne peut pas venir d'un `count(*)`.
      [{ ...activityRow("lea"), today_total: null }],
      [{ ...activityRow("lea"), window_total: -1 }],
      [{ ...activityRow("lea"), today_total: "beaucoup" }],
    ]) {
      const result = parseAgentActivityRows(payload);
      expect(result.data).toBeNull();
      expect(result.error?.code).toBe("unexpected_error");
      // Le message affiché dit qu'il ne s'est rien passé, pas qu'il n'y a rien.
      expect(result.error?.message).toContain("erreur technique");
    }
  });
});

describe("buildAgentOverviews", () => {
  it("renvoie toujours les cinq agents, dans l'ordre du parcours vendeur", () => {
    const agents = buildAgentOverviews({
      aiPaused: false,
      activity: [],
      lastRuns: new Map(),
      lastErrors: new Map(),
    });

    expect(agents.map((agent) => agent.agent)).toEqual([...AGENT_ORDER]);
    expect(agents.map((agent) => agent.label)).toEqual(["Léa", "Hugo", "Emma", "Louis", "Sarah"]);
    for (const agent of agents) {
      expect(agent.mission.length).toBeGreaterThan(0);
    }
  });

  it("dit « Jamais exécuté » pour un agent qui n'a réellement jamais tourné", () => {
    const agents = buildAgentOverviews({
      aiPaused: false,
      activity: [],
      lastRuns: new Map([["emma", null]]),
      lastErrors: new Map(),
    });

    const emma = agents.find((agent) => agent.agent === "emma")!;
    expect(emma.lastRun).toBeNull();
    expect(emma.lastRunLabel).toBe(AGENT_ACTIVITY_TEXTS.neverRan);
    expect(emma.today.runs).toEqual(emptyRunCounts());
    expect(emma.lastErrors).toEqual([]);
  });

  it("n'affiche PAS « Jamais exécuté » pour un agent sans activité récente mais déjà exécuté", () => {
    // Le cas qui a motivé la requête dédiée par agent : Sarah n'a rien fait
    // cette semaine, mais elle a bien tourné le mois dernier.
    const oldRun = runSummary("sarah", { startedAt: "2026-08-02T09:00:00.000Z" });
    const agents = buildAgentOverviews({
      aiPaused: false,
      activity: [activityRow("lea", { today_total: 3, window_total: 3 })],
      lastRuns: new Map([["sarah", oldRun]]),
      lastErrors: new Map(),
    });

    const sarah = agents.find((agent) => agent.agent === "sarah")!;
    expect(sarah.lastRun).toEqual(oldRun);
    expect(sarah.lastRunLabel).toBe("Réussie");
    // Zéro MESURÉ sur la fenêtre, ce qui n'est pas la même chose qu'inconnu.
    expect(sarah.today.runs.total).toBe(0);
  });

  it("répartit les compteurs par agent et par fenêtre, sans les mélanger", () => {
    const agents = buildAgentOverviews({
      aiPaused: false,
      activity: [
        activityRow("hugo", {
          today_total: 3,
          today_succeeded: 2,
          today_blocked: 1,
          today_input_tokens: 120,
          today_output_tokens: 45,
          window_total: 11,
          window_succeeded: 9,
          window_failed: 1,
          window_blocked: 1,
          window_input_tokens: 900,
          window_output_tokens: 310,
        }),
      ],
      lastRuns: new Map(),
      lastErrors: new Map(),
    });

    const hugo = agents.find((agent) => agent.agent === "hugo")!;
    expect(hugo.today).toEqual({
      runs: { total: 3, succeeded: 2, failed: 0, blocked: 1, running: 0 },
      tokens: { input: 120, output: 45 },
    });
    expect(hugo.last7Days).toEqual({
      runs: { total: 11, succeeded: 9, failed: 1, blocked: 1, running: 0 },
      tokens: { input: 900, output: 310 },
    });
    // 3 tentatives dont 1 refusée : 2 seulement consomment le quota.
    expect(hugo.runsTodayAgainstLimit).toBe(2);

    // Les autres agents ne récupèrent pas les chiffres de Hugo.
    for (const other of agents.filter((agent) => agent.agent !== "hugo")) {
      expect(other.today.runs.total).toBe(0);
      expect(other.last7Days.runs.total).toBe(0);
    }
  });

  it("ignore une ligne d'agent inconnue plutôt que d'inventer une sixième carte", () => {
    const agents = buildAgentOverviews({
      aiPaused: false,
      activity: [activityRow("zoe" as AiAgentName, { today_total: 5 })],
      lastRuns: new Map(),
      lastErrors: new Map(),
    });
    expect(agents).toHaveLength(AGENT_ORDER.length);
    expect(agents.every((agent) => agent.today.runs.total === 0)).toBe(true);
  });

  it("le coupe-circuit éteint les cinq agents d'un coup", () => {
    const active = buildAgentOverviews({
      aiPaused: false,
      activity: [],
      lastRuns: new Map(),
      lastErrors: new Map(),
    });
    const paused = buildAgentOverviews({
      aiPaused: true,
      activity: [],
      lastRuns: new Map(),
      lastErrors: new Map(),
    });

    expect(active.every((agent) => agent.isActive)).toBe(true);
    expect(paused.every((agent) => agent.isActive)).toBe(false);
  });

  it("borne les erreurs affichées et garde la plus récente en tête", () => {
    const errors: AgentRunError[] = [1, 2, 3, 4, 5].map((index) => ({
      runId: `run-${index}`,
      code: "ai_response_invalid",
      decision: `Tentative ${index}`,
      status: "failed" as const,
      statusLabel: "Échec",
      at: `2026-09-1${index}T08:00:00.000Z`,
    }));

    const agents = buildAgentOverviews({
      aiPaused: false,
      activity: [],
      lastRuns: new Map(),
      lastErrors: new Map([["louis", errors]]),
    });

    const louis = agents.find((agent) => agent.agent === "louis")!;
    expect(louis.lastErrors).toHaveLength(AGENT_LAST_ERRORS_LIMIT);
    expect(louis.lastErrors[0]!.runId).toBe("run-1");
  });
});
