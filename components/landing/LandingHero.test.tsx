// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HERO_TITLE, LANDING_TEXTS } from "@/components/landing-texts";

import { CYCLE_MS } from "./ecosystem/ecosystem-timeline";
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

/** The boxes of block A: who checks them, and whether they are checked. */
function boxes(root: ParentNode) {
  return Array.from(root.querySelectorAll<HTMLElement>("[data-check]")).map((box) => ({
    by: box.getAttribute("data-check"),
    checked: box.getAttribute("data-checked") === "true",
  }));
}

describe("LandingHero without JavaScript (server HTML)", () => {
  const html = renderToStaticMarkup(<LandingHero />);
  const container = document.createElement("div");
  container.innerHTML = html;

  it("contains the complete title as real text", () => {
    const h1 = container.querySelector("h1");
    expect(h1?.querySelector(".sr-only")?.textContent).toBe(HERO_TITLE);
    const visual = h1?.querySelector("[data-testid='editorial-title-visual']");
    expect(visual?.textContent?.replace(/\s+/g, " ").trim()).toBe(HERO_TITLE);
  });

  it("shows the tilted tag, the actions and the simulation labels (A5)", () => {
    expect(container.textContent).toContain(LANDING_TEXTS.hero.tag);
    expect(container.textContent).toContain(JOURNEY.badge);
    expect(container.textContent).toContain("Simulation");
    expect(container.textContent).toContain(JOURNEY.note);
    expect(container.textContent).toContain(LANDING_TEXTS.hero.illustrationNote);
    expect(container.querySelector("[data-testid='ecosystem-guard']")?.textContent).toBe(
      "Les agents préparent. Vous validez le premier message et confirmez le mandat.",
    );
    const links = Array.from(container.querySelectorAll("a")).map((link) => link.getAttribute("href"));
    expect(links).toEqual(expect.arrayContaining(["/estimation", "/connexion"]));
    // Block A ends on its own action toward the estimation.
    const figure = container.querySelector("[data-testid='hero-ecosystem']")!;
    expect(Array.from(figure.querySelectorAll("a")).map((link) => link.getAttribute("href"))).toEqual(["/estimation"]);
  });

  it("renders block A in its final state (A2): 12 of 13 agent lines checked, Motivation dashed, 3 « you » boxes, the « Vous » pill full, still cursor on « Mandat confirmé »", () => {
    const figure = container.querySelector<HTMLElement>("[data-testid='hero-ecosystem']")!;
    expect(figure.getAttribute("data-loop")).toBe("allowed");
    expect(figure.getAttribute("data-step")).toBe("final");
    const all = boxes(figure);
    expect(all.filter((box) => box.by === "agent")).toHaveLength(12);
    expect(all.filter((box) => box.by === "agent").every((box) => box.checked)).toBe(true);
    expect(all.filter((box) => box.by === "missing")).toEqual([{ by: "missing", checked: false }]);
    expect(figure.querySelector("[data-check='missing']")?.getAttribute("data-traced")).toBe("true");
    expect(all.filter((box) => box.by === "you")).toEqual([
      { by: "you", checked: true },
      { by: "you", checked: true },
      { by: "you", checked: true },
    ]);
    expect(figure.querySelectorAll("[data-pill='you'][data-full]")).toHaveLength(1);
    expect(figure.querySelectorAll("[data-block]")).toHaveLength(3);
    expect(figure.querySelectorAll("[data-block][data-active]")).toHaveLength(0);
    expect(figure.querySelectorAll("[data-app-tile]")).toHaveLength(3);
    const still = figure.querySelector("[data-testid='ecosystem-cursor-still']")!;
    expect(still.closest("[data-block]")?.getAttribute("data-block")).toBe("validation");
    expect(still.closest("[data-case]")?.getAttribute("data-case")).toBe("1:1:0");
    expect(still.textContent).toBe(JOURNEY.cursor);
    // No live cursor, no line before the first measure.
    expect(figure.querySelector("[data-testid='ecosystem-cursor']")).toBeNull();
  });

  it("draws the blocks in an aria-hidden layer and reads the final state from a static list", () => {
    const figure = container.querySelector<HTMLElement>("[data-testid='hero-ecosystem']")!;
    expect(figure.getAttribute("aria-labelledby")).toBe("hero-ecosystem-title");
    expect(container.querySelector("#hero-ecosystem-title")?.textContent).toBe(JOURNEY.title);
    for (const block of figure.querySelectorAll("[data-block]")) expect(block.closest("[aria-hidden='true']")).not.toBeNull();
    const summary = Array.from(figure.querySelectorAll("[data-testid='ecosystem-summary'] li")).map((item) => item.textContent);
    expect(summary).toEqual([...JOURNEY.srSummary]);
    const dots = Array.from(figure.querySelectorAll("button")).map((button) => button.getAttribute("aria-label"));
    expect(dots).toEqual(JOURNEY.blocks.map((block, index) => `Bloc ${index + 1} sur 3 : ${block.name}`));
  });

  it("shows no figure, percentage or price", () => {
    expect(container.textContent).not.toMatch(/\d+\s?%|€|\bclients?\b|témoignage/i);
  });
});

