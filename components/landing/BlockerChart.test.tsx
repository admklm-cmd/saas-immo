// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LANDING_TEXTS } from "@/components/landing-texts";

import { BlockerChart } from "./BlockerChart";
import { LandingProblem } from "./LandingProblem";

afterEach(() => {
  cleanup();
});

const CHART = LANDING_TEXTS.problem.chart;

describe("BlockerChart", () => {
  it("writes no figure in the SVG: the axes only say « Temps » and « Mandats »", () => {
    render(<BlockerChart />);
    const svg = screen.getByTestId("blocker-chart-svg");
    expect(svg.textContent).not.toMatch(/\d/);
    const words = Array.from(svg.querySelectorAll("text"), (text) => text.textContent);
    expect(words).toEqual(expect.arrayContaining([CHART.axisX, CHART.axisY, CHART.zone]));
  });

  it("is labelled « Illustration — exemple fictif »", () => {
    render(<BlockerChart />);
    expect(screen.getByTestId("blocker-chart-label").textContent).toBe("Illustration — exemple fictif");
  });

  it("is an image with an accessible name and a written description", () => {
    render(<BlockerChart />);
    const image = screen.getByRole("img");
    expect(image.getAttribute("aria-labelledby")).toContain("blocker-chart-title");
    const described = document.getElementById(image.getAttribute("aria-describedby") ?? "");
    expect(described?.textContent).toBe(CHART.description);
    for (const cause of ["relances manuelles", "dossiers dispersés", "doublons entre conseillers"]) {
      expect(CHART.description).toContain(cause);
    }
  });
});

describe("LandingProblem", () => {
  it("carries the new title and the three causes of the block", () => {
    render(<LandingProblem />);
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Ce n'est pas la prospection qui freine vos mandats. C'est l'administratif.",
      }),
    ).toBeDefined();
    const causes = screen.getByRole("list", { name: CHART.causesLabel });
    expect(causes.textContent).toContain("Relances manuelles");
    expect(causes.textContent).toContain("Dossiers dispersés");
    expect(causes.textContent).toContain("Doublons entre conseillers");
  });
});
