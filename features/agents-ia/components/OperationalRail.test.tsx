// @vitest-environment jsdom
import { PersonIcon } from "@radix-ui/react-icons";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { APP_TEXTS } from "@/components/texts";

import { buildDossierJourney } from "./dossier-journey";
import { journeyRailNodes } from "./DossierJourneyRail";
import { isReached, OperationalRail, staggerOrder, stopsSignal, type RailNode, type RailState } from "./OperationalRail";

afterEach(() => {
  cleanup();
});

function node(state: RailState, overrides: Partial<RailNode> = {}): RailNode {
  return { key: state, icon: PersonIcon, name: `Nœud ${state}`, state, statusLabel: `Statut ${state}`, ...overrides };
}

const STATES: RailState[] = ["pending", "running", "done", "human", "blocked", "failed"];

describe("OperationalRail", () => {
  it("renders every state with its written status (the words carry the meaning)", () => {
    render(<OperationalRail nodes={STATES.map((state) => node(state))} label="Parcours" testId="rail" />);
    const rail = screen.getByRole("list", { name: "Parcours" });
    const items = within(rail).getAllByTestId("rail-node");
    expect(items.map((item) => item.getAttribute("data-state"))).toEqual(STATES);
    for (const state of STATES) expect(screen.getByText(`Statut ${state}`)).toBeDefined();
  });

  it("shows no duration when none was measured, and the measured one otherwise", () => {
    render(
      <OperationalRail
        nodes={[node("done", { key: "a" }), node("done", { key: "b", duration: "412 ms" })]}
        label="Parcours"
      />,
    );
    const statuses = screen.getAllByTestId("rail-node-status");
    expect(statuses[0]?.textContent).toBe("Statut done");
    expect(statuses[1]?.textContent).toBe("Statut done · 412 ms");
  });

  it("never displays a percentage", () => {
    const { container } = render(<OperationalRail nodes={STATES.map((state) => node(state))} label="Parcours" />);
    expect(container.textContent).not.toMatch(/%/);
  });

  it("cuts the line after a node that stopped the signal", () => {
    render(<OperationalRail nodes={[node("blocked", { key: "a" }), node("pending", { key: "b" })]} label="Parcours" />);
    const second = screen.getAllByTestId("rail-node")[1];
    expect(second?.querySelector("[data-cut]")).not.toBeNull();
  });

  it("links a node to its record when one is given", () => {
    render(<OperationalRail nodes={[node("done", { href: "/agents-ia/executions/run-1" })]} label="Parcours" />);
    expect(screen.getByRole("link", { name: "Nœud done" }).getAttribute("href")).toBe("/agents-ia/executions/run-1");
  });
});

describe("rail helpers", () => {
  it("counts a node as reached only when something was recorded", () => {
    expect(isReached("pending")).toBe(false);
    expect(isReached("untraced")).toBe(false);
    expect(isReached("human")).toBe(true);
  });

  it("stops the signal on a block, a human stop or a technical error", () => {
    expect(STATES.filter(stopsSignal)).toEqual(["blocked", "failed"]);
    expect(stopsSignal("stopped")).toBe(true);
  });

  it("numbers the reached nodes in order for the stagger", () => {
    expect(staggerOrder([node("done"), node("pending"), node("done"), node("human")])).toEqual([0, 0, 1, 2]);
  });
});

describe("journeyRailNodes", () => {
  const STATUS = APP_TEXTS.dossierJourney.status;

  it("attaches a duration only to the replayed run, with the measured value", () => {
    const hugoRun = {
      id: "run-hugo",
      kind: "ai_run" as const,
      occurredAt: "2026-09-20T08:00:00.000Z",
      title: "Hugo — Qualifié",
      description: null,
      isSimulation: true,
      actor: { type: "ai_agent" as const, agent: "hugo" as const, userId: null },
      status: "succeeded",
      meta: {},
    };
    const nodes = journeyRailNodes(buildDossierJourney([hugoRun]), { runId: "run-hugo", durationMs: 412 });
    const withDuration = nodes.filter((item) => item.duration);
    expect(withDuration.map((item) => item.key)).toEqual(["hugo"]);
    expect(withDuration[0]?.duration).toBe("412 ms");
    // The replayed run is the current page: no link to itself.
    expect(nodes.find((item) => item.key === "hugo")?.href).toBeUndefined();
  });

  it("shows no duration anywhere without a measured run, and links to the replays", () => {
    const nodes = journeyRailNodes(
      buildDossierJourney([
        {
          id: "run-louis",
          kind: "ai_run",
          occurredAt: "2026-09-20T08:00:00.000Z",
          title: "Louis — Créneau proposé",
          description: null,
          isSimulation: true,
          actor: { type: "ai_agent", agent: "louis", userId: null },
          status: "running",
          meta: {},
        },
      ]),
    );
    expect(nodes.every((item) => item.duration === undefined)).toBe(true);
    const louis = nodes.find((item) => item.key === "louis");
    expect(louis?.state).toBe("running");
    expect(louis?.href).toBe("/agents-ia/executions/run-louis");
    expect(nodes.find((item) => item.key === "sarah")?.statusLabel).toBe(STATUS.pending);
  });

  it("names the ten stages of the operational network, human checkpoints included", () => {
    const names = journeyRailNodes(buildDossierJourney([])).map((item) => item.name);
    expect(names).toEqual([
      "Prospect",
      "Léa",
      "Validation humaine",
      "Hugo",
      "Emma",
      "Validation humaine",
      "Louis",
      "Rendez-vous",
      "Sarah",
      "Mandat",
    ]);
  });
});
