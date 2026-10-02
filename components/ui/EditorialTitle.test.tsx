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
    // Hook of the local 75 % veil of the problem title (docs/design-system.md §2.11.4).
    expect(Array.from(lines).map((line) => line.getAttribute("data-title-tone"))).toEqual(["subtle", "subtle", null]);
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

  it("stops everything under reduced motion; the site pause is gone (docs §2.11.6)", () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation:\s*none/);
    expect(css).not.toMatch(/data-landing-motion/);
  });

  it("never loops nor glows, and holds the accent effects to their spec values (§2.11.2)", () => {
    const code = css.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(code).not.toMatch(/infinite/);
    expect(code).not.toMatch(/drop-shadow|box-shadow|text-shadow/);
    expect(code).toMatch(/--focus-rest-blur:\s*5px/);
    expect(code).toMatch(/--focus-rest-blur:\s*3px/);
    expect(code).toMatch(/--focus-frame-arm:\s*16px/);
    expect(code).toMatch(/--focus-frame-arm:\s*12px/);
    expect(code).toMatch(/--focus-frame-width:\s*3px/);
    expect(code).toMatch(/--focus-frame-width:\s*2px/);
    expect(code).toMatch(/--focus-frame-from:\s*1\.28/);
    expect(code).toMatch(/--mark-draw:\s*640ms/);
    expect(code).toMatch(/var\(--ease-draw\) 760ms/);
    expect(code).toMatch(/var\(--ease-draw\) 1560ms/);
    // The frame is never shown without motion: hidden by default, only `display: block` when welcome.
    const frame = code.slice(code.indexOf(".frame {"), code.indexOf("}", code.indexOf(".frame {")));
    expect(frame).toMatch(/display:\s*none/);
  });
});

describe("EditorialTitle accentEffect (docs/design-system.md §2.11.2)", () => {
  const ornaments = () => ({
    frames: document.querySelectorAll("[data-accent-frame]"),
    marks: document.querySelectorAll("[data-accent-mark]"),
  });

  it("renders no ornament by default (CRM, /estimation unchanged)", () => {
    renderTitle();
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading.hasAttribute("data-accent-effect")).toBe(false);
    expect(ornaments().frames).toHaveLength(0);
    expect(ornaments().marks).toHaveLength(0);
    expect(document.querySelector("[data-accent]")?.getAttribute("style")).toBeNull();
  });

  it.each([
    ["underline", 0, 1],
    ["focus", 1, 0],
    ["focus-underline", 1, 1],
  ] as const)("%s renders %i frame and %i mark, empty, inside the hidden visual", (effect, frameCount, markCount) => {
    renderTitle({ accentEffect: effect });
    const heading = screen.getByRole("heading", { level: 2, name: SENTENCE });
    expect(heading.getAttribute("data-accent-effect")).toBe(effect);
    const { frames, marks } = ornaments();
    expect(frames).toHaveLength(frameCount);
    expect(marks).toHaveLength(markCount);
    const visual = screen.getByTestId("editorial-title-visual");
    for (const node of [...frames, ...marks]) {
      expect(node.textContent).toBe("");
      expect(node.closest("[aria-hidden='true']")).toBe(visual);
      expect(node.parentElement?.hasAttribute("data-accent")).toBe(true);
    }
    // No text added: the visual still reads the sentence, the name is unchanged.
    expect(visual.textContent?.replace(/\s+/g, " ").trim()).toBe(SENTENCE);
    expect(heading.querySelector(".sr-only")?.textContent).toBe(SENTENCE);
  });

  it("centres the frame on the ink of an italic « f » ending", () => {
    renderTitle({ accentEffect: "focus" });
    const accent = document.querySelector<HTMLElement>("[data-accent]");
    expect(accent?.style.getPropertyValue("--accent-overhang")).toBe("0.15em");
  });

  it("drops the effect when there is no accented word", () => {
    render(<EditorialTitle as="h2" id="t" lines={["Sans mot"]} accent="absent" size="statement" reveal="in-view" accentEffect="focus" />);
    expect(screen.getByRole("heading", { level: 2 }).hasAttribute("data-accent-effect")).toBe(false);
    expect(ornaments().frames).toHaveLength(0);
  });
});

