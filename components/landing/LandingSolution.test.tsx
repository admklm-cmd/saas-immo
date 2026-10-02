// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LANDING_TEXTS } from "@/components/landing-texts";
import { APP_TEXTS } from "@/components/texts";

import { LandingSolution } from "./LandingSolution";
import { easedTime, EASE_DRAW, roadmapPath, smoothPath, teamPosition } from "./solution/solution-geometry";

const TEXTS = LANDING_TEXTS.solution;

afterEach(() => {
  cleanup();
});

/** Digits allowed outside tile 5: the ordinals of the steps (01–07) and the fictitious « 3 actions prêtes ». */
function strayDigits(text: string): string {
  return text.replace(/(?<!\d)0[1-7](?!\d)/g, "").replace(TEXTS.tiles.report.actions, "").replace(/\d/g, "#").replace(/[^#]/g, "");
}

describe("LandingSolution — block B (§2.11.8.4)", () => {
  it("keeps the heading, without any title effect", () => {
    const { container } = render(<LandingSolution />);
    const title = container.querySelector("#solution-title")!;
    expect(title.tagName).toBe("H2");
    expect(title.hasAttribute("data-accent-effect")).toBe(false);
    expect(title.hasAttribute("data-accent-replayable")).toBe(false);
    expect(screen.getByText(TEXTS.body)).toBeTruthy();
  });

  it("lays out five tiles in a list, each with its title and paragraph", () => {
    render(<LandingSolution />);
    const grid = screen.getByTestId("solution-grid");
    expect(grid.tagName).toBe("UL");
    const tiles = within(grid).getAllByRole("listitem").filter((item) => item.hasAttribute("data-tile"));
    expect(tiles.map((tile) => tile.getAttribute("data-tile"))).toEqual(["1", "2", "3", "4", "5"]);
    const titles = within(grid).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
    expect(titles).toEqual([
      TEXTS.tiles.roadmap.title,
      TEXTS.tiles.progress.title,
      TEXTS.tiles.team.title,
      TEXTS.tiles.report.title,
      TEXTS.tiles.guards.title,
    ]);
  });

  it("labels tiles 1 to 4 « Simulation · Exemple fictif », never tile 5 (real rules)", () => {
    render(<LandingSolution />);
    const tiles = Array.from(screen.getByTestId("solution-grid").querySelectorAll<HTMLElement>("li[data-tile]"));
    tiles.forEach((tile, index) => {
      const label = tile.querySelector("[data-testid='solution-fictive']");
      if (index < 4) {
        expect(label?.textContent, `tile ${index + 1}`).toContain(APP_TEXTS.states.simulation);
        expect(label?.textContent, `tile ${index + 1}`).toContain(TEXTS.fictive);
      } else {
        expect(label, "tile 5").toBeNull();
      }
    });
  });

  it("names the four drawings as images, and leaves the rules of tile 5 as text", () => {
    render(<LandingSolution />);
    const images = screen.getAllByRole("img").map((image) => image.getAttribute("aria-label"));
    expect(images).toEqual([
      TEXTS.tiles.roadmap.visualLabel,
      TEXTS.tiles.progress.visualLabel,
      TEXTS.tiles.team.visualLabel,
      TEXTS.tiles.report.visualLabel,
    ]);
    const guards = screen.getByTestId("solution-guards");
    expect(guards.closest("[role='img']")).toBeNull();
    expect(guards.textContent).toContain("0envoi réel dans ce prototype");
    expect(guards.textContent).toContain("2validations humaines obligatoires");
    expect(guards.textContent).toContain("Validés par un humain");
    expect(guards.textContent).toContain("Un clic");
  });

  it("shows no figure outside tile 5 (step ordinals aside), and no percentage anywhere", () => {
    render(<LandingSolution />);
    const tiles = Array.from(screen.getByTestId("solution-grid").querySelectorAll<HTMLElement>("li[data-tile]"));
    for (const tile of tiles.slice(0, 4)) {
      expect(strayDigits(tile.textContent ?? ""), `tile ${tile.dataset.tile}`).toBe("");
    }
    expect(screen.getByTestId("solution-grid").textContent).not.toMatch(/%|€/);
  });

  it("roadmap: seven real steps, the dossier waits at the human validation, one cobalt dot", () => {
    render(<LandingSolution />);
    const roadmap = screen.getByTestId("solution-roadmap");
    const steps = Array.from(roadmap.querySelectorAll("li"));
    expect(steps.map((step) => step.getAttribute("data-step-state"))).toEqual(["done", "done", "done", "waiting", "later", "later", "later"]);
    expect(steps[3]?.textContent).toContain(TEXTS.tiles.roadmap.pending);
    expect(roadmap.querySelectorAll("[data-testid='solution-roadmap-dot']")).toHaveLength(1);
  });

  it("progress: the real stages of the pipeline, « Perdu » aside, no value", () => {
    render(<LandingSolution />);
    const progress = screen.getByTestId("solution-progress");
    expect(Array.from(progress.querySelectorAll("ol li")).map((item) => item.textContent)).toEqual([
      "Nouveau",
      "Qualifié",
      "Chaud",
      "RDV planifié",
      "Estimation faite",
      "Mandat signé",
    ]);
    expect(progress.textContent).not.toContain("Perdu");
    expect(progress.textContent).toContain(TEXTS.tiles.progress.heading);
  });

  it("team: the five agents around « Vous », no photo", () => {
    render(<LandingSolution />);
    const team = screen.getByTestId("solution-team");
    expect(Array.from(team.querySelectorAll("[data-team-agent]")).map((agent) => agent.getAttribute("data-team-agent"))).toEqual([
      "Léa",
      "Hugo",
      "Emma",
      "Louis",
      "Sarah",
    ]);
    expect(screen.getByTestId("solution-team-you").textContent).toContain(TEXTS.tiles.team.youRole);
    expect(team.querySelector("img")).toBeNull();
  });
});

describe("solution geometry", () => {
  it("draws one dotted segment per pair of steps, alternating sides", () => {
    const path = roadmapPath(7);
    expect(path.startsWith("M 0 ")).toBe(true);
    expect(path.match(/C /g)).toHaveLength(6);
  });

  it("draws a smooth curve through every point", () => {
    expect(smoothPath([{ x: 0, y: 80 }, { x: 50, y: 50 }, { x: 100, y: 10 }])).toMatch(/^M 0 80 C .* 100 10$/);
  });

  it("times the dots with the drawing ease: 0 at the start, 1 at the end, monotonic", () => {
    const times = [0, 0.2, 0.4, 0.6, 0.8, 1].map((share) => easedTime(share, EASE_DRAW));
    expect(times[0]).toBeCloseTo(0, 3);
    expect(times[5]).toBeCloseTo(1, 3);
    for (let index = 1; index < times.length; index += 1) expect(times[index]!).toBeGreaterThan(times[index - 1]!);
  });

  it("keeps the agents inside the frame, the three that prepare on the left", () => {
    const positions = [0, 1, 2, 3, 4].map((index) => teamPosition(index));
    for (const position of positions) {
      expect(position.x).toBeGreaterThan(0);
      expect(position.x).toBeLessThan(100);
      expect(position.y).toBeGreaterThan(15);
      expect(position.y).toBeLessThan(90);
    }
    expect(positions.slice(0, 3).every((position) => position.x < 50)).toBe(true);
    expect(positions.slice(3).every((position) => position.x > 50)).toBe(true);
  });
});
