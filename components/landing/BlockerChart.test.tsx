// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LANDING_TEXTS } from "@/components/landing-texts";

import { BlockerChart } from "./BlockerChart";
import { LandingProblem } from "./LandingProblem";
import { PROBLEM_EVENT_KINDS, PROBLEM_EVENTS } from "./problem/problem-scene";

afterEach(() => {
  cleanup();
});

const PROBLEM = LANDING_TEXTS.problem;
const CHART = PROBLEM.chart;

describe("BlockerChart", () => {
  it("writes no figure: only « Mandats », « Temps », the event words and the absorbed capacity", () => {
    render(<BlockerChart />);
    const scene = screen.getByTestId("blocker-chart-scene");
    expect(scene.textContent).not.toMatch(/\d/);
    expect(scene.textContent).toContain(CHART.axisX);
    expect(scene.textContent).toContain(CHART.axisY);
    expect(screen.getByTestId("problem-capacity").textContent).toBe("Capacité absorbée par l'administratif");
    // No axis, no dashed alert box any more.
    expect(scene.querySelector("rect")).toBeNull();
    expect(scene.textContent).not.toContain("Blocage administratif");
  });

  it("draws the six kinds of administrative events, each one named once", () => {
    render(<BlockerChart />);
    const events = screen.getAllByTestId("problem-event");
    expect(events).toHaveLength(PROBLEM_EVENTS.length);
    expect(new Set(events.map((event) => event.getAttribute("data-event-kind")))).toEqual(new Set(PROBLEM_EVENT_KINDS));
    const words = screen.getAllByTestId("problem-event-label").map((label) => label.textContent);
    expect(words).toHaveLength(6);
    expect([...words].sort()).toEqual(["Document", "Dossier", "Doublon", "Relance", "Suivi", "Validation"]);
  });

  it("is labelled « Illustration — exemple fictif »", () => {
    render(<BlockerChart />);
    expect(screen.getByTestId("blocker-chart-label").textContent).toBe("Illustration — exemple fictif");
  });

  it("is one image with an accessible name and a complete written description", () => {
    render(<BlockerChart />);
    const image = screen.getByRole("img");
    expect(image.getAttribute("aria-labelledby")).toContain("blocker-chart-title");
    expect(image.getAttribute("aria-labelledby")).toContain("blocker-chart-label");
    const described = document.getElementById(image.getAttribute("aria-describedby") ?? "");
    expect(described?.textContent).toBe(CHART.description);
    for (const words of ["progresse", "plafonne", "capacité absorbée par l'administratif", "relances manuelles", "dossiers dispersés", "doublons entre conseillers", "suivi saturé"]) {
      expect(CHART.description).toContain(words);
    }
    expect(CHART.description).not.toMatch(/\d/);
  });
});

describe("LandingProblem", () => {
  it("carries the full title as the accessible name, composed in two lines", () => {
    render(<LandingProblem />);
    const heading = screen.getByRole("heading", {
      level: 2,
      name: "Ce n'est pas la prospection qui freine vos mandats. C'est l'administratif.",
    });
    expect(heading.textContent).toBe(PROBLEM.title);
    expect(within(heading).getByText(PROBLEM.titleEmphasis)).toBeDefined();
  });

  it("lists the four causes with the words of the events they produce", () => {
    render(<LandingProblem />);
    const causes = screen.getByRole("list", { name: CHART.causesLabel });
    const items = within(causes).getAllByTestId("problem-cause");
    expect(items.map((item) => item.getAttribute("data-cause"))).toEqual(["relances", "dossiers", "doublons", "suivi"]);
    expect(causes.textContent).toContain("Relances manuelles");
    expect(causes.textContent).toContain("Dossiers dispersés");
    expect(causes.textContent).toContain("Doublons entre conseillers");
    expect(causes.textContent).toContain("Suivi saturé");
    // The link is written, not only shown by the highlight.
    expect(items[1]?.textContent).toContain("Dossier");
    expect(items[1]?.textContent).toContain("Document");
    expect(items[2]?.textContent).toContain("Doublon");
    expect(items[3]?.textContent).toContain("Validation");
  });

  it("highlights the events of a cause on hover, on focus, and pins them on click", () => {
    render(<LandingProblem />);
    const system = screen.getByTestId("problem-system");
    const highlighted = () =>
      Array.from(system.querySelectorAll("[data-testid='problem-event'][data-highlighted='true']"), (event) =>
        event.getAttribute("data-event-kind"),
      );

    const cause = screen.getAllByTestId("problem-cause")[1];
    if (!cause) throw new Error("missing cause");
    fireEvent.pointerOver(cause);
    expect(system.getAttribute("data-active-cause")).toBe("dossiers");
    expect(new Set(highlighted())).toEqual(new Set(["dossier", "document"]));
    fireEvent.pointerLeave(system);
    expect(highlighted()).toEqual([]);

    const button = screen.getByRole("button", { name: "Doublons entre conseillers" });
    fireEvent.focus(button);
    expect(new Set(highlighted())).toEqual(new Set(["doublon"]));
    fireEvent.blur(button);
    expect(highlighted()).toEqual([]);

    fireEvent.click(button);
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(new Set(highlighted())).toEqual(new Set(["doublon"]));
    fireEvent.keyDown(button, { key: "Escape" });
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });

  it("points back at the cause when an event of the chart is hovered", () => {
    render(<LandingProblem />);
    const event = screen.getAllByTestId("problem-event").find((node) => node.getAttribute("data-event-kind") === "suivi");
    if (!event) throw new Error("missing event");
    fireEvent.pointerOver(event);
    const cause = screen.getAllByTestId("problem-cause").find((node) => node.getAttribute("data-cause") === "suivi");
    expect(cause?.getAttribute("data-highlighted")).toBe("true");
  });
});