describe("EditorialTitle accentReplay (docs/design-system.md §2.11.2 D)", () => {
  it.each(["underline", "focus", "focus-underline"] as const)("marks a %s title replayable only on request", (effect) => {
    renderTitle({ accentEffect: effect, accentReplay: true });
    const heading = screen.getByRole("heading", { level: 2, name: SENTENCE });
    expect(heading.getAttribute("data-accent-replayable")).toBe("");
    // Rendered at rest: the controller sets these, never the server.
    expect(heading.hasAttribute("data-accent-played")).toBe(false);
    expect(heading.hasAttribute("data-accent-replay")).toBe(false);
    cleanup();
    renderTitle({ accentEffect: effect });
    expect(screen.getByRole("heading", { level: 2 }).hasAttribute("data-accent-replayable")).toBe(false);
  });

  it("is never replayable without an effect (CRM, /estimation) nor without an accented word", () => {
    renderTitle({ accentReplay: true });
    expect(screen.getByRole("heading", { level: 2 }).hasAttribute("data-accent-replayable")).toBe(false);
    cleanup();
    render(
      <EditorialTitle as="h2" id="t" lines={["Sans mot"]} accent="absent" size="statement" reveal="in-view" accentEffect="focus" accentReplay />,
    );
    expect(screen.getByRole("heading", { level: 2 }).hasAttribute("data-accent-replayable")).toBe(false);
  });

  it("does not change the accessible name nor add any text", () => {
    renderTitle({ accentEffect: "focus-underline", accentReplay: true });
    const visual = screen.getByTestId("editorial-title-visual");
    expect(visual.textContent?.replace(/\s+/g, " ").trim()).toBe(SENTENCE);
    expect(screen.getByRole("heading", { level: 2, name: SENTENCE }).getAttribute("tabindex")).toBeNull();
  });
});

