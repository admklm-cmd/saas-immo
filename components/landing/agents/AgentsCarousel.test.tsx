// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LANDING_TEXTS } from "@/components/landing-texts";

import { AGENT_STEPS, nextStepIndex, stepVariant, type AgentStepKey } from "./agent-steps";
import { AgentsCarousel } from "./AgentsCarousel";
import { StepScene } from "./StepScene";

afterEach(() => {
  cleanup();
});

const TEXTS = LANDING_TEXTS.agents;

function tab(name: string): HTMLElement {
  return screen.getByRole("tab", { name: new RegExp(name) });
}

function panel(): HTMLElement {
  return screen.getByRole("tabpanel");
}

describe("AgentsCarousel", () => {
  it("lists the seven steps in the order of the hero journey, with the same names", () => {
    render(<AgentsCarousel />);
    const cards = screen.getAllByRole("tab");
    expect(cards.map((card) => card.getAttribute("data-step"))).toEqual([
      "lea",
      "hugo",
      "emma",
      "review",
      "louis",
      "sarah",
      "mandate",
    ]);
    expect(AGENT_STEPS.map((step) => step.name)).toEqual(LANDING_TEXTS.journey.steps.map((step) => step.actor));
    expect(AGENT_STEPS.map((step) => step.kind)).toEqual(LANDING_TEXTS.journey.steps.map((step) => step.kind));
  });

  it("draws the three natures differently: agent modules, a human checkpoint, the outcome", () => {
    render(<AgentsCarousel />);
    const cards = screen.getAllByRole("tab");
    expect(cards.map((card) => card.getAttribute("data-variant"))).toEqual([
      "agent",
      "agent",
      "agent",
      "checkpoint",
      "agent",
      "agent",
      "outcome",
    ]);
    const shapes = cards.map((card) => within(card).getByTestId("step-app-icon").getAttribute("data-kind"));
    expect(shapes).toEqual(["agent", "agent", "agent", "human", "agent", "agent", "outcome"]);
    // A human step names its nature on the tile; an agent is announced as such to assistive technology.
    expect(tab("Validation humaine").textContent).toContain(TEXTS.carousel.kinds.checkpoint);
    expect(tab("Mandat").textContent).toContain(TEXTS.carousel.kinds.outcome);
    expect(tab("Léa").textContent).toContain(TEXTS.carousel.kinds.agent);
    expect(stepVariant({ key: "mandate", kind: "human" })).toBe("outcome");
  });

  it("links the modules with one flow piece between consecutive cards, lit up to the open one", () => {
    render(<AgentsCarousel />);
    const connectors = screen.getAllByTestId("step-connector");
    expect(connectors).toHaveLength(AGENT_STEPS.length - 1);
    expect(connectors.filter((item) => item.hasAttribute("data-lit"))).toHaveLength(0);
    fireEvent.click(tab("Emma"));
    expect(screen.getAllByTestId("step-connector").map((item) => item.hasAttribute("data-lit"))).toEqual([
      true,
      true,
      false,
      false,
      false,
      false,
    ]);
  });

  it("marks only the open module as active (lifted tile with its ring)", () => {
    render(<AgentsCarousel />);
    fireEvent.click(tab("Sarah"));
    const states = screen.getAllByTestId("step-app-icon").map((icon) => icon.getAttribute("data-state"));
    expect(states).toEqual(["idle", "idle", "idle", "idle", "idle", "active", "idle"]);
  });

  it("never selects after a mouse drag across the track", () => {
    render(<AgentsCarousel />);
    const track = screen.getByTestId("agents-tablist");
    const hugo = tab("Hugo");
    fireEvent.pointerDown(hugo, { pointerType: "mouse", button: 0, pointerId: 1, clientX: 400, clientY: 100 });
    fireEvent.pointerMove(track, { pointerType: "mouse", pointerId: 1, clientX: 300, clientY: 102 });
    fireEvent.pointerUp(track, { pointerType: "mouse", pointerId: 1, clientX: 300, clientY: 102 });
    fireEvent.click(hugo);
    expect(panel().getAttribute("data-step")).toBe("lea");
    // A press that does not move is a click.
    fireEvent.pointerDown(hugo, { pointerType: "mouse", button: 0, pointerId: 2, clientX: 400, clientY: 100 });
    fireEvent.pointerUp(hugo, { pointerType: "mouse", pointerId: 2, clientX: 402, clientY: 100 });
    fireEvent.click(hugo);
    expect(panel().getAttribute("data-step")).toBe("hugo");
  });

  it("shows the position in the discreet navigation", () => {
    render(<AgentsCarousel />);
    expect(screen.getByTestId("agents-position").textContent).toContain("01");
    fireEvent.click(tab("Louis"));
    expect(screen.getByTestId("agents-position").textContent).toContain("05");
  });

  it("shows the first step before any interaction (server HTML, no JavaScript)", () => {
    render(<AgentsCarousel />);
    expect(tab("Léa").getAttribute("aria-selected")).toBe("true");
    expect(panel().getAttribute("data-step")).toBe("lea");
    expect(within(panel()).getByTestId("agent-scene").getAttribute("data-step")).toBe("lea");
  });

  it("selects a step on click and updates the panel", () => {
    render(<AgentsCarousel />);
    fireEvent.click(tab("Hugo"));
    expect(tab("Hugo").getAttribute("aria-selected")).toBe("true");
    expect(tab("Léa").getAttribute("aria-selected")).toBe("false");
    expect(panel().getAttribute("aria-labelledby")).toBe(tab("Hugo").id);
    expect(within(panel()).getByTestId("agent-step-title").textContent).toBe("Hugo");
    expect(within(panel()).getByText(TEXTS.scenes.hugo.title)).toBeDefined();
    // The missing information is flagged, not invented.
    expect(within(panel()).getByTestId("hugo-missing").textContent).toContain(TEXTS.scenes.hugo.missing);
  });

  it("moves the selection and the focus with the arrow keys, Home and End (roving tabindex)", () => {
    render(<AgentsCarousel />);
    tab("Léa").focus();
    fireEvent.keyDown(tab("Léa"), { key: "ArrowRight" });
    expect(document.activeElement).toBe(tab("Hugo"));
    expect(panel().getAttribute("data-step")).toBe("hugo");
    expect(tab("Hugo").tabIndex).toBe(0);
    expect(tab("Léa").tabIndex).toBe(-1);

    fireEvent.keyDown(tab("Hugo"), { key: "End" });
    expect(document.activeElement).toBe(tab("Mandat"));
    expect(panel().getAttribute("data-step")).toBe("mandate");

    fireEvent.keyDown(tab("Mandat"), { key: "Home" });
    expect(panel().getAttribute("data-step")).toBe("lea");
  });

  it("selects with Enter or Space, as native buttons", () => {
    render(<AgentsCarousel />);
    // A native <button> turns Enter/Space into a click: the tab reacts to the click.
    const emma = tab("Emma");
    emma.focus();
    fireEvent.click(emma);
    expect(panel().getAttribute("data-step")).toBe("emma");
    expect(emma.tagName).toBe("BUTTON");
    expect(emma.getAttribute("type")).toBe("button");
  });

  it("steps with the previous and next buttons, inert at both ends", () => {
    render(<AgentsCarousel />);
    const previous = screen.getByRole("button", { name: TEXTS.carousel.previous });
    const next = screen.getByRole("button", { name: TEXTS.carousel.next });
    expect(previous.getAttribute("aria-disabled")).toBe("true");

    fireEvent.click(next);
    expect(panel().getAttribute("data-step")).toBe("hugo");
    fireEvent.click(previous);
    expect(panel().getAttribute("data-step")).toBe("lea");
    fireEvent.click(previous);
    expect(panel().getAttribute("data-step")).toBe("lea");

    for (let index = 0; index < AGENT_STEPS.length + 2; index += 1) fireEvent.click(next);
    expect(panel().getAttribute("data-step")).toBe("mandate");
    expect(next.getAttribute("aria-disabled")).toBe("true");
  });
});

