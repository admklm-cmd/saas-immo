// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LANDING_TEXTS } from "@/components/landing-texts";

import { HeroMotionContext } from "./hero-motion-context";
import { HeroTerminal } from "./HeroTerminal";

const TERMINAL = LANDING_TEXTS.hero.terminal;

/** The visible text of each line, as typed in the end. */
const EXPECTED_LINES = TERMINAL.lines.map((line) => (line.kind === "comment" ? line.text : `${line.from}${TERMINAL.arrow}${line.to}${line.content}`));

function mockMotion(reduced: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("reduce") ? reduced : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  cleanup();
});

describe("HeroTerminal, server HTML (docs/design-system.md §2.11.4 bis E)", () => {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(<HeroTerminal />);
  const figure = container.querySelector<HTMLElement>("figure")!;

  it("holds the eight lines in full, the final text (C10)", () => {
    const lines = Array.from(figure.querySelectorAll("[aria-hidden='true'] > div")).map((line) => line.textContent);
    expect(lines).toEqual(EXPECTED_LINES);
    expect(figure.getAttribute("data-terminal-state")).toBe("static");
    // Every typed character carries its own instant: the typing needs no JavaScript.
    expect(figure.querySelectorAll("[style*='--i']").length).toBeGreaterThan(150);
  });

  it("is a figure named by its hidden title; the visible lines are hidden, a static list is read once (C11, C12)", () => {
    expect(figure.getAttribute("aria-labelledby")).toBe("hero-terminal-title");
    expect(figure.querySelector("#hero-terminal-title")?.textContent).toBe(TERMINAL.title);
    expect(figure.querySelector("[aria-hidden='true']")?.textContent).toContain("fiche créée");
    const list = figure.querySelector("ol.sr-only")!;
    expect(Array.from(list.querySelectorAll("li")).map((item) => item.textContent)).toEqual([...TERMINAL.srLines]);
    expect(TERMINAL.srLines).toHaveLength(7);
    // « fiche créée » is read once: only the hidden lines and the list hold it, and the lines are aria-hidden.
    const readable = figure.cloneNode(true) as HTMLElement;
    readable.querySelectorAll("[aria-hidden='true']").forEach((node) => node.remove());
    expect(readable.textContent?.match(/fiche créée/g)).toHaveLength(1);
    expect(figure.querySelector("[aria-live]")).toBeNull();
  });

  it("renders no pause button before hydration, and marks the simulation on line 0", () => {
    expect(figure.querySelector("button")).toBeNull();
    expect(EXPECTED_LINES[0]).toBe("# exemple fictif — simulation");
    expect(EXPECTED_LINES.at(-1)).toBe("# les agents préparent. vous décidez.");
  });

  it("keeps every string of the terminal in LANDING_TEXTS, none in the component (C11)", () => {
    const source = readFileSync(join(process.cwd(), "components/landing/hero/HeroTerminal.tsx"), "utf8");
    const strings: string[] = [TERMINAL.title, ...TERMINAL.srLines, TERMINAL.pause.pauseName, TERMINAL.pause.resumeName];
    for (const line of TERMINAL.lines) strings.push(line.kind === "comment" ? line.text : line.content);
    for (const text of strings) expect(source, text).not.toContain(text);
    expect(source).not.toMatch(/"(léa|hugo|emma|louis|sarah)"/);
  });
});

describe("HeroTerminal, after hydration", () => {
  it("offers the pause button: it finishes the text and stops the motion, then offers to resume (C16)", async () => {
    mockMotion(false);
    const setStopped = vi.fn();
    const { rerender } = render(
      <HeroMotionContext value={{ stopped: false, setStopped }}>
        <HeroTerminal />
      </HeroMotionContext>,
    );
    const pause = screen.getByRole("button", { name: TERMINAL.pause.pauseName });
    expect(pause.textContent?.replace(/ /g, " ")).toBe("[ pause ]");
    fireEvent.click(pause);
    expect(setStopped).toHaveBeenCalledWith(true);
    await act(async () => {});
    expect(screen.getByTestId("hero-terminal").getAttribute("data-terminal-state")).toBe("done");
    rerender(
      <HeroMotionContext value={{ stopped: true, setStopped }}>
        <HeroTerminal />
      </HeroMotionContext>,
    );
    const resume = screen.getByRole("button", { name: TERMINAL.pause.resumeName });
    expect(resume.textContent).toContain(TERMINAL.pause.resume);
    fireEvent.click(resume);
    expect(setStopped).toHaveBeenLastCalledWith(false);
  });

  it("under reduced motion: complete at once, state « reduced », no pause button (C17)", () => {
    mockMotion(true);
    render(<HeroTerminal />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByTestId("hero-terminal").getAttribute("data-terminal-state")).toBe("reduced");
  });
});
