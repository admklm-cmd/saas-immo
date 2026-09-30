// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Icon, iconComponent } from "./Icon";
import { BOARD_ICON_NAMES, DANGER_ICON_NAMES, ICON_NAMES, ICON_VIEWBOX, ICONS } from "./icons";

const BASE_CSS = readFileSync(resolve(__dirname, "icons.css"), "utf8");
const STORIES_CSS = readFileSync(resolve(__dirname, "icon-stories.css"), "utf8");

/** Sub-elements moved by a shared (not per-icon) story of icon-stories.css. */
const SHARED_STORIES = /^(seq-\d|disc|check|signature)$/;

afterEach(() => {
  cleanup();
});

describe("icon family", () => {
  it("has the 24 icons of the reference boards, in their order", () => {
    expect(BOARD_ICON_NAMES).toEqual([
      "dashboard",
      "contacts",
      "leads",
      "pipeline",
      "deal",
      "aiAgent",
      "automation",
      "messages",
      "calendar",
      "tasks",
      "reminders",
      "email",
      "phone",
      "humanValidation",
      "simulation",
      "analytics",
      "growth",
      "priority",
      "alert",
      "search",
      "filters",
      "settings",
      "integrations",
      "notifications",
    ]);
  });

  it.each(ICON_NAMES)("%s: one decorative svg, one grid, three named layers, one accent", (name) => {
    const { container } = render(<Icon name={name} px={20} />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs).toHaveLength(1);
    const svg = svgs[0]!;
    expect(svg.getAttribute("viewBox")).toBe(ICON_VIEWBOX);
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("focusable")).toBe("false");
    expect(svg.getAttribute("width")).toBe("20");
    expect(svg.getAttribute("data-icon-size")).toBe("sm");
    // Exactly one accent layer, never empty; at most one ink and one glass layer.
    expect(svg.querySelectorAll('[data-part="accent"]')).toHaveLength(1);
    expect(svg.querySelector('[data-part="accent"]')?.childElementCount).toBeGreaterThan(0);
    expect(svg.querySelectorAll('[data-part="ink"]')).toHaveLength(1);
    expect(svg.querySelectorAll('[data-part="glass"]').length).toBeLessThanOrEqual(1);
    // No hard-coded colour, no inline style, no opacity: the layers paint, the
    // still drawing is the final frame.
    for (const element of Array.from(svg.querySelectorAll("*"))) {
      for (const attribute of ["fill", "stroke"]) {
        const value = element.getAttribute(attribute);
        if (value !== null) expect(["currentColor", "none"], `${name} ${attribute}=${value}`).toContain(value);
      }
      expect(element.hasAttribute("style"), `${name} style`).toBe(false);
      expect(element.hasAttribute("opacity"), `${name} opacity`).toBe(false);
      if (element.hasAttribute("data-m"))
        expect(element.hasAttribute("transform"), `${name} moved + transform`).toBe(false);
    }
  });

  it("stays on the 24 grid (every coordinate within it)", () => {
    for (const name of ICON_NAMES) {
      const { container, unmount } = render(<Icon name={name} />);
      const numbers = Array.from(container.querySelectorAll("path"))
        .map((path) => path.getAttribute("d") ?? "")
        .join(" ")
        .match(/-?\d*\.?\d+/g)
        ?.map(Number);
      expect(numbers?.every((value) => Math.abs(value) <= 24) ?? true, name).toBe(true);
      unmount();
    }
  });

  it("keeps red for the alert only", () => {
    for (const name of ICON_NAMES) {
      const tone = ICONS[name].tone;
      expect(tone === "danger", name).toBe(DANGER_ICON_NAMES.includes(name));
    }
    expect(DANGER_ICON_NAMES).toEqual(["alert"]);
  });

  it("gives every animated icon a story, and none to the utility signs that never move", () => {
    for (const name of ICON_NAMES) {
      const { container, unmount } = render(<Icon name={name} />);
      const svg = container.querySelector("svg")!;
      const shared = Array.from(svg.querySelectorAll("[data-m]")).some((el) =>
        SHARED_STORIES.test(el.getAttribute("data-m") ?? ""),
      );
      const own = STORIES_CSS.includes(`data-icon="${name}"`);
      if (ICONS[name].animated) {
        expect(svg.hasAttribute("data-animated"), name).toBe(true);
        expect(own || shared, `${name} has no story`).toBe(true);
      } else {
        expect(svg.hasAttribute("data-animated"), name).toBe(false);
        expect(own, `${name} is still by design`).toBe(false);
      }
      unmount();
    }
  });
});

