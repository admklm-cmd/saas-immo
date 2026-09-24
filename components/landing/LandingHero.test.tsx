// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HERO_TITLE, LANDING_TEXTS } from "@/components/landing-texts";

import { LandingHero } from "./LandingHero";

const JOURNEY = LANDING_TEXTS.journey;

function mockMotion(reduced: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("reduce") ? reduced : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  delete document.documentElement.dataset.landingMotion;
});

describe("LandingHero without JavaScript (server HTML)", () => {
  const html = renderToStaticMarkup(<LandingHero />);
  const container = document.createElement("div");
  container.innerHTML = html;

  it("contains the complete title as real text", () => {
    const h1 = container.querySelector("h1");
    expect(h1?.querySelector(".sr-only")?.textContent).toBe(HERO_TITLE);
    // The visible words, line by line, are in the HTML too: no JavaScript needed.
    const visual = h1?.querySelector("[data-testid='hero-title-visual']");
    expect(visual?.textContent?.replace(/\s+/g, " ").trim()).toBe(HERO_TITLE);
  });

  it("shows the tilted tag, the two actions and the simulation labels", () => {
    expect(container.textContent).toContain(LANDING_TEXTS.hero.tag);
    expect(container.textContent).toContain(JOURNEY.badge);
    expect(container.textContent).toContain("Simulation");
    const links = Array.from(container.querySelectorAll("a")).map((link) => link.getAttribute("href"));
    expect(links).toEqual(expect.arrayContaining(["/estimation", "/connexion"]));
  });

  it("renders the fictitious journey in its final state: every step done", () => {
    const steps = Array.from(container.querySelectorAll("[data-testid='hero-journey'] li"));
    expect(steps).toHaveLength(JOURNEY.steps.length);
    expect(steps.every((step) => step.getAttribute("data-state") === "done")).toBe(true);
    expect(container.textContent).toContain(JOURNEY.states.confirmed);
  });

  it("shows no figure, percentage or price", () => {
    expect(container.textContent).not.toMatch(/\d+\s?%|€|\bclients?\b|témoignage/i);
  });
});

describe("LandingHero in the browser", () => {
  it("keeps the final state and no pause button under reduced motion", () => {
    mockMotion(true);
    render(<LandingHero />);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    const journey = screen.getByTestId("hero-journey");
    const states = within(journey)
      .getAllByRole("listitem")
      .map((item) => item.getAttribute("data-state"));
    expect(states.every((state) => state === "done")).toBe(true);
    expect(screen.queryByTestId("landing-motion-toggle")).toBeNull();
  });

  it("plays the illustration with full motion, stops at the human validation, and can be paused", () => {
    mockMotion(false);
    render(<LandingHero />);
    const humanIndex = JOURNEY.steps.findIndex((step) => step.kind === "human");
    const journey = screen.getByTestId("hero-journey");
    const stateOf = (index: number) => within(journey).getAllByRole("listitem")[index]?.getAttribute("data-state");

    // Advance until the first human step waits for its validation.
    for (let tick = 0; tick < 40 && stateOf(humanIndex) !== "awaiting"; tick++) {
      act(() => {
        vi.advanceTimersByTime(250);
      });
    }
    expect(stateOf(humanIndex)).toBe("awaiting");
    expect(screen.getByText(JOURNEY.states.awaiting)).toBeDefined();

    const toggle = screen.getByTestId("landing-motion-toggle");
    act(() => {
      toggle.click();
    });
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    const frozen = within(journey)
      .getAllByRole("listitem")
      .map((item) => item.getAttribute("data-state"));
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(
      within(journey)
        .getAllByRole("listitem")
        .map((item) => item.getAttribute("data-state")),
    ).toEqual(frozen);
  });
});
