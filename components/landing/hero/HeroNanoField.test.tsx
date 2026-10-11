// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HeroNanoField } from "./HeroNanoField";

afterEach(() => {
  cleanup();
});

describe("HeroNanoField, server HTML (docs/design-system.md §2.11.4 bis C, F)", () => {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(<HeroNanoField />);
  const field = container.querySelector<HTMLElement>("[data-testid='hero-nanorobots']")!;

  it("is an inert decorative layer that may loop (second exception of « aucune boucle »)", () => {
    expect(field.getAttribute("aria-hidden")).toBe("true");
    expect(field.getAttribute("data-loop")).toBe("allowed");
    expect(field.getAttribute("data-loop-state")).toBe("paused");
    expect(field.getAttribute("data-exchanges")).toBe("0");
    expect(field.getAttribute("data-exchanges-active")).toBe("0");
    expect(field.querySelectorAll("a, button, input, [tabindex]")).toHaveLength(0);
  });

  it("draws 64 robots (48 ambient, 16 actors in 8 pairs); 40 kept on a phone (C1)", () => {
    const robots = field.querySelectorAll("[data-nano-robot]");
    expect(robots).toHaveLength(64);
    expect(field.querySelectorAll("[data-nano-robot='ambient']")).toHaveLength(48);
    const actors = Array.from(field.querySelectorAll<HTMLElement>("[data-nano-robot='actor']"));
    expect(actors).toHaveLength(16);
    expect(new Set(actors.map((actor) => actor.dataset.pair))).toEqual(new Set(["1", "2", "3", "4", "5", "6", "7", "8"]));
    const keptOnPhone = Array.from(robots).filter((robot) => !robot.closest("[data-compact-hidden]") && !robot.hasAttribute("data-compact-hidden"));
    expect(keptOnPhone).toHaveLength(40);
  });

  it("composes the still state: pairs 3 and 4 linked (wire drawn, port of B lit), the others idle (C17)", () => {
    const phase = (pair: number) => field.querySelector<HTMLElement>(`[data-pair='${pair}'][data-role='a']`)!.dataset.phase;
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(phase)).toEqual(["idle", "idle", "link", "link", "idle", "idle", "idle", "idle"]);
    const wire = (pair: number) => field.querySelector<HTMLElement>(`[data-nano-pair='${pair}'] [data-nano-link]`)!.style;
    expect(wire(3).opacity).toBe("1");
    expect(wire(3).transform).toBe("scaleX(1)");
    expect(wire(1).opacity).toBe("0");
    // No glow anywhere (C9): no shadow nor filter in the markup.
    expect(container.innerHTML).not.toMatch(/box-shadow|filter|drop-shadow/);
  });
});

describe("HeroNanoField, reduced motion", () => {
  it("stays on the still composition, with no timer and state « reduced »", async () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
    const timers = vi.spyOn(window, "setTimeout");
    render(<HeroNanoField />);
    await act(async () => {});
    const field = screen.getByTestId("hero-nanorobots");
    expect(field.getAttribute("data-loop-state")).toBe("reduced");
    expect(field.getAttribute("data-exchanges")).toBe("0");
    expect(timers).not.toHaveBeenCalled();
  });
});