describe("small variant", () => {
  it("never loops: every story plays once, nothing is infinite", () => {
    for (const css of [BASE_CSS, STORIES_CSS]) expect(css).not.toMatch(/infinite/);
    // The small trigger rule: one iteration.
    expect(BASE_CSS).toMatch(/svg\[data-icon-size="sm"\]\[data-animate\][^{]*\{\s*animation:[^;]*\s1 both;/);
  });

  it("plays only when asked (hover of the parent in CSS, or `animate`)", () => {
    const { container, rerender } = render(<Icon name="pipeline" />);
    expect(container.querySelector("svg")?.hasAttribute("data-animate")).toBe(false);
    rerender(<Icon name="pipeline" animate />);
    expect(container.querySelector("svg")?.hasAttribute("data-animate")).toBe(true);
    rerender(<Icon name="pipeline" animate dimmed />);
    expect(container.querySelector("svg")?.hasAttribute("data-animate")).toBe(false);
    expect(container.querySelector("svg")?.hasAttribute("data-animated")).toBe(false);
  });

  it("accepts a CSS length (buttons follow their font size)", () => {
    const { container } = render(<Icon name="arrowRight" px="1em" />);
    expect(container.querySelector("svg")?.getAttribute("width")).toBe("1em");
  });

  it("works as an icon component for the maps that expect one", () => {
    const Named = iconComponent("lock");
    const { container } = render(<Named width={18} className="x" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("data-icon")).toBe("lock");
    expect(svg?.getAttribute("width")).toBe("18");
    expect(svg?.getAttribute("class")).toBe("x");
  });
});

describe("large variant", () => {
  it("sits in a decorative frosted tile, with its own accent gradient", () => {
    const { container } = render(
      <>
        <Icon name="dashboard" size="lg" px={56} testId="a" />
        <Icon name="dashboard" size="lg" />
      </>,
    );
    const tiles = container.querySelectorAll("[data-icon-tile]");
    expect(tiles).toHaveLength(2);
    expect(tiles[0]?.getAttribute("aria-hidden")).toBe("true");
    expect(tiles[0]?.getAttribute("data-testid")).toBe("a");
    expect((tiles[0] as HTMLElement).style.getPropertyValue("--icon-tile")).toBe("56px");
    expect((tiles[1] as HTMLElement).style.getPropertyValue("--icon-tile")).toBe("64px");
    const ids = Array.from(container.querySelectorAll("linearGradient")).map((gradient) => gradient.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    const svg = tiles[0]!.querySelector("svg")!;
    expect(svg.getAttribute("data-icon-size")).toBe("lg");
    expect(svg.style.getPropertyValue("--icon-paint")).toBe(`url(#${ids[0]})`);
    // `animate` belongs to the small variant: the large one plays on arrival.
    expect(svg.hasAttribute("data-animate")).toBe(false);
  });

  it("stops by itself: story once, then two breaths, under 5 s (WCAG 2.2.2)", () => {
    const rule =
      BASE_CSS.match(/svg\[data-icon-size="lg"\]\[data-animated\] \[data-part="accent"\] \{([^}]*)\}/)?.[1] ?? "";
    expect(rule).toMatch(/1 both/);
    expect(rule).toMatch(/icon-breathe var\(--duration-icon-breathe\)[^,;]* 2 forwards/);
    // Budget with the real tokens: delay (420 × 2.4) + 2 × 1800 ms.
    expect(420 * 2.4 + 2 * 1800).toBeLessThan(5000);
  });
});

describe("reduced motion", () => {
  it("removes every icon animation (the still drawing is the meaningful frame)", () => {
    const block = BASE_CSS.slice(BASE_CSS.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(block).toMatch(/svg\[data-icon\] \*/);
    expect(block).toMatch(/animation: none !important;/);
  });
});