/** IntersectionObserver stub: `show()` / `hide()` report the figure on or off screen. */
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
  const report = (target: Element, ratio: number) => {
    const entry = { isIntersecting: ratio > 0, intersectionRatio: ratio, target } as unknown as IntersectionObserverEntry;
    act(() => callbacks.forEach((callback) => callback([entry], {} as IntersectionObserver)));
  };
  return {
    observed: () => observed,
    show: (target: Element) => report(target, 1),
    hide: (target: Element) => report(target, 0.1),
  };
}

describe("LandingHero in the browser: block A loop", () => {
  const figure = () => screen.getByTestId("hero-ecosystem");
  const advance = (ms: number) =>
    act(() => {
      vi.advanceTimersByTime(ms);
    });

  it("keeps the final state under reduced motion: no timer, no live cursor", () => {
    mockMotion(true);
    const io = mockIntersection();
    render(<LandingHero />);
    io.show(figure());
    advance(30_000);
    expect(figure().getAttribute("data-loop-state")).toBe("reduced");
    expect(figure().getAttribute("data-step")).toBe("final");
    expect(boxes(figure()).filter((box) => box.checked)).toHaveLength(15);
    expect(vi.getTimerCount()).toBe(0);
    expect(screen.queryByTestId("ecosystem-cursor")).toBeNull();
  });

  it("plays in a loop on screen: reset, agents, then you; cycle 2 at 24 s", () => {
    mockMotion(false);
    const io = mockIntersection();
    render(<LandingHero />);
    expect(figure().getAttribute("data-loop-state")).toBe("paused");
    expect(boxes(figure()).filter((box) => box.checked)).toHaveLength(15);
    io.show(figure());
    expect(figure().getAttribute("data-loop-state")).toBe("playing");
    expect(figure().getAttribute("data-loop-cycles")).toBe("1");
    // The reset: nothing checked.
    expect(boxes(figure()).filter((box) => box.checked)).toHaveLength(0);
    advance(3_000);
    const at3s = boxes(figure());
    expect(at3s.filter((box) => box.by === "agent" && box.checked)).toHaveLength(3);
    expect(at3s.filter((box) => box.by === "you" && box.checked)).toHaveLength(0);
    advance(CYCLE_MS - 3_000);
    expect(figure().getAttribute("data-loop-cycles")).toBe("2");
    // The live cursor exists once motion is welcome.
    expect(screen.getByTestId("ecosystem-cursor")).toBeDefined();
  });

  it("pauses off screen and in a hidden tab (no timer), resumes at the same step", () => {
    mockMotion(false);
    const io = mockIntersection();
    render(<LandingHero />);
    io.show(figure());
    advance(2_000);
    const step = figure().getAttribute("data-step");
    io.hide(figure());
    expect(figure().getAttribute("data-loop-state")).toBe("paused");
    expect(vi.getTimerCount()).toBe(0);
    advance(20_000);
    expect(figure().getAttribute("data-step")).toBe(step);
    io.show(figure());
    expect(figure().getAttribute("data-loop-state")).toBe("playing");
    expect(figure().getAttribute("data-step")).toBe(step);

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(figure().getAttribute("data-loop-state")).toBe("paused");
    expect(vi.getTimerCount()).toBe(0);
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(figure().getAttribute("data-loop-state")).toBe("playing");
  });
});
