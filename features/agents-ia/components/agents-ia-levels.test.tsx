// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AGENT_ACTIVITY_TEXTS, AGENT_MISSIONS } from "@/lib/agents/messages";

import type { AgentActivity, AgentOverview, AgentRunSummary, AgentsDashboard } from "../types";

// The card streams a server read; only its choice of dossier is tested here.
vi.mock("./DossierJourneyLoader", () => ({ DossierJourneyLoader: () => null }));

const { latestDossierRun, SelectedDossierCard } = await import("./SelectedDossierCard");
const { SituationStrip, summarizeSituation } = await import("./SituationStrip");

afterEach(() => {
  cleanup();
});

function activity(runs: Partial<AgentActivity["runs"]> = {}): AgentActivity {
  return { runs: { total: 0, succeeded: 0, failed: 0, blocked: 0, running: 0, ...runs }, tokens: { input: 0, output: 0 } };
}

function run(overrides: Partial<AgentRunSummary>): AgentRunSummary {
  return {
    id: "run",
    agent: "hugo",
    agentLabel: "Hugo",
    status: "succeeded",
    statusLabel: "Réussie",
    contactId: "contact-1",
    contactName: "Sophie Marchand",
    decision: null,
    error: null,
    provider: "simulator",
    model: null,
    inputTokens: 0,
    outputTokens: 0,
    isSimulation: true,
    startedAt: "2026-09-20T08:00:00.000Z",
    finishedAt: "2026-09-20T08:00:01.000Z",
    ...overrides,
  };
}

function agent(overrides: Partial<AgentOverview>): AgentOverview {
  return {
    agent: "hugo",
    label: "Hugo",
    mission: AGENT_MISSIONS.hugo,
    isActive: true,
    today: activity(),
    last7Days: activity(),
    runsTodayAgainstLimit: 0,
    lastRun: null,
    lastRunLabel: AGENT_ACTIVITY_TEXTS.neverRan,
    lastErrors: [],
    ...overrides,
  };
}

function dashboard(agents: AgentOverview[], pending = 0): AgentsDashboard {
  return {
    agencyId: "agency-1",
    agencyName: "Agence fictive",
    aiPaused: false,
    dailyRunLimit: 100,
    runsToday: 0,
    runsTodayTotal: 0,
    windows: {
      today: { key: "today", label: "aujourd'hui", startsAt: "2026-09-19T22:00:00.000Z", days: 1 },
      last7Days: { key: "last7Days", label: "sur 7 jours", startsAt: "2026-09-13T22:00:00.000Z", days: 7 },
    },
    canResume: true,
    pendingValidationCount: pending,
    agents,
  };
}

describe("summarizeSituation (level 1)", () => {
  it("sums exact counts of today, per outcome", () => {
    const situation = summarizeSituation(
      dashboard(
        [
          agent({ agent: "hugo", today: activity({ blocked: 2, failed: 1 }) }),
          agent({ agent: "louis", isActive: false, today: activity({ blocked: 1 }) }),
        ],
        3,
      ),
    );
    expect(situation).toEqual({ activeAgents: 1, totalAgents: 2, pendingValidation: 3, blockedToday: 3, failedToday: 1 });
  });

  it("renders the four figures with the window they were counted in", () => {
    render(<SituationStrip dashboard={dashboard([agent({})], 2)} />);
    expect(screen.getByTestId("situation-active").textContent).toContain("1 sur 1");
    expect(screen.getByTestId("situation-pending").textContent).toContain("2");
    expect(screen.getByRole("link", { name: /Validations attendues/ }).getAttribute("href")).toBe("/agents-ia/a-valider");
    expect(screen.getByText(/comptés aujourd'hui/)).toBeDefined();
  });
});

describe("latestDossierRun (level 2)", () => {
  it("picks the most recent recorded run that belongs to a contact", () => {
    const older = run({ id: "older", startedAt: "2026-09-19T08:00:00.000Z" });
    const newer = run({ id: "newer", agent: "louis", agentLabel: "Louis", startedAt: "2026-09-20T09:00:00.000Z" });
    const lea = run({ id: "lea", agent: "lea", contactId: null, contactName: null, startedAt: "2026-09-21T09:00:00.000Z" });
    const picked = latestDossierRun([
      agent({ lastRun: older }),
      agent({ agent: "louis", lastRun: newer }),
      agent({ agent: "lea", lastRun: lea }),
    ]);
    expect(picked?.id).toBe("newer");
  });

  it("returns nothing when no run belongs to a contact: the empty state is shown", () => {
    expect(latestDossierRun([agent({ lastRun: null })])).toBeNull();
    render(<SelectedDossierCard agents={[agent({ lastRun: null })]} />);
    expect(screen.getByText("Aucun dossier traité pour l'instant")).toBeDefined();
    expect(screen.getByRole("link", { name: "Ouvrir les contacts" }).getAttribute("href")).toBe("/contacts");
  });
});
