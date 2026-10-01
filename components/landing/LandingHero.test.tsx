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
});

describe("LandingHero without JavaScript (server HTML)", () => {
  const html = renderToStaticMarkup(<LandingHero />);
  const container = document.createElement("div");
  container.innerHTML = html;

  it("contains the complete title as real text", () => {
    const h1 = container.querySelector("h1");
    expect(h1?.querySelector(".sr-only")?.textContent).toBe(HERO_TITLE);
    // The visible words, line by line, are in the HTML too: no JavaScript needed.
    const visual = h1?.querySelector("[data-testid='editorial-title-visual']");
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

/** IntersectionObserver stub: `show()` reports the figure as fully visible. */
function mockIntersection() {
  const callbacks: IntersectionObserverCallback[] = [];
  let observed = 0;
  class Observer {
    constructor(callback: IntersectionObserverCallback) {
      callbacks.push(callback);
    }
    observe() {
      observed += 1;
    }
    disconnect() {}
    unobserve() {}
    takeRecords() {
      return [];
    }
  }
  window.IntersectionObserver = Observer as unknown as typeof IntersectionObserver;
  return {
    observed: () => observed,
    show(target: Element) {
      const entry = { isIntersecting: true, intersectionRatio: 1, target } as unknown as IntersectionObserverEntry;
      act(() => callbacks.forEach((callback) => callback([entry], {} as IntersectionObserver)));
    },
  };
}

describe("LandingHero in the browser", () => {
  const statesOf = () =>
    within(screen.getByTestId("hero-journey"))
      .getAllByRole("listitem")
      .map((item) => item.getAttribute("data-state"));

  it("keeps the final state under reduced motion: no timer, no observer, no button", () => {
    mockMotion(true);
    const io = mockIntersection();
    render(<LandingHero />);
    expect(io.observed()).toBe(0);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(statesOf().every((state) => state === "done")).toBe(true);
    expect(screen.queryByRole("button")).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("plays once when it enters the screen, stops at the human validation, then stays on the final state", () => {
    mockMotion(false);
    const io = mockIntersection();
    render(<LandingHero />);
    const journey = screen.getByTestId("hero-journey");
    // Before entering: the final state (server HTML), nothing scheduled.
    expect(statesOf().every((state) => state === "done")).toBe(true);
    expect(journey.getAttribute("data-playback")).toBe("ready");

    io.show(journey);
    expect(journey.getAttribute("data-playback")).toBe("playing");
    expect(statesOf().every((state) => state === "waiting")).toBe(true);

    const humanIndex = JOURNEY.steps.findIndex((step) => step.kind === "human");
    let sawAwaiting = false;
    for (let elapsed = 0; elapsed < 4_700; elapsed += 50) {
      act(() => {
        vi.advanceTimersByTime(50);
      });
      if (statesOf()[humanIndex] === "awaiting") sawAwaiting = true;
    }
    expect(sawAwaiting).toBe(true);
    // 4.7 s: the final state, and nothing left to play.
    expect(statesOf().every((state) => state === "done")).toBe(true);
    expect(journey.getAttribute("data-playback")).toBe("played");
    expect(vi.getTimerCount()).toBe(0);
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(statesOf().every((state) => state === "done")).toBe(true);
    // Entering the screen again replays nothing.
    io.show(journey);
    expect(journey.getAttribute("data-playback")).toBe("played");
  });

  it("jumps to the final state when the tab is hidden mid-way", () => {
    mockMotion(false);
    const io = mockIntersection();
    render(<LandingHero />);
    const journey = screen.getByTestId("hero-journey");
    io.show(journey);
    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(statesOf().some((state) => state !== "done")).toBe(true);
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    expect(statesOf().every((state) => state === "done")).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
