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
});
