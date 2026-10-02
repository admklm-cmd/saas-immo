import { expect, test, type Page } from "@playwright/test";

import { HERO_TITLE, LANDING_TEXTS } from "@/components/landing-texts";

import { centerSection, instrumentPage, rafCalls } from "./helpers/landing-network";

/**
 * Block A of the hero — « Vous » in the ecosystem of the agents
 * (docs/design-system.md §2.11.8.3, criteria A1–A5 of §2.11.8.6). The only
 * loop of the landing: paused off screen and in a hidden tab, still on its
 * final state under reduced motion and without JavaScript. A human box is only
 * ever checked by the « Vous » cursor, once it has arrived on it.
 *
 * No form on this journey: no consent checkbox to check.
 */

const COLD_START = 60_000;
const JOURNEY = LANDING_TEXTS.journey;
const FIGURE = "[data-testid='hero-ecosystem']";

async function openHome(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: HERO_TITLE })).toBeVisible({ timeout: COLD_START });
}

async function boxes(page: Page) {
  return page.locator(`${FIGURE} [data-check]`).evaluateAll((nodes) =>
    nodes.map((node) => ({ key: node.getAttribute("data-case"), by: node.getAttribute("data-check"), checked: node.getAttribute("data-checked") === "true" })),
  );
}

/** Geometry of the row: card boxes, distinct columns, document overflow, converging lines. */
async function layout(page: Page) {
  return page.evaluate((selector) => {
    const figure = document.querySelector<HTMLElement>(selector)!;
    const cards = Array.from(figure.querySelectorAll<HTMLElement>("[data-card]")).map((card) => card.getBoundingClientRect());
    const track = figure.querySelector<HTMLElement>("[data-testid='ecosystem-track']")!;
    return {
      top: Math.min(...cards.map((card) => card.top)) + window.scrollY,
      left: Math.min(...cards.map((card) => card.left)),
      right: Math.max(...cards.map((card) => card.right)),
      columns: new Set(cards.map((card) => Math.round(card.left))).size,
      widths: [...new Set(cards.map((card) => Math.round(card.width)))],
      lines: figure.querySelectorAll("[data-testid='ecosystem-lines'] path").length,
      linesShown: (() => {
        const svg = figure.querySelector<SVGElement>("[data-testid='ecosystem-lines']");
        return svg ? getComputedStyle(svg).display !== "none" : false;
      })(),
      scrolls: track.scrollWidth > track.clientWidth + 1,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      dots: Array.from(figure.querySelectorAll<HTMLElement>("button")).filter((button) => button.offsetParent !== null).length,
    };
  }, FIGURE);
}

function expectFinal(all: Awaited<ReturnType<typeof boxes>>) {
  const agents = all.filter((box) => box.by === "agent");
  expect(agents).toHaveLength(12);
  expect(agents.every((box) => box.checked)).toBe(true);
  expect(all.filter((box) => box.by === "missing")).toEqual([{ key: "1:2", by: "missing", checked: false }]);
  expect(all.filter((box) => box.by === "you").map((box) => box.checked)).toEqual([true, true, true]);
}

test.describe("bloc A : composition (A1)", () => {
  for (const viewport of [
    { width: 1440, height: 900, columns: 6, lines: 6 },
    { width: 1024, height: 768, columns: 4, lines: 4 },
  ]) {
    test(`${viewport.width} px : ${viewport.columns} colonnes, ${viewport.lines} lignes convergentes, marges, aucun débordement`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openHome(page);
      await expect(page.locator(`${FIGURE} [data-testid='ecosystem-lines'] path`)).toHaveCount(viewport.lines);
      const geometry = await layout(page);
      expect(geometry.columns).toBe(viewport.columns);
      expect(geometry.widths).toEqual([216]);
      expect(geometry.linesShown).toBe(true);
      expect(geometry.dots).toBe(0);
      expect(geometry.scrolls).toBe(false);
      expect(geometry.overflow).toBeLessThanOrEqual(0);
      if (viewport.width === 1440) {
        // The top of the cards is in the first window; ≥ 32 px of margin on each side.
        expect(geometry.top, `cards top ${geometry.top}`).toBeLessThan(viewport.height);
        expect(geometry.left).toBeGreaterThanOrEqual(32);
        expect(viewport.width - geometry.right).toBeGreaterThanOrEqual(32);
        const band = await page.getByTestId("hero-band").boundingBox();
        console.log(`hero 1440 × 900: band 1 bottom ${Math.round(band!.y + band!.height)} px, cards top ${Math.round(geometry.top)} px`);
      }
    });
  }

  for (const width of [390, 360]) {
    test(`${width} px : carrousel à points, aucun débordement du document`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await openHome(page);
      const figure = page.locator(FIGURE);
      await figure.scrollIntoViewIfNeeded();
      const geometry = await layout(page);
      expect(geometry.scrolls).toBe(true);
      expect(geometry.dots).toBe(7);
      expect(geometry.linesShown).toBe(false);
      expect(geometry.overflow).toBeLessThanOrEqual(0);
      // Labels hold on one line.
      const wrapped = await page.locator(`${FIGURE} [data-check]`).evaluateAll((nodes) =>
        nodes.filter((node) => {
          const label = node.previousElementSibling as HTMLElement;
          return label.scrollWidth > label.clientWidth + 1 || label.getBoundingClientRect().height > 22;
        }).length,
      );
      expect(wrapped).toBe(0);
      // A dot brings its card into view (reduced motion: at once) and becomes current. The track keeps
      // its 24 px padding (§2.11.8.3): the last card ends against it, it cannot be centred.
      const dots = figure.getByRole("group", { name: JOURNEY.dots.label }).getByRole("button");
      await expect(dots).toHaveCount(7);
      await expect(dots.first()).toHaveAttribute("aria-current", "step");
      await dots.nth(6).click();
      await expect(dots.nth(6)).toHaveAttribute("aria-current", "step");
      await expect(dots.nth(6)).toHaveAccessibleName("Étape 7 sur 7 : Mandat");
      const shown = await page.evaluate((selector) => {
        const track = document.querySelector<HTMLElement>(`${selector} [data-testid='ecosystem-track']`)!;
        const card = track.querySelector<HTMLElement>("[data-card='mandate']")!.getBoundingClientRect();
        const frame = track.getBoundingClientRect();
        return { left: card.left - frame.left, right: frame.right - card.right, end: track.scrollLeft + track.clientWidth >= track.scrollWidth - 1 };
      }, FIGURE);
      expect(shown.left).toBeGreaterThanOrEqual(0);
      expect(shown.right).toBeGreaterThanOrEqual(23);
      expect(shown.end).toBe(true);
      expect((await layout(page)).overflow).toBeLessThanOrEqual(0);
    });
  }
});

