// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { APP_TEXTS } from "@/components/texts";
import { AGENT_ACTIVITY_TEXTS, AGENT_MISSIONS } from "@/lib/agents/messages";

import type { AgentActivity, AgentOverview, AgentRunSummary } from "../types";
import { ActivityFigure } from "./ActivityFigure";
import { AgentOverviewCard } from "./AgentOverviewCard";

const TEXTS = APP_TEXTS.agentsIa;
const TODAY = "aujourd'hui";
const LAST_7 = "sur 7 jours";

afterEach(() => {
  cleanup();
});

function activity(overrides: Partial<AgentActivity["runs"]> = {}): AgentActivity {
  return {
    runs: { total: 0, succeeded: 0, failed: 0, blocked: 0, running: 0, ...overrides },
    tokens: { input: 0, output: 0 },
  };
}

function run(overrides: Partial<AgentRunSummary> = {}): AgentRunSummary {
  return {
    id: "run-1",
    agent: "hugo",
    agentLabel: "Hugo",
    status: "succeeded",
    statusLabel: "Réussie",
    contactId: "contact-1",
    contactName: "Sophie Marchand",
    decision: "Qualification enregistrée.",
    error: null,
    provider: "simulator",
    model: "simulator-1",
    inputTokens: 120,
    outputTokens: 40,
    isSimulation: true,
    startedAt: "2026-09-17T08:00:00.000Z",
    finishedAt: "2026-09-17T08:00:01.000Z",
    ...overrides,
  };
}

function agent(overrides: Partial<AgentOverview> = {}): AgentOverview {
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

describe("ActivityFigure", () => {
  it("always names the window the figure was counted in", () => {
    render(<ActivityFigure runs={12} windowLabel={TODAY} />);
    expect(screen.getByText("12 exécutions aujourd'hui")).toBeDefined();
  });

  it("shows « Indisponible » rather than a reassuring zero when a count is missing", () => {
    const { container } = render(<ActivityFigure runs={null} windowLabel={TODAY} />);
    expect(screen.getByText(AGENT_ACTIVITY_TEXTS.unknownFigure)).toBeDefined();
    expect(container.textContent).not.toContain("0");
  });

  it("does show a real zero, which is a measured fact", () => {
    render(<ActivityFigure runs={0} windowLabel={LAST_7} />);
    expect(screen.getByText("0 exécution sur 7 jours")).toBeDefined();
  });
});

describe("AgentOverviewCard", () => {
  it("states « Jamais exécuté » only from the server label", () => {
    render(<AgentOverviewCard agent={agent()} todayLabel={TODAY} last7DaysLabel={LAST_7} />);

    expect(screen.getByText(AGENT_ACTIVITY_TEXTS.neverRan)).toBeDefined();
    expect(screen.getByText(TEXTS.noError)).toBeDefined();
    // Nothing to replay: no link to an execution that does not exist.
    expect(screen.queryByText(TEXTS.viewReplay)).toBeNull();
  });

  it("names Léa's runs « Lead entrant » and offers no contact file", () => {
    render(
      <AgentOverviewCard
        agent={agent({
          agent: "lea",
          label: "Léa",
          mission: AGENT_MISSIONS.lea,
          lastRun: run({
            id: "run-lea",
            agent: "lea",
            agentLabel: "Léa",
            contactId: null,
            contactName: null,
          }),
          lastRunLabel: "Réussie",
        })}
        todayLabel={TODAY}
        last7DaysLabel={LAST_7}
      />,
    );

    expect(screen.getByText(TEXTS.inboundLead)).toBeDefined();
    expect(screen.queryByText(TEXTS.openContact)).toBeNull();
    expect(screen.getByRole("link", { name: TEXTS.viewReplay }).getAttribute("href")).toBe(
      "/agents-ia/executions/run-lea",
    );
  });

  it("shows the counts of both windows and the recorded errors", () => {
    render(
      <AgentOverviewCard
        agent={agent({
          today: activity({ total: 3, succeeded: 2, blocked: 1 }),
          last7Days: activity({ total: 9, succeeded: 8, failed: 1 }),
          lastRun: run(),
          lastRunLabel: "Réussie",
          lastErrors: [
            {
              runId: "run-blocked",
              code: "ai_paused",
              decision: "Les agents IA sont suspendus par le coupe-circuit de l'agence.",
              statusLabel: "Bloquée",
              at: "2026-09-16T10:00:00.000Z",
            },
          ],
        })}
        todayLabel={TODAY}
        last7DaysLabel={LAST_7}
      />,
    );

    expect(screen.getByText("3 exécutions aujourd'hui")).toBeDefined();
    expect(screen.getByText("9 exécutions sur 7 jours")).toBeDefined();
    expect(screen.getByText("Bloquée : 1")).toBeDefined();
    expect(screen.getByText(/coupe-circuit de l'agence/)).toBeDefined();
    // The contact is named, not hidden behind a generic "Voir la fiche".
    expect(screen.getByRole("link", { name: "Sophie Marchand" }).getAttribute("href")).toBe(
      "/contacts/contact-1",
    );
    expect(screen.queryByText(TEXTS.openContact)).toBeNull();
  });

  it("falls back to the generic label when the run carries no readable name", () => {
    render(
      <AgentOverviewCard
        agent={agent({ lastRun: run({ contactName: null }), lastRunLabel: "Réussie" })}
        todayLabel={TODAY}
        last7DaysLabel={LAST_7}
      />,
    );

    // The link must stay reachable: the file exists, only its name is missing.
    expect(screen.getByRole("link", { name: TEXTS.openContact }).getAttribute("href")).toBe(
      "/contacts/contact-1",
    );
  });

  it("shows « Contact sans nom » as the value it is, never as an empty slot", () => {
    render(
      <AgentOverviewCard
        agent={agent({ lastRun: run({ contactName: "Contact sans nom" }), lastRunLabel: "Réussie" })}
        todayLabel={TODAY}
        last7DaysLabel={LAST_7}
      />,
    );

    expect(screen.getByRole("link", { name: "Contact sans nom" }).getAttribute("href")).toBe(
      "/contacts/contact-1",
    );
  });

  it("says when an agent is suspended by the kill switch", () => {
    render(<AgentOverviewCard agent={agent({ isActive: false })} todayLabel={TODAY} last7DaysLabel={LAST_7} />);
    expect(screen.getByText(TEXTS.statusPaused)).toBeDefined();
  });
});
