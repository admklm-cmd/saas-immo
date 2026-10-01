import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

import { HERO_TITLE, LANDING_TEXTS } from "@/components/landing-texts";
import { APP_TEXTS } from "@/components/texts";

import { adminClient } from "./helpers/local-supabase";
import { fixtureUser, signIn, type FixtureUserKey } from "./helpers/sign-in";

/**
 * Expressive typography (docs/design-system.md §2.2, control criteria §2.2.10).
 *
 * Bricolage Grotesque titles at 600, one accented word in Instrument Serif
 * italic on the public site and in eight CRM empty states, mono overlines with
 * the cobalt dash, line-by-line reveal of the public titles only. Checked here:
 * families, weights, sizes, no overflow, the accented word never grows its
 * line, the final state is immediate without motion, no font request leaves
 * for Google, one h1 per page.
 *
 * Requires the local Supabase stack with the fixtures (e2e/global-setup.ts).
 */

const COLD_START = 60_000;
const WIDTHS = [1440, 1024, 390, 360] as const;
const HEIGHT = 900;
const NAV = APP_TEXTS.nav;

/** The eleven CRM screens that carry an overline (§2.2.9), with their h1. */
const OVERLINED_SCREENS = [
  { path: "/dashboard", title: APP_TEXTS.dashboard.title, overline: NAV.groupPilotage },
  { path: "/contacts", title: APP_TEXTS.contacts.title, overline: NAV.groupPilotage },
  { path: "/pipeline", title: APP_TEXTS.pipeline.title, overline: NAV.groupPilotage },
  { path: "/taches", title: APP_TEXTS.tasks.title, overline: NAV.groupPilotage },
  { path: "/rendez-vous", title: APP_TEXTS.appointments.title, overline: NAV.groupPilotage },
  { path: "/agents-ia", title: APP_TEXTS.agentsIa.title, overline: NAV.agentsOverview },
  { path: "/agents-ia/leads-entrants", title: APP_TEXTS.leadsInbox.title, overline: NAV.groupAgents },
  { path: "/agents-ia/a-valider", title: APP_TEXTS.validationQueue.title, overline: NAV.groupAgents },
  { path: "/agents-ia/relances", title: APP_TEXTS.emmaFollowUps.title, overline: NAV.groupAgents },
  { path: "/agents-ia/suivi-rendez-vous", title: APP_TEXTS.followThrough.title, overline: NAV.groupAgents },
  { path: "/parametres", title: APP_TEXTS.settings.title, overline: NAV.groupSettings },
] as const;

async function signedInContext(browser: Browser, key: FixtureUserKey): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, key);
  return { context, page };
}

/** Visits a page and waits for its single h1. */
async function open(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: COLD_START });
}

/** Document and every heading: no horizontal overflow. */
async function overflowReport(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const problems: string[] = [];
    const root = document.documentElement;
    if (root.scrollWidth > root.clientWidth + 1) problems.push(`document ${root.scrollWidth} > ${root.clientWidth}`);
    for (const heading of Array.from(document.querySelectorAll<HTMLElement>("h1, h2, [data-testid='empty-state-title']"))) {
      if (heading.offsetParent === null) continue;
      if (heading.scrollWidth > heading.clientWidth + 1) {
        problems.push(`${heading.tagName} « ${heading.textContent?.slice(0, 40)} » ${heading.scrollWidth} > ${heading.clientWidth}`);
      }
    }
    return problems;
  });
}

/** Every accented word on the page: its computed size, family, style and weight. */
async function accents(page: Page) {
  return page.locator(".title-accent").evaluateAll((nodes) =>
    nodes.map((node) => {
      const style = getComputedStyle(node);
      return {
        text: node.textContent ?? "",
        size: parseFloat(style.fontSize),
        family: style.fontFamily,
        fontStyle: style.fontStyle,
        weight: Number(style.fontWeight),
        display: style.display,
        insideEmptyState: node.closest("[data-testid='empty-state-title']") !== null,
      };
    }),
  );
}