test("bloc A : état final en mouvement réduit (A2), textes et action (A5)", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openHome(page);
  const figure = page.locator(FIGURE);
  await expect(figure).toHaveAttribute("data-loop", "allowed");
  await expect(figure).toHaveAttribute("data-loop-state", "reduced");
  expectFinal(await boxes(page));
  await expect(figure.locator("[data-pill='you'][data-full]")).toHaveCount(2);
  await expect(figure.locator("[data-card][data-active]")).toHaveCount(0);
  // Still cursor on the box of the mandate (tip at its centre, ± 4 px); no live cursor.
  await expect(page.getByTestId("ecosystem-cursor")).toHaveCount(0);
  const tip = await page.getByTestId("ecosystem-cursor-still").boundingBox();
  const mandate = await figure.locator("[data-case='6:0']").boundingBox();
  expect(Math.abs(tip!.x - (mandate!.x + mandate!.width / 2))).toBeLessThanOrEqual(4);
  expect(Math.abs(tip!.y - (mandate!.y + mandate!.height / 2))).toBeLessThanOrEqual(4);

  // A5: every guard rail is visible; the drawing is read from a static list.
  await expect(figure.getByTestId("hero-ecosystem-label")).toContainText("Simulation");
  await expect(figure.getByTestId("hero-ecosystem-label")).toContainText(JOURNEY.badge);
  await expect(figure.getByText(JOURNEY.note)).toBeVisible();
  await expect(figure.getByText(LANDING_TEXTS.hero.illustrationNote)).toBeVisible();
  await expect(figure.getByTestId("ecosystem-guard")).toBeVisible();
  await expect(figure.getByTestId("ecosystem-summary").getByRole("listitem")).toHaveText([...JOURNEY.srSummary]);
  await expect(page.getByRole("figure", { name: JOURNEY.title })).toBeVisible();
  const action = figure.getByRole("link", { name: LANDING_TEXTS.actions.estimation });
  await expect(action).toHaveAttribute("href", "/estimation");
});

test("bloc A sans JavaScript : l'état final complet dans le HTML serveur (cas dégradé)", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await openHome(page);
  expectFinal(await boxes(page));
  await expect(page.getByTestId("ecosystem-cursor-still")).toBeVisible();
  await expect(page.locator(FIGURE).getByRole("link", { name: LANDING_TEXTS.actions.estimation })).toBeVisible();
  await context.close();
});