describe("EditorialTitle accentEffect tech (docs/design-system.md §2.11.8.2)", () => {
  const CONTROL = ["L'IA prépare.", "Votre équipe décide."];
  const CONTROL_SENTENCE = CONTROL.join(" ");
  const renderTech = (props: Partial<Parameters<typeof EditorialTitle>[0]> = {}) =>
    render(<EditorialTitle as="h2" id="control-title" lines={CONTROL} accent="décide" size="statement" reveal="in-view" accentEffect="tech" {...props} />);

  it("splits the accented word into one span per letter, with no frame nor mark", () => {
    renderTech({ accentReplay: true });
    const heading = screen.getByRole("heading", { level: 2, name: CONTROL_SENTENCE });
    expect(heading.getAttribute("data-accent-effect")).toBe("tech");
    expect(heading.getAttribute("data-tech-state")).toBe("idle");
    // Replayable, but by its own island: the CSS replay classes are not set.
    expect(heading.getAttribute("data-accent-replayable")).toBe("");
    const accent = heading.querySelector<HTMLElement>("[data-accent]")!;
    expect(accent.textContent).toBe("décide");
    expect(accent.className).toContain("title-accent");
    expect(accent.className).not.toMatch(/accentHost/);
    const letters = Array.from(accent.querySelectorAll("[data-letter]")).map((node) => node.textContent);
    expect(letters).toEqual(["d", "é", "c", "i", "d", "e"]);
    expect(document.querySelectorAll("[data-accent-frame], [data-accent-mark]")).toHaveLength(0);
    // The word still reads the sentence; nothing is focusable; jsdom: no motion → no canvas yet on first render.
    const visual = screen.getByTestId("editorial-title-visual");
    expect(visual.textContent?.replace(/\s+/g, " ").trim()).toBe(CONTROL_SENTENCE);
    expect(heading.querySelector(".sr-only")?.textContent).toBe(CONTROL_SENTENCE);
    expect(heading.querySelector("[tabindex]")).toBeNull();
  });

  it("sets no tech attribute on any other effect", () => {
    renderTitle({ accentEffect: "focus", accentReplay: true });
    expect(screen.getByRole("heading", { level: 2 }).hasAttribute("data-tech-state")).toBe(false);
    expect(document.querySelectorAll("[data-letter]")).toHaveLength(0);
  });

  it("styles the letters as inline blocks without kerning, hidden only while the canvas paints", () => {
    const styles = readFileSync(join(process.cwd(), "components/ui/tech-accent/TechAccent.module.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(styles).toMatch(/\.letter\s*\{[^}]*display:\s*inline-block;[^}]*font-kerning:\s*none;/);
    expect(styles).toMatch(/\.word\[data-painting\] \.letter\s*\{\s*visibility:\s*hidden;/);
    expect(styles).toMatch(/top:\s*-32px;[\s\S]*left:\s*-32px;[\s\S]*width:\s*calc\(100% \+ 64px\);[\s\S]*height:\s*calc\(100% \+ 76px\);/);
    expect(styles).toMatch(/pointer-events:\s*none/);
  });
});

describe("EditorialTitle tone and align (Lot 2, docs/design-system.md §2.11.8.5)", () => {
  it("renders exactly as before when tone and align are absent", () => {
    const { container: before } = renderTitle({ accentEffect: "focus", accentReplay: true, subtleBefore: 2 });
    const html = before.innerHTML;
    cleanup();
    const { container: after } = renderTitle({ accentEffect: "focus", accentReplay: true, subtleBefore: 2, tone: "ink", align: "start" });
    expect(after.innerHTML).toBe(html);
    const heading = after.querySelector("h2")!;
    expect(heading.className).toMatch(/text-ink(\s|$)/);
    expect(heading.className).not.toMatch(/text-center/);
    expect(heading.hasAttribute("data-title-color")).toBe(false);
    expect(heading.hasAttribute("data-title-align")).toBe(false);
  });

  it("inverse: every word in the inverse ink; center: each line centred", () => {
    renderTitle({ tone: "inverse", align: "center", subtleBefore: 2 });
    const heading = screen.getByRole("heading", { level: 2, name: SENTENCE });
    expect(heading.getAttribute("data-title-color")).toBe("inverse");
    expect(heading.getAttribute("data-title-align")).toBe("center");
    expect(heading.className).toMatch(/inverse/);
    expect(heading.className).not.toMatch(/(^|\s)text-ink(\s|$)/);
    expect(heading.className).toMatch(/text-center/);
    const css = readFileSync(join(process.cwd(), "components/ui/EditorialTitle.module.css"), "utf8");
    expect(css).toMatch(/\.inverse,\s*\.inverse \.subtle,\s*\.inverse :global\(\.title-accent\)\s*\{\s*color:\s*var\(--color-ink-inverse\);/);
  });
});

describe("EditorialTitleReplay.module.css (specificity contract, §2.11.2 D)", () => {
  const strip = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "");
  const base = strip(readFileSync(join(process.cwd(), "components/ui/EditorialTitle.module.css"), "utf8"));
  const replay = strip(readFileSync(join(process.cwd(), "components/ui/EditorialTitleReplay.module.css"), "utf8"));

  it("keeps every entry rule under :where() so « played » and « replay » win without !important", () => {
    expect(base + replay).not.toMatch(/!important/);
    // Every rule that declares an entry animation starts with :where(…).
    for (const match of base.matchAll(/([^{}]+)\{[^{}]*animation:\s*(?!none)[a-z]/g)) {
      expect(match[1]!.trim()).toMatch(/^:where\(/);
    }
    expect(replay).toMatch(/\[data-accent-replayable\]\[data-accent-played\] :is\(/);
  });

  it("replays only when motion is welcome, never loops, and holds the spec durations", () => {
    const welcome = replay.slice(replay.indexOf("@media (prefers-reduced-motion: no-preference)"));
    expect(welcome).toMatch(/replay-words 1400ms/);
    expect(welcome).toMatch(/replay-frame-focus 1180ms/);
    expect(welcome).toMatch(/replay-frame-focus-underline 1040ms/);
    expect(welcome).toMatch(/replay-mark-underline 960ms/);
    expect(welcome).toMatch(/replay-mark-focus-underline 1400ms/);
    const outside = replay.slice(0, replay.indexOf("@media"));
    expect(outside).not.toMatch(/replay-/);
    expect(replay).not.toMatch(/infinite|drop-shadow|box-shadow|cursor/);
  });
});