/** Number of visual lines of each author line of every editorial title (1 = it holds on one line). */
async function authorLineCounts(page: Page) {
  return page.locator("[data-title-line]").evaluateAll((nodes) =>
    nodes.map((node) => {
      const heading = node.closest("h1, h2") as HTMLElement;
      const lineHeight = parseFloat(getComputedStyle(heading).lineHeight);
      return {
        text: node.textContent ?? "",
        lines: Math.round(node.getBoundingClientRect().height / lineHeight),
        width: Math.round(node.getBoundingClientRect().width),
        fontSize: parseFloat(getComputedStyle(heading).fontSize),
      };
    }),
  );
}

/** Height of the box holding the accent, with then without `.title-accent`. */
async function accentLineHeights(page: Page, scope: string): Promise<{ with: number; without: number }> {
  return page.evaluate((selector) => {
    const accent = document.querySelector<HTMLElement>(`${selector} .title-accent`);
    if (!accent) throw new Error(`no accent in ${selector}`);
    const box = (accent.closest("[data-title-line]") ?? accent.closest("[data-testid='empty-state-title']")) as HTMLElement;
    // One line box only: the serif is narrower than Bricolage, so letting the
    // text wrap would compare two different line breaks, not two line heights.
    const whiteSpace = box.style.whiteSpace;
    box.style.whiteSpace = "nowrap";
    const measured = box.getBoundingClientRect().height;
    accent.classList.remove("title-accent");
    const plain = box.getBoundingClientRect().height;
    accent.classList.add("title-accent");
    box.style.whiteSpace = whiteSpace;
    return { with: measured, without: plain };
  }, scope);
}

/**
 * Restarts every CSS animation under `selector`, pauses them and seeks them
 * to `ms` after their common start (delays included): a deterministic sample
 * of the accent effects (docs/design-system.md §2.11.2).
 */
async function freezeAt(page: Page, selector: string, ms: number): Promise<number> {
  return page.evaluate(
    ({ selector, ms }) => {
      const root = document.querySelector<HTMLElement>(selector) as HTMLElement;
      const nodes = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];
      nodes.forEach((node) => node.style.setProperty("animation", "none"));
      void root.offsetWidth;
      nodes.forEach((node) => {
        node.style.removeProperty("animation");
        if (node.getAttribute("style") === "") node.removeAttribute("style");
      });
      const animations = root.getAnimations({ subtree: true });
      for (const animation of animations) {
        animation.pause();
        animation.currentTime = ms;
      }
      return animations.length;
    },
    { selector, ms },
  );
}

/** Words, accent, frame and mark of one title, at this very instant. */
async function accentEffectState(page: Page, selector: string) {
  return page.evaluate((scope) => {
    const root = document.querySelector<HTMLElement>(scope) as HTMLElement;
    const accent = root.querySelector<HTMLElement>("[data-accent]") as HTMLElement;
    const frame = root.querySelector<HTMLElement>("[data-accent-frame]");
    const mark = root.querySelector<HTMLElement>("[data-accent-mark]");
    const words = Array.from(root.querySelectorAll<HTMLElement>("[data-title-line] span[style*='--line']")).filter(
      (node) => !node.hasAttribute("data-accent") && node.closest("[data-accent]") === null,
    );
    const markStyle = mark ? getComputedStyle(mark) : null;
    return {
      words: words.map((node) => getComputedStyle(node).filter),
      accentFilter: getComputedStyle(accent).filter,
      accentOpacity: getComputedStyle(accent).opacity,
      frameOpacity: frame ? getComputedStyle(frame).opacity : "absent",
      frameDisplay: frame ? getComputedStyle(frame).display : "absent",
      frameArms: frame ? getComputedStyle(frame).backgroundSize : "",
      mark: mark !== null,
      markClip: markStyle?.clipPath ?? "absent",
      markVisible: markStyle ? markStyle.display !== "none" && markStyle.opacity === "1" && (mark?.getBoundingClientRect().width ?? 0) > 0 : false,
    };
  }, selector);
}

/** Every animated piece of every editorial title, at this very instant (ornaments aside: checked above). */
async function titleStates(page: Page, scope = "") {
  return page
    .locator(`${scope} [data-testid='editorial-title-visual'] span:not([data-accent-frame]):not([data-accent-mark])`.trim())
    .evaluateAll((nodes) =>
    nodes.map((node) => {
      const style = getComputedStyle(node);
      return { text: node.textContent ?? "", opacity: style.opacity, transform: style.transform, filter: style.filter };
    }),
  );
}

