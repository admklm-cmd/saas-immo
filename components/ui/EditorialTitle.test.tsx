// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { EditorialTitle } from "./EditorialTitle";

afterEach(() => {
  cleanup();
});

const LINES = ["Ce n'est pas la prospection", "qui freine vos mandats.", "C'est l'administratif."];
const SENTENCE = LINES.join(" ");

function renderTitle(props: Partial<Parameters<typeof EditorialTitle>[0]> = {}) {
  return render(
    <EditorialTitle as="h2" id="t" lines={LINES} accent="administratif" size="statement" reveal="in-view" {...props} />,
  );
}

describe("EditorialTitle", () => {
  it("is named by the exact sentence, read once from a visually hidden copy", () => {
    renderTitle();
    const heading = screen.getByRole("heading", { level: 2, name: SENTENCE });
    expect(heading.id).toBe("t");
    expect(heading.querySelector(".sr-only")?.textContent).toBe(SENTENCE);
    const visual = screen.getByTestId("editorial-title-visual");
    expect(visual.getAttribute("aria-hidden")).toBe("true");
    expect(visual.textContent?.replace(/\s+/g, " ").trim()).toBe(SENTENCE);
    // A span, never an emphasis element.
    expect(heading.querySelector("em, i")).toBeNull();
  });

  it("renders one block per author line and one accented word, inline, between its article and punctuation", () => {
    renderTitle({ subtleBefore: 2 });
    const lines = screen.getByTestId("editorial-title-visual").querySelectorAll("[data-title-line]");
    expect(lines).toHaveLength(3);
    const accents = document.querySelectorAll("[data-accent]");
    expect(accents).toHaveLength(1);
    const accent = accents[0] as HTMLElement;
    expect(accent.textContent).toBe("administratif");
    expect(accent.className).toContain("title-accent");
    // Article, word and full stop never break apart.
    const group = accent.parentElement as HTMLElement;
    expect(group.className).toMatch(/nowrap/);
    expect(group.textContent).toBe("l'administratif.");
    expect(Array.from(lines).map((line) => /subtle/.test(line.className))).toEqual([true, true, false]);
  });

  it("does not accent a word found only inside another word", () => {
    render(<EditorialTitle as="h2" id="t" lines={["Maintenant"]} accent="main" size="statement" reveal="none" />);
    expect(document.querySelector("[data-accent]")).toBeNull();
  });

  it("marks the reveal mode, and turns static beyond four lines or with reveal none", () => {
    const { unmount } = renderTitle({ reveal: "load", as: "h1", size: "page" });
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.dataset.titleReveal).toBe("load");
    expect(h1.className).toContain("lg:text-page");
    expect(document.querySelector("[data-accent]")?.className).toMatch(/sharpWord/);
    unmount();

    render(<EditorialTitle as="h2" id="t" lines={["a", "b", "c", "d", "e main"]} accent="main" size="poster" reveal="load" />);
    const h2 = screen.getByRole("heading", { level: 2 });
    expect(h2.dataset.titleReveal).toBe("none");
    expect(h2.querySelector("[data-accent]")?.className).not.toMatch(/sharpWord/);
    expect(h2.querySelectorAll("[style]")).toHaveLength(0);
  });

  it("sets the title in Bricolage 600 ink, at the requested size", () => {
    renderTitle();
    const heading = screen.getByRole("heading", { level: 2 });
    for (const name of ["font-display", "font-semibold", "text-ink", "text-statement"]) {
      expect(heading.className).toContain(name);
    }
  });
});

describe("EditorialTitle.module.css", () => {
  const css = readFileSync(join(process.cwd(), "components/ui/EditorialTitle.module.css"), "utf8");

  it("keeps the final state by default: hidden states only exist when motion is welcome", () => {
    // Comments explain what is NOT done (« no overflow: hidden »): read the code only.
    const code = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const noPreference = code.indexOf("@media (prefers-reduced-motion: no-preference)");
    expect(noPreference).toBeGreaterThan(-1);
    const before = code.slice(0, noPreference);
    expect(before).not.toMatch(/opacity:\s*0/);
    expect(code).toMatch(/backwards/);
    expect(code).not.toMatch(/overflow:\s*hidden/);
  });

  it("uses the spec values and tokens", () => {
    expect(css).toMatch(/--title-focus-blur:\s*8px/);
    expect(css).toMatch(/--title-focus-duration:\s*640ms/);
    expect(css).toMatch(/--title-line-step:\s*80ms/);
    expect(css).toMatch(/--title-line-step:\s*60ms/);
    expect(css).toMatch(/--title-line-delay:\s*100ms/);
    expect(css).toMatch(/var\(--ease-emphasis\)/);
    expect(css).toMatch(/title-sharp-in var\(--duration-base\) var\(--ease-standard\)/);
    expect(css).toMatch(/min\(var\(--text-poster\),\s*1[234]cqi\)/);
  });

  it("narrows the poster only and balances the author lines", () => {
    const poster = css.slice(css.indexOf(".poster {"), css.indexOf("}", css.indexOf(".poster {")));
    expect(poster).toMatch(/font-variation-settings:\s*"wdth" 92/);
    expect(css.match(/"wdth"/g)).toHaveLength(1);
    const line = css.slice(css.indexOf(".line {"), css.indexOf("}", css.indexOf(".line {")));
    expect(line).toMatch(/text-wrap:\s*balance/);
  });

  it("stops everything under reduced motion and under the site pause", () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation:\s*none/);
    expect(css).toMatch(/data-landing-motion="paused"[\s\S]*?animation:\s*none;[\s\S]*?opacity:\s*1/);
  });
});
