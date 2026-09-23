// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { APP_TEXTS } from "@/components/texts";

import { AgentsSummary } from "./AgentsSummary";
import { makeSummary, SCOPES } from "./summary-fixture";

const TEXTS = APP_TEXTS.dashboard;

afterEach(() => cleanup());

describe("AgentsSummary", () => {
  it("affiche total, erreurs et blocages par fenêtre, le blocage n'étant pas une erreur", () => {
    render(<AgentsSummary agents={makeSummary().agents} />);

    const today = screen.getByTestId("dashboard-runs-today");
    expect(today.textContent).toContain(TEXTS.runsWindowTitle(TEXTS.scopes.today));
    expect(today.textContent).toContain(`${TEXTS.runsTotal}4`);
    expect(today.textContent).toContain(`${TEXTS.runsFailed}1`);
    expect(today.textContent).toContain(`${TEXTS.runsBlocked}1`);

    const week = screen.getByTestId("dashboard-runs-last-7-days");
    expect(week.textContent).toContain(TEXTS.runsWindowTitle(TEXTS.scopes.last_7_days));
    expect(week.textContent).toContain(`${TEXTS.runsTotal}12`);

    expect(screen.getByText(TEXTS.runsBlockedHint)).toBeDefined();
  });

  it("garde l'état du coupe-circuit visible quand les exécutions sont indisponibles", () => {
    const agents = makeSummary().agents;
    agents.killSwitch = { status: "ok", scope: SCOPES.current, value: { aiPaused: true, canResume: false } };
    agents.runsToday = { status: "unavailable", scope: SCOPES.today };
    agents.runsLast7Days = { status: "unavailable", scope: SCOPES.last7 };

    render(<AgentsSummary agents={agents} />);

    const killSwitch = screen.getByTestId("dashboard-kill-switch");
    expect(killSwitch.textContent).toContain(APP_TEXTS.killSwitch.paused);
    expect(killSwitch.textContent).toContain(TEXTS.scopes.current);

    const today = screen.getByTestId("dashboard-runs-today");
    expect(today.getAttribute("data-status")).toBe("unavailable");
    expect(today.textContent).toContain(TEXTS.unavailable);
    for (const value of today.querySelectorAll("dd")) {
      expect(value.textContent).toContain(TEXTS.unavailable);
      expect(value.textContent).not.toMatch(/\d/);
    }
  });

  it("dit « Indisponible » si le coupe-circuit n'a pas pu être lu, sans masquer les exécutions", () => {
    const agents = makeSummary().agents;
    agents.killSwitch = { status: "unavailable", scope: SCOPES.current };

    render(<AgentsSummary agents={agents} />);

    expect(screen.getByTestId("dashboard-kill-switch").textContent).toContain(TEXTS.unavailable);
    expect(screen.getByTestId("dashboard-runs-today").textContent).toContain("4");
  });

  it("renvoie vers /agents-ia pour agir, sans dupliquer le bouton du coupe-circuit", () => {
    render(<AgentsSummary agents={makeSummary().agents} />);

    expect(screen.getByRole("link", { name: TEXTS.agentsLink }).getAttribute("href")).toBe("/agents-ia");
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText(APP_TEXTS.states.simulation)).toBeDefined();
  });
});
