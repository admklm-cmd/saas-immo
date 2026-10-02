// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { APP_TEXTS } from "@/components/texts";

import { SimulationBadge } from "./SimulationBadge";

afterEach(() => {
  cleanup();
});

describe("SimulationBadge", () => {
  it("always says « Simulation » in words, with its explanation", () => {
    render(<SimulationBadge />);
    const badge = screen.getByText(APP_TEXTS.states.simulation).closest("span[title]");
    expect(badge?.getAttribute("title")).toBe(APP_TEXTS.states.simulationHint);
  });

  it("floats and pulses through CSS classes only, and stays a badge", () => {
    const { container } = render(<SimulationBadge />);
    const badge = container.firstElementChild as HTMLElement;
    expect(badge.tagName).toBe("SPAN");
    expect(badge.classList.contains("simulation-badge")).toBe(true);
    expect(screen.getByTestId("simulation-dot").classList.contains("simulation-dot")).toBe(true);
    // Not a control: not focusable, no button role.
    expect(screen.queryByRole("button")).toBeNull();
    expect(badge.hasAttribute("tabindex")).toBe(false);
  });

  it("keeps its dark-on-light look by default and inverts on a dark surface only when asked", () => {
    const { container: light } = render(<SimulationBadge />);
    const { container: dark } = render(<SimulationBadge surface="dark" />);
    const lightBadge = light.firstElementChild as HTMLElement;
    const darkBadge = dark.firstElementChild as HTMLElement;
    expect(lightBadge.className).toContain("bg-inverse");
    expect(lightBadge.className).toContain("text-ink-inverse");
    expect(darkBadge.className).toContain("bg-ink-inverse");
    expect(darkBadge.className).toContain("text-inverse");
    expect(darkBadge.className).not.toMatch(/(^|s)bg-inverse(s|$)/);
    // Same words, same explanation, same motion classes.
    expect(darkBadge.textContent).toBe(APP_TEXTS.states.simulation);
    expect(darkBadge.getAttribute("title")).toBe(APP_TEXTS.states.simulationHint);
    expect(darkBadge.classList.contains("simulation-badge")).toBe(true);
  });
});