function expectAllFinal(states: Awaited<ReturnType<typeof titleStates>>, label: string) {
  expect(states.length, `${label}: words found`).toBeGreaterThan(0);
  for (const state of states) {
    expect(state.opacity, `${label}: « ${state.text} » opacity`).toBe("1");
    expect(state.transform, `${label}: « ${state.text} » transform`).toBe("none");
    expect(state.filter, `${label}: « ${state.text} » filter`).toBe("none");
  }
}

test.describe("site public", () => {
  test("titres en Bricolage 600, mot accentué en Instrument Serif italique, un seul h1, aucune requête vers Google", async ({
    page,
  }) => {
    const fontRequests: string[] = [];
    page.on("request", (request) => {
      if (/fonts\.(googleapis|gstatic)\.com/.test(request.url())) fontRequests.push(request.url());
    });

    for (const path of ["/", "/estimation"]) {
      await page.setViewportSize({ width: 1440, height: HEIGHT });
      await open(page, path);
      await expect(page.locator("h1")).toHaveCount(1);

      const headings = await page.locator("h1, h2").evaluateAll((nodes) =>
        nodes
          .filter((node) => node.closest("[data-testid='editorial-title-visual']") === null)
          .map((node) => {
            const style = getComputedStyle(node);
            return { text: node.textContent?.slice(0, 40), family: style.fontFamily, weight: Number(style.fontWeight), size: parseFloat(style.fontSize) };
          }),
      );
      for (const heading of headings) {
        expect(heading.weight, `${path}: « ${heading.text} » weight`).toBeLessThan(700);
        if (heading.size > 18) expect(heading.family.split(",")[0], `${path}: « ${heading.text} »`).toMatch(/Bricolage/);
        else expect(heading.family.split(",")[0], `${path}: small « ${heading.text} »`).not.toMatch(/Bricolage/);
      }

      for (const accent of await accents(page)) {
        expect(accent.family.split(",")[0], `${path}: « ${accent.text} »`).toMatch(/Instrument Serif/);
        expect(accent.fontStyle).toBe("italic");
        expect(accent.weight).toBe(400);
        expect(accent.display).toBe("inline");
      }

      const overlines = await page.getByTestId("overline").evaluateAll((nodes) =>
        nodes.map((node) => getComputedStyle(node).fontFamily.split(",")[0]),
      );
      expect(overlines.length, `${path}: overlines`).toBeGreaterThan(0);
      for (const family of overlines) expect(family).toMatch(/Geist Mono/);
    }

    // The hero: the exact sentence, one accent; /estimation: its sentence, its overline.
    await open(page, "/");
    await expect(page.getByRole("heading", { level: 1, name: HERO_TITLE })).toBeVisible();
    await expect(page.locator("#hero-title [data-accent]")).toHaveText(LANDING_TEXTS.hero.titleAccent);
    await expect(page.getByText(LANDING_TEXTS.final.note, { exact: true })).toBeVisible();
    await open(page, "/estimation");
    await expect(page.getByRole("heading", { level: 1, name: APP_TEXTS.estimation.title })).toBeVisible();
    await expect(page.getByText(APP_TEXTS.estimation.subtitle)).toBeVisible();
    await expect(page.getByTestId("overline")).toHaveText(APP_TEXTS.estimation.eyebrow);

    expect(fontRequests).toEqual([]);
  });

  test("aucun débordement, chaque ligne d'auteur tient sur une ligne (1440 / 1024), mot accentué ≥ 28 px", async ({ page }) => {
    test.setTimeout(180_000);
    for (const path of ["/", "/estimation"]) {
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: HEIGHT });
        await open(page, path);
        expect(await overflowReport(page), `${path} @ ${width}`).toEqual([]);
        for (const accent of await accents(page)) {
          expect(accent.size, `${path} @ ${width}: « ${accent.text} »`).toBeGreaterThanOrEqual(28);
        }
        if (width >= 1024) {
          for (const line of await authorLineCounts(page)) {
            expect(line.lines, `${path} @ ${width}: « ${line.text} » (${line.width} px wide, ${line.fontSize} px)`).toBe(1);
          }
        }
      }
    }
  });

  test("le mot accentué ne grandit pas sa ligne (écart ≤ 0,5 px)", async ({ page }) => {
    for (const width of [1440, 1024, 390]) {
      await page.setViewportSize({ width, height: HEIGHT });
      await open(page, "/");
      const heights = await accentLineHeights(page, "#hero-title");
      expect(Math.abs(heights.with - heights.without), `hero @ ${width}: ${heights.with} vs ${heights.without}`).toBeLessThanOrEqual(0.5);
    }
  });

  test("mouvement réduit : chaque mot est net, opaque et immobile dès l'instant 0", async ({ page }) => {
    for (const path of ["/", "/estimation"]) {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      expectAllFinal(await titleStates(page), `${path} (reduced motion)`);
    }
  });

  test("mouvement réduit et JavaScript désactivé : état final dès l'instant 0", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, reducedMotion: "reduce" });
    const page = await context.newPage();
    for (const path of ["/", "/estimation"]) {
      await page.goto(path, { waitUntil: "domcontentloaded", timeout: COLD_START });
      expectAllFinal(await titleStates(page), `${path} (no JavaScript)`);
    }
    await context.close();
  });

  test.describe("avec mouvement", () => {
    test.use({ reducedMotion: "no-preference" });

    test("JavaScript désactivé : les titres de section sont en état final, le hero se pose en moins d'une seconde", async ({
      browser,
    }) => {
      const context = await browser.newContext({ javaScriptEnabled: false, reducedMotion: "no-preference" });
      const page = await context.newPage();
      await page.goto("/", { waitUntil: "domcontentloaded", timeout: COLD_START });
      // Sections: their Reveal never leaves « visible » without JavaScript.
      const sections = await page
        .locator("h2 [data-testid='editorial-title-visual'] span:not([data-accent-frame]):not([data-accent-mark])")
        .evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).opacity));
      expect(sections.length).toBeGreaterThan(0);
      expect(sections.every((opacity) => opacity === "1")).toBe(true);
      // Hero: CSS-only reveal on load, nothing left after the last line (980 ms).
      await page.waitForTimeout(1_200);
      expectAllFinal(await titleStates(page), "/ (no JavaScript, after the reveal)");
      await context.close();
    });

    test("rythme du hero : mot accentué net en premier, lignes décalées de 80 ms, puis plus aucun flou", async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: HEIGHT });
      await open(page, "/");
      const timing = await page.evaluate(() => {
        const title = document.getElementById("hero-title") as HTMLElement;
        const accent = title.querySelector<HTMLElement>("[data-accent]") as HTMLElement;
        const lines = Array.from(title.querySelectorAll<HTMLElement>("[data-title-line]"));
        // The first animated word of a line carries its line index (--line).
        const firstWord = (line: HTMLElement) => line.querySelector<HTMLElement>("span[style]") as HTMLElement;
        return {
          accent: { delay: getComputedStyle(accent).animationDelay, duration: getComputedStyle(accent).animationDuration, name: getComputedStyle(accent).animationName },
          lines: lines.map((line) => getComputedStyle(firstWord(line)).animationDelay),
          word: getComputedStyle(firstWord(lines[0] as HTMLElement)).animationDuration,
        };
      });
      expect(timing.accent).toEqual({ delay: "0.1s", duration: "0.22s", name: expect.stringContaining("title-sharp-in") });
      expect(timing.lines).toEqual(["0.1s", "0.18s", "0.26s", "0.34s"]);
      expect(timing.word).toBe("0.64s");
      // 100 + 3 × 80 + 640 = 980 ms: after that, nothing is left.
      await page.waitForTimeout(1_100);
      expectAllFinal(await titleStates(page, "#hero-title"), "hero after 1.1 s");
      // The actions of the hero are clickable at once.
      await expect(page.getByRole("link", { name: LANDING_TEXTS.actions.estimation }).first()).toBeEnabled();
    });

    test("effet « trait » du hero : masqué à 0,4 s, en cours à 1,0 s, complet à 1,6 s (§2.11.2 A)", async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: HEIGHT });
      await open(page, "/");
      await expect(page.locator("#hero-title")).toHaveAttribute("data-accent-effect", "underline");
      const at = async (ms: number) => {
        await freezeAt(page, "#hero-title", ms);
        return accentEffectState(page, "#hero-title");
      };
      expect((await at(400)).markClip).toMatch(/^inset\(0px 100%/);
      const middle = (await at(1_000)).markClip;
      const share = Number(/^inset\(0px ([\d.]+)%/.exec(middle)?.[1]);
      expect(share, middle).toBeGreaterThan(0);
      expect(share, middle).toBeLessThan(100);
      // 760 + 640 = 1 400 ms: complete, nothing left.
      for (const ms of [1_450, 1_600]) {
        const state = await at(ms);
        expect(state.markClip, `${ms} ms`).toBe("none");
        expect(state.markVisible).toBe(true);
      }
      expect((await at(1_600)).words.every((filter) => filter === "none")).toBe(true);
    });

    for (const width of [1440, 390] as const) {
      test(`mise au point « problème » et « finale » : flou tenu puis tout net (${width} px, §2.11.2 B et C)`, async ({ page }) => {
        await page.setViewportSize({ width, height: HEIGHT });
        await open(page, "/");
        const blur = width < 640 ? "blur(3px)" : "blur(5px)";
        const arm = width >= 1024 ? "16px 3px" : "12px 2px";
        for (const [selector, effect] of [
          ["#problem-title", "focus"],
          ["#final-title", "focus-underline"],
        ] as const) {
          const title = page.locator(selector);
          await expect(title).toHaveAttribute("data-accent-effect", effect);
          await title.scrollIntoViewIfNeeded();
          await expect(page.locator(`.reveal[data-reveal='entering'] ${selector}`)).toHaveCount(1);

          await freezeAt(page, selector, 800);
          const during = await accentEffectState(page, selector);
          expect(during.words.length, selector).toBeGreaterThan(0);
          for (const filter of during.words) expect(filter, `${selector} word at 0.8 s`).toBe(blur);
          expect(during.accentFilter, `${selector} accent at 0.8 s`).toBe("none");
          expect(during.accentOpacity).toBe("1");
          expect(during.frameOpacity, `${selector} frame at 0.8 s`).toBe("1");
          expect(during.frameArms.startsWith(arm), during.frameArms).toBe(true);
          if (effect === "focus-underline") expect(during.markClip).toMatch(/^inset\(0px 100%/);

          await freezeAt(page, selector, 2_600);
          const after = await accentEffectState(page, selector);
          for (const filter of after.words) expect(filter, `${selector} word at 2.6 s`).toBe("none");
          expect(after.frameOpacity, `${selector} frame at 2.6 s`).toBe("0");
          if (effect === "focus-underline") {
            expect(after.markClip).toBe("none");
            expect(after.markVisible).toBe(true);
          } else {
            expect(after.mark).toBe(false);
          }
        }
      });
    }
  });

  test("effets du mot accentué, mouvement réduit : état final à l'instant 0 (trait présent, aucun cadre, aucun flou)", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: COLD_START });
    await expect(page.getByRole("heading", { level: 1, name: HERO_TITLE })).toBeVisible({ timeout: COLD_START });
    for (const [selector, mark] of [
      ["#hero-title", true],
      ["#problem-title", false],
      ["#final-title", true],
    ] as const) {
      const state = await accentEffectState(page, selector);
      expect(state.mark, selector).toBe(mark);
      if (mark) {
        expect(state.markClip, selector).toBe("none");
        expect(state.markVisible, selector).toBe(true);
      }
      expect(state.frameDisplay, selector).not.toBe("block");
      for (const filter of state.words) expect(filter, selector).toBe("none");
    }
    // /estimation keeps its title without effect.
    await open(page, "/estimation");
    await expect(page.locator("h1")).not.toHaveAttribute("data-accent-effect");
    await expect(page.locator("[data-accent-frame], [data-accent-mark]")).toHaveCount(0);
  });

  test("les ornements ne changent pas la hauteur de ligne (écart ≤ 0,5 px, 1440 et 390)", async ({ page }) => {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: HEIGHT });
      await open(page, "/");
      for (const selector of ["#hero-title", "#problem-title", "#final-title"]) {
        const heights = await page.evaluate((scope) => {
          const accent = document.querySelector<HTMLElement>(`${scope} [data-accent]`) as HTMLElement;
          const line = accent.closest("[data-title-line]") as HTMLElement;
          const ornaments = Array.from(accent.querySelectorAll<HTMLElement>("[data-accent-frame], [data-accent-mark]"));
          const measured = line.getBoundingClientRect().height;
          ornaments.forEach((node) => (node.style.display = "none"));
          const plain = line.getBoundingClientRect().height;
          ornaments.forEach((node) => (node.style.display = ""));
          return { with: measured, without: plain, count: ornaments.length };
        }, selector);
        expect(heights.count, selector).toBeGreaterThan(0);
        expect(Math.abs(heights.with - heights.without), `${selector} @ ${width}`).toBeLessThanOrEqual(0.5);
      }
    }
  });
});