test.describe("bloc A en mouvement (A3, A4)", () => {
  test.use({ reducedMotion: "no-preference" });

  test("boucle : cycles de 9,8 s, aucune requestAnimationFrame, aucune animation infinie, « Vous » coche après l'arrivée du curseur", async ({ page }) => {
    test.setTimeout(90_000);
    await instrumentPage(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      const log: { what: string; at: number; dx?: number; dy?: number }[] = [];
      (window as unknown as { __eco: typeof log }).__eco = log;
      const watch = () => {
        const figure = document.querySelector<HTMLElement>("[data-testid='hero-ecosystem']");
        if (!figure) return void setTimeout(watch, 50);
        new MutationObserver((records) => {
          for (const record of records) {
            const node = record.target as HTMLElement;
            if (record.attributeName === "data-loop-cycles") log.push({ what: `cycle:${figure.dataset.loopCycles}`, at: performance.now() });
            if (record.attributeName === "data-checked" && node.dataset.check === "you" && node.dataset.checked === "true") {
              const cursor = figure.querySelector<HTMLElement>("[data-testid='ecosystem-cursor']")!.getBoundingClientRect();
              const box = node.getBoundingClientRect();
              log.push({ what: `you:${node.dataset.case}`, at: performance.now(), dx: cursor.left - (box.left + box.width / 2), dy: cursor.top - (box.top + box.height / 2) });
            }
          }
        }).observe(figure, { attributes: true, subtree: true, attributeFilter: ["data-loop-cycles", "data-checked"] });
      };
      document.addEventListener("DOMContentLoaded", watch);
    });
    await openHome(page);
    const figure = page.locator(FIGURE);
    await expect(figure).toHaveAttribute("data-loop-state", "playing");
    await expect(figure).toHaveAttribute("data-loop-cycles", "2", { timeout: 12_000 });

    const log = await page.evaluate(() => (window as unknown as { __eco: { what: string; at: number; dx?: number; dy?: number }[] }).__eco);
    const one = log.find((entry) => entry.what === "cycle:1")!.at;
    const two = log.find((entry) => entry.what === "cycle:2")!.at;
    console.log(`bloc A: cycle measured ${Math.round(two - one)} ms`);
    expect(Math.abs(two - one - 9_800)).toBeLessThanOrEqual(300);
    const yours = log.filter((entry) => entry.what.startsWith("you:"));
    expect(yours.map((entry) => entry.what)).toEqual(["you:3:0", "you:3:1", "you:6:0"]);
    for (const entry of yours) {
      expect(Math.abs(entry.dx!), `${entry.what} cursor dx`).toBeLessThanOrEqual(4);
      expect(Math.abs(entry.dy!), `${entry.what} cursor dy`).toBeLessThanOrEqual(4);
    }
    // While it plays (network settled long ago): no requestAnimationFrame in 2 s, no infinite animation.
    const calls = await rafCalls(page);
    await page.waitForTimeout(2_000);
    expect(await rafCalls(page), "requestAnimationFrame calls while block A plays").toBe(calls);
    await expect(figure).toHaveAttribute("data-loop-state", "playing");
    const infinite = await page.evaluate(() =>
      document.getAnimations().filter((animation) => animation.effect?.getComputedTiming().iterations === Infinity).length,
    );
    expect(infinite).toBe(0);
  });

  test("pause : section « problème » au centre, onglet caché ; reprise au même pas (A4)", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    const figure = page.locator(FIGURE);
    await expect(figure).toHaveAttribute("data-loop-state", "playing");
    await page.waitForTimeout(1_500);

    await centerSection(page, "probleme");
    await expect(figure).toHaveAttribute("data-loop-state", "paused", { timeout: 1_000 });
    await page.waitForTimeout(1_000);
    const snapshot = () =>
      page.evaluate((selector) => {
        const node = document.querySelector<HTMLElement>(selector)!;
        return {
          step: node.dataset.step,
          checked: Array.from(node.querySelectorAll("[data-checked='true']")).length,
          cursor: node.querySelector<HTMLElement>("[data-testid='ecosystem-cursor']")?.style.transform,
          active: node.querySelectorAll("[data-card][data-active]").length,
        };
      }, FIGURE);
    const paused = await snapshot();
    await page.waitForTimeout(1_500);
    expect(await snapshot()).toEqual(paused);

    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect(figure).toHaveAttribute("data-loop-state", "playing", { timeout: 1_000 });
    expect((await snapshot()).step, "resumes at the same step").toBe(paused.step);

    // Hidden tab (simulated visibilitychange): paused, then playing again at the same step.
    const setVisibility = (state: "hidden" | "visible") =>
      page.evaluate((value) => {
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => value });
        document.dispatchEvent(new Event("visibilitychange"));
      }, state);
    await setVisibility("hidden");
    await expect(figure).toHaveAttribute("data-loop-state", "paused");
    const hidden = await snapshot();
    await page.waitForTimeout(1_200);
    expect((await snapshot()).step).toBe(hidden.step);
    await setVisibility("visible");
    await expect(figure).toHaveAttribute("data-loop-state", "playing");
    expect((await snapshot()).step).toBe(hidden.step);
  });

  test("390 px : la boucle coche à sa place, la piste ne défile jamais toute seule", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await openHome(page);
    const figure = page.locator(FIGURE);
    await figure.locator("[data-testid='ecosystem-track']").scrollIntoViewIfNeeded();
    await expect(figure).toHaveAttribute("data-loop-state", "playing", { timeout: 2_000 });
    const scroll = () => figure.locator("[data-testid='ecosystem-track']").evaluate((node) => node.scrollLeft);
    const start = await scroll();
    await page.waitForTimeout(6_000);
    expect(await scroll()).toBe(start);
    expect((await layout(page)).overflow).toBeLessThanOrEqual(0);
  });
});
