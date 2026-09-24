// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LANDING_TEXTS } from "@/components/landing-texts";

import { AGENT_STEPS, nextStepIndex, type AgentStepKey } from "./agent-steps";
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

  it("draws the two human steps as distinct cards with a double contour", () => {
    render(<AgentsCarousel />);
    const human = screen.getAllByRole("tab").filter((card) => card.getAttribute("data-kind") === "human");
    expect(human.map((card) => card.getAttribute("data-step"))).toEqual(["review", "mandate"]);
    for (const card of human) expect(within(card).getByTestId("human-contour")).toBeDefined();
    expect(within(tab("Léa")).queryByTestId("human-contour")).toBeNull();
  });

  it("puts one arrow between consecutive cards", () => {
    render(<AgentsCarousel />);
    expect(screen.getAllByTestId("step-connector")).toHaveLength(AGENT_STEPS.length - 1);
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