describe("scenes", () => {
  const KEYS = AGENT_STEPS.map((step) => step.key) as AgentStepKey[];

  it.each(KEYS)("the %s scene carries the Simulation badge and « Exemple fictif — simulation »", (key) => {
    render(<StepScene stepKey={key} />);
    const label = screen.getByTestId("agent-scene-label");
    expect(label.textContent).toContain("Simulation");
    expect(label.textContent).toContain(TEXTS.carousel.sceneBadge);
    expect(screen.getByTestId("agent-scene").getAttribute("data-step")).toBe(key);
  });

  it("claims no figure as a statistic in any scene", () => {
    for (const key of KEYS) {
      const { container, unmount } = render(<StepScene stepKey={key} />);
      expect(container.textContent).not.toMatch(/%|€|\d+\s?(clients?|agences?|mandats?)\b/i);
      unmount();
    }
  });

  it("shows the unsubscribe line in Emma's draft, and a never-booked-twice slot for Louis", () => {
    render(<StepScene stepKey="emma" />);
    expect(screen.getByTestId("emma-unsubscribe").textContent).toBe(TEXTS.scenes.emma.unsubscribe);
    cleanup();
    render(<StepScene stepKey="louis" />);
    expect(screen.getByTestId("louis-slot-taken").getAttribute("data-tone")).toBe("muted");
    expect(screen.getByTestId("louis-slot-proposed").getAttribute("data-tone")).toBe("active");
  });

  it("concludes the mandate with a human confirmation, never an agent", () => {
    render(<StepScene stepKey="mandate" />);
    expect(screen.getByTestId("mandate-confirmed").textContent).toBe(TEXTS.scenes.mandate.confirmed);
    expect(screen.getByTestId("mandate-confirmed").textContent).toMatch(/conseiller/);
  });
});

describe("nextStepIndex", () => {
  it("clamps to the ends and ignores unrelated keys", () => {
    expect(nextStepIndex("ArrowRight", 6, 7)).toBe(6);
    expect(nextStepIndex("ArrowLeft", 0, 7)).toBe(0);
    expect(nextStepIndex("Home", 4, 7)).toBe(0);
    expect(nextStepIndex("End", 1, 7)).toBe(6);
    expect(nextStepIndex("ArrowDown", 1, 7)).toBeNull();
    expect(nextStepIndex("a", 1, 7)).toBeNull();
  });
});
