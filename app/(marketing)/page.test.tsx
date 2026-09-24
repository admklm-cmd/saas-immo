// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { HERO_TITLE, LANDING_TEXTS } from "@/components/landing-texts";
import { LIVING_SCENES } from "@/components/landing/living/scenes";

import HomePage from "./page";

afterEach(() => {
  cleanup();
});

it("presents the hero, the five agents and the human safeguards", () => {
  render(<HomePage />);
  expect(screen.getByRole("heading", { level: 1, name: HERO_TITLE })).toBeDefined();

  // The seven steps of the carousel are tabs; the first one is shown at once.
  const tabs = screen.getAllByRole("tab");
  expect(tabs).toHaveLength(LANDING_TEXTS.agents.steps.length);
  expect(screen.getByText(LANDING_TEXTS.agents.steps[0].action)).toBeDefined();
  for (const fact of LANDING_TEXTS.control.facts) {
    expect(screen.getByText(fact.body)).toBeDefined();
  }
  expect(screen.getAllByText("Simulation").length).toBeGreaterThan(0);
  // Hero journey and carousel scene: both say they are a fictitious simulation.
  expect(screen.getAllByText(LANDING_TEXTS.journey.badge).length).toBeGreaterThanOrEqual(2);
});

it("drives one background scene per section, and the background is decorative", () => {
  const { container } = render(<HomePage />);
  const scenes = Array.from(container.querySelectorAll("[data-living-scene]")).map((section) =>
    section.getAttribute("data-living-scene"),
  );
  expect(scenes).toEqual([...LIVING_SCENES]);
  expect(screen.getByTestId("living-background").getAttribute("aria-hidden")).toBe("true");
});

it("offers both public estimation and agency access, and no floating contact button", () => {
  render(<HomePage />);
  const estimationLinks = screen.getAllByRole("link", { name: LANDING_TEXTS.actions.estimation });
  const signInLinks = screen.getAllByRole("link", { name: LANDING_TEXTS.actions.signIn });
  expect(estimationLinks.every((link) => link.getAttribute("href") === "/estimation")).toBe(true);
  expect(signInLinks.every((link) => link.getAttribute("href") === "/connexion")).toBe(true);
  expect(screen.queryByRole("link", { name: /whatsapp|contact/i })).toBeNull();
});
