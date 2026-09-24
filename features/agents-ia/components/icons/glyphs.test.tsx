// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AGENT_STEPS, STEP_GLYPHS } from "@/components/landing/agents/agent-steps";

import { AGENT_ICONS, JOURNEY_ICONS } from "../agent-icons";
import { buildDossierJourney } from "../dossier-journey";
import { journeyRailNodes } from "../DossierJourneyRail";
import { AgentAppIcon } from "./AgentAppIcon";
import { Glyph } from "./Glyph";
import { GLYPH_NAMES, GLYPH_STROKE_WIDTH, GLYPH_VIEWBOX, GLYPHS, STAGE_GLYPHS } from "./glyphs";

afterEach(() => {
  cleanup();
});

describe("glyph family", () => {
  it.each(GLYPH_NAMES)("%s shares the grid, the weight and the drawing rules", (name) => {
    const { container } = render(<Glyph name={name} width={14} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("viewBox")).toBe(GLYPH_VIEWBOX);
    expect(svg?.getAttribute("stroke-width")).toBe(String(GLYPH_STROKE_WIDTH));
    expect(svg?.getAttribute("fill")).toBe("none");
    expect(svg?.getAttribute("stroke")).toBe("currentColor");
    expect(svg?.getAttribute("stroke-linecap")).toBe("round");
    expect(svg?.getAttribute("stroke-linejoin")).toBe("round");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.getAttribute("width")).toBe("14");
    // No path overrides the family: no own colour, fill, width or transform.
    const paths = Array.from(container.querySelectorAll("path"));
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      for (const attribute of ["fill", "stroke", "stroke-width", "transform", "style"]) {
        expect(path.hasAttribute(attribute), `${name} ${attribute}`).toBe(false);
      }
    }
  });

  it("stays inside the live area of the 24 grid", () => {
    for (const name of GLYPH_NAMES) {
      const glyph = GLYPHS[name];
      const numbers = [...glyph.paths, ...glyph.accent]
        .join(" ")
        .match(/-?\d*\.?\d+/g)
        ?.map(Number);
      expect(numbers?.every((value) => Math.abs(value) <= 24), name).toBe(true);
    }
  });

  it("gives every stage of the carousel and of the rail its glyph", () => {
    for (const step of AGENT_STEPS) expect(STAGE_GLYPHS).toContain(STEP_GLYPHS[step.key]);
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
      expect(container.querySelector("svg")?.getAttribute("data-glyph")).toBeTruthy();
      expect(container.querySelector("svg")?.getAttribute("viewBox")).toBe(GLYPH_VIEWBOX);
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
    expect(tile?.querySelector("svg")?.getAttribute("width")).toBe("24");
  });

  it("defaults to an idle agent tile on a light surface", () => {
    const { container } = render(<AgentAppIcon glyph="lea" />);
    const tile = container.firstElementChild;
    expect([tile?.getAttribute("data-kind"), tile?.getAttribute("data-state"), tile?.getAttribute("data-surface")]).toEqual([
      "agent",
      "idle",
      "light",
    ]);
  });
});
