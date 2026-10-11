// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AGENT_ICON_NAMES, ICON_NAMES, ICON_VIEWBOX } from "@/components/icons/icons";
import { AGENT_STEPS, STEP_GLYPHS } from "@/components/landing/agents/agent-steps";

import { AGENT_GLYPHS, AGENT_ICONS, JOURNEY_ICONS } from "../agent-icons";
import { buildDossierJourney } from "../dossier-journey";
import { journeyRailNodes } from "../DossierJourneyRail";
import { AgentAppIcon } from "./AgentAppIcon";

afterEach(() => {
  cleanup();
});

describe("agent and stage icons", () => {
  it("gives the five agents five distinct icons, none of them the generic « Agent IA »", () => {
    const icons = Object.values(AGENT_GLYPHS);
    expect(new Set(icons).size).toBe(5);
    expect(icons).not.toContain("aiAgent");
    for (const icon of icons) expect(AGENT_ICON_NAMES).toContain(icon);
  });

  it("gives every stage of the carousel and of the rail its icon", () => {
    for (const step of AGENT_STEPS) expect(ICON_NAMES).toContain(STEP_GLYPHS[step.key]);
    const rail = journeyRailNodes(buildDossierJourney([]));
    expect(rail).toHaveLength(10);
    const railIcons = new Set<unknown>([...Object.values(AGENT_ICONS), ...Object.values(JOURNEY_ICONS)]);
    for (const node of rail) expect(railIcons.has(node.icon), node.key).toBe(true);
    // Every node of a dossier is typed with the shape of the family.
    expect(rail.map((node) => node.tone)).toEqual([
      "neutral",
      "agent",
      "human",
      "agent",
      "agent",
      "human",
      "agent",
      "neutral",
      "agent",
      "outcome",
    ]);
  });

  it("renders the agent icons from the family (no Radix symbol left)", () => {
    for (const Icon of [...Object.values(AGENT_ICONS), ...Object.values(JOURNEY_ICONS)]) {
      const { container, unmount } = render(<Icon width={16} />);
      expect(container.querySelector("svg")?.getAttribute("data-icon")).toBeTruthy();
      expect(container.querySelector("svg")?.getAttribute("viewBox")).toBe(ICON_VIEWBOX);
      unmount();
    }
  });
});

describe("AgentAppIcon", () => {
  it("is decorative and exposes its kind, size, state and surface", () => {
    const { container } = render(<AgentAppIcon glyph="hugo" kind="human" size="lg" state="active" surface="dark" />);
    const tile = container.firstElementChild;
    expect(tile?.getAttribute("aria-hidden")).toBe("true");
    expect(tile?.getAttribute("data-kind")).toBe("human");
    expect(tile?.getAttribute("data-size")).toBe("lg");
    expect(tile?.getAttribute("data-state")).toBe("active");
    expect(tile?.getAttribute("data-surface")).toBe("dark");
    const svg = tile?.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("30");
    // Activation plays the small icon's story once.
    expect(svg?.getAttribute("data-icon-size")).toBe("sm");
    expect(svg?.hasAttribute("data-animate")).toBe(true);
  });

  it("defaults to an idle agent tile on a light surface, still until hovered", () => {
    const { container } = render(<AgentAppIcon glyph="lea" />);
    const tile = container.firstElementChild;
    expect([
      tile?.getAttribute("data-kind"),
      tile?.getAttribute("data-state"),
      tile?.getAttribute("data-surface"),
    ]).toEqual(["agent", "idle", "light"]);
    expect(tile?.querySelector("svg")?.hasAttribute("data-animate")).toBe(false);
  });

  it("greys an inactive tile and keeps it still", () => {
    const { container } = render(<AgentAppIcon glyph="emma" state="inactive" />);
    const svg = container.querySelector("svg");
    expect(svg?.hasAttribute("data-dimmed")).toBe(true);
    expect(svg?.hasAttribute("data-animated")).toBe(false);
  });
});
