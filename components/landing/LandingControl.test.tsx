// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LANDING_TEXTS } from "@/components/landing-texts";
import { APP_TEXTS } from "@/components/texts";

import { LandingControl } from "./LandingControl";

const TEXTS = LANDING_TEXTS.control;

/** The server HTML: what a visitor without JavaScript (or under reduced motion) gets. */
function serverDom(): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(<LandingControl />);
  return container;
}

describe("LandingControl — two tiles (§2.11.8.7 L3-C, L3-D)", () => {
  it("centres the title and keeps the tech effect on « décide »", () => {
    const title = serverDom().querySelector("#control-title")!;
    expect(title.tagName).toBe("H2");
    expect(title.getAttribute("data-title-align")).toBe("center");
    expect(title.getAttribute("data-accent-effect")).toBe("tech");
  });

  it("replaces the six cards with two tiles", () => {
    const dom = serverDom();
    const grid = dom.querySelector("[data-testid='control-grid']")!;
    expect(grid.tagName).toBe("UL");
    expect(grid.querySelectorAll(":scope > li")).toHaveLength(2);
    expect(dom.querySelectorAll("[data-testid='control-tile']")).toHaveLength(2);
    expect(Array.from(dom.querySelectorAll("h3")).map((heading) => heading.textContent)).toEqual([
      TEXTS.tiles.team.title,
      TEXTS.tiles.timeline.title,
    ]);
  });

  it("writes the six guard rails as text, 3 + 3 in the order of the spec", () => {
    const dom = serverDom();
    const lists = Array.from(dom.querySelectorAll("[data-testid='control-facts']"));
    expect(lists).toHaveLength(2);
    const byTile = lists.map((list) => Array.from(list.querySelectorAll("li")).map((item) => item.textContent));
    const line = (index: number) => `${TEXTS.facts[index]!.title} — ${TEXTS.facts[index]!.body}`;
    expect(byTile[0]).toEqual([line(0), line(1), line(3)]);
    expect(byTile[1]).toEqual([line(2), line(4), line(5)]);
    for (const fact of TEXTS.facts) {
      expect(dom.textContent).toContain(fact.title);
      expect(dom.textContent).toContain(fact.body);
    }
  });

  it("names the two visuals as images", () => {
    const images = Array.from(serverDom().querySelectorAll("[role='img']")).map((image) => image.getAttribute("aria-label"));
    expect(images).toEqual([TEXTS.tiles.team.visualLabel, TEXTS.tiles.timeline.visualLabel]);
  });

  it("labels the timeline only « Simulation · Exemple fictif »", () => {
    const tiles = Array.from(serverDom().querySelectorAll("[data-testid='control-tile']"));
    expect(tiles[0]!.querySelector("[data-testid='control-fictive']")).toBeNull();
    const label = tiles[1]!.querySelector("[data-testid='control-fictive']");
    expect(label?.textContent).toContain(APP_TEXTS.states.simulation);
    expect(label?.textContent).toContain(TEXTS.tiles.timeline.fictive);
  });

  it("chart: five roles, a verified badge, the kill switch, no photo", () => {
    const dom = serverDom();
    expect(Array.from(dom.querySelectorAll("[data-team-role]")).map((role) => role.getAttribute("data-team-role"))).toEqual([
      "Léa",
      "Hugo",
      "Emma",
      "Louis",
      "Sarah",
    ]);
    expect(dom.querySelector("[data-testid='control-team-verified']")).not.toBeNull();
    expect(dom.querySelector("[data-testid='control-team-kill-switch']")?.textContent).toBe(TEXTS.tiles.team.killSwitch);
    expect(dom.querySelector("img")).toBeNull();
  });

  it("server HTML of the timeline is its final state, and never a loop", () => {
    const dom = serverDom();
    const timeline = dom.querySelector("[data-testid='control-timeline']")!;
    expect(timeline.getAttribute("data-visual-state")).toBe("done");
    expect(dom.querySelector("[data-loop]")).toBeNull();
    expect(dom.querySelector("[data-block='firstContact']")?.getAttribute("data-decision")).toBe("validated");
    expect(dom.querySelector("[data-block='mandate']")?.getAttribute("data-decision")).toBe("pending");
    expect(Array.from(dom.querySelectorAll("[data-block]")).every((block) => block.getAttribute("data-shown") === "true")).toBe(true);
    expect(dom.querySelector("[data-testid='control-playhead']")?.getAttribute("data-day")).toBe("8.6");
    expect(dom.querySelector("[data-testid='control-file-state'] [data-active]")?.textContent).toBe("Mandat · à confirmer par vous");
  });

  it("claims no figure: no percentage", () => {
    expect(serverDom().textContent).not.toMatch(/%/);
  });
});