test.describe("espace connecté", () => {
  test.describe.configure({ mode: "serial" });

  test("sur-titre exact sur les onze écrans, h1 Bricolage 600 à 48 px dès 1024, aucun titre ≥ 700, italique seulement dans les états vides", async ({
    browser,
  }) => {
    test.setTimeout(240_000);
    const { context, page } = await signedInContext(browser, "agentA");
    await page.setViewportSize({ width: 1440, height: HEIGHT });

    for (const screen of OVERLINED_SCREENS) {
      await open(page, screen.path);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.getByRole("heading", { level: 1, name: screen.title })).toBeVisible();
      const overline = page.getByTestId("overline");
      await expect(overline, screen.path).toHaveCount(1);
      await expect(overline).toHaveText(screen.overline);
      expect(await overline.evaluate((node) => getComputedStyle(node).textTransform)).toBe("uppercase");

      const h1 = await page.locator("h1").evaluate((node) => {
        const style = getComputedStyle(node);
        return { family: style.fontFamily.split(",")[0], weight: Number(style.fontWeight), size: parseFloat(style.fontSize) };
      });
      expect(h1, screen.path).toEqual({ family: expect.stringMatching(/Bricolage/), weight: 600, size: 48 });

      const headings = await page.locator("h1, h2, h3, h4").evaluateAll((nodes) =>
        // Visually hidden headings (sr-only) are never painted.
        nodes.filter((node) => !node.classList.contains("sr-only")).map((node) => {
          const style = getComputedStyle(node);
          return { text: node.textContent?.slice(0, 40), family: style.fontFamily.split(",")[0], weight: Number(style.fontWeight), size: parseFloat(style.fontSize) };
        }),
      );
      for (const heading of headings) {
        expect(heading.weight, `${screen.path}: « ${heading.text} » weight`).toBeLessThan(700);
        if (heading.size <= 18) expect(heading.family, `${screen.path}: small « ${heading.text} »`).not.toMatch(/Bricolage/);
      }

      for (const accent of await accents(page)) {
        expect(accent.insideEmptyState, `${screen.path}: « ${accent.text} » outside an empty state`).toBe(true);
      }
    }

    // No overline where a breadcrumb plays that role.
    await open(page, "/contacts");
    const record = await page.getByTestId("contacts-table").getByRole("link").first().getAttribute("href");
    await open(page, record!);
    await expect(page.getByTestId("overline")).toHaveCount(0);

    // h1 at 42 px from 640 to 1023, 32 px below.
    for (const [width, size] of [[800, 42], [390, 32]] as const) {
      await page.setViewportSize({ width, height: HEIGHT });
      await open(page, "/dashboard");
      expect(await page.locator("h1").evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBe(size);
    }
    await context.close();
  });

  test("aucun débordement sur le tableau de bord, les contacts et la file à valider (1440 / 1024 / 390 / 360)", async ({
    browser,
  }) => {
    test.setTimeout(240_000);
    const fontRequests: string[] = [];
    const { context, page } = await signedInContext(browser, "agentA");
    page.on("request", (request) => {
      if (/fonts\.(googleapis|gstatic)\.com/.test(request.url())) fontRequests.push(request.url());
    });
    for (const path of ["/dashboard", "/contacts", "/agents-ia/a-valider"]) {
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: HEIGHT });
        await open(page, path);
        expect(await overflowReport(page), `${path} @ ${width}`).toEqual([]);
      }
    }
    expect(fontRequests).toEqual([]);
    await context.close();
  });

  test.describe("file à valider vide", () => {
    let pendingRows: Record<string, unknown>[] = [];

    test.beforeAll(async () => {
      // Agency B's pending drafts are set aside (a pending row has no reference
      // pointing to it) and put back identical afterwards, ids included.
      const agencyB = (await fixtureUser("userB")).agencyId;
      const admin = adminClient();
      const pending = await admin
        .from("outbound_messages")
        .select("*")
        .eq("agency_id", agencyB)
        .eq("status", "pending_validation");
      if (pending.error) throw new Error(pending.error.message);
      pendingRows = pending.data;
      if (pendingRows.length > 0) {
        const ids = pendingRows.map((row) => row.id as string);
        const { error } = await admin.from("outbound_messages").delete().in("id", ids);
        if (error) throw new Error(error.message);
      }
    });

    test.afterAll(async () => {
      if (pendingRows.length === 0) return;
      const { error } = await adminClient().from("outbound_messages").insert(pendingRows as never);
      if (error) throw new Error(error.message);
    });

    test("« Aucun message en attente » : mot italique ≥ 28 px, aucun débordement (1440 / 1024 / 390 / 360)", async ({
      browser,
    }) => {
      test.setTimeout(180_000);
      const { context, page } = await signedInContext(browser, "userB");
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: HEIGHT });
        await open(page, "/agents-ia/a-valider");
        const title = page.getByTestId("empty-state-title").filter({ hasText: APP_TEXTS.validationQueue.emptyTitle });
        await expect(title).toBeVisible();
        await expect(title.locator(".title-accent")).toHaveText(APP_TEXTS.validationQueue.emptyTitleAccent);
        expect(await overflowReport(page), `/agents-ia/a-valider (vide) @ ${width}`).toEqual([]);
        for (const accent of await accents(page)) {
          expect(accent.size, `accent @ ${width}`).toBeGreaterThanOrEqual(28);
        }
      }
      await context.close();
    });
  });

  test.describe("état vide des tâches", () => {
    let agencyB = "";
    let closedTaskIds: string[] = [];

    test.beforeAll(async () => {
      // Agency B has a single open task: set it aside for the empty state, put it
      // back afterwards (« cancelled » carries no closure stamp, so it is reversible).
      agencyB = (await fixtureUser("userB")).agencyId;
      const admin = adminClient();
      const open = await admin.from("tasks").select("id").eq("agency_id", agencyB).eq("status", "open");
      if (open.error) throw new Error(open.error.message);
      closedTaskIds = open.data.map((task) => task.id);
      if (closedTaskIds.length > 0) {
        const { error } = await admin.from("tasks").update({ status: "cancelled" }).in("id", closedTaskIds);
        if (error) throw new Error(error.message);
      }
    });

    test.afterAll(async () => {
      if (closedTaskIds.length === 0) return;
      const { error } = await adminClient().from("tasks").update({ status: "open" }).in("id", closedTaskIds);
      if (error) throw new Error(error.message);
    });

    test("« Aucune tâche ouverte » : mot italique ≥ 28 px, même hauteur de ligne, aucun débordement", async ({ browser }) => {
      test.setTimeout(180_000);
      const { context, page } = await signedInContext(browser, "userB");
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: HEIGHT });
        await open(page, "/taches");
        const title = page.getByTestId("empty-state-title");
        await expect(title).toHaveText(APP_TEXTS.tasks.emptyTitles.all);
        await expect(title.locator(".title-accent")).toHaveText(APP_TEXTS.tasks.emptyTitleAccent.all);
        expect(await overflowReport(page), `/taches (vide) @ ${width}`).toEqual([]);
        const [accent] = await accents(page);
        expect(accent?.size, `accent @ ${width}`).toBeGreaterThanOrEqual(28);
        expect(accent?.family.split(",")[0]).toMatch(/Instrument Serif/);
        expect(await title.evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBe(28);
        if (width === 1440 || width === 390) {
          const heights = await accentLineHeights(page, "[data-testid='empty-state-title']");
          expect(Math.abs(heights.with - heights.without), `empty state @ ${width}: ${heights.with} vs ${heights.without}`).toBeLessThanOrEqual(0.5);
        }
      }
      await context.close();
    });
  });
});
