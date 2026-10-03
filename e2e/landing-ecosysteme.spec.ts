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

/** Every card: its key and its box (L3-A1). */
async function cards(page: Page) {
  return page.locator(`${FIGURE} [data-card]`).evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return { key: node.getAttribute("data-card"), left: rect.left, top: rect.top, width: rect.width, height: rect.height, right: rect.right };
    }),
  );
}

const CARD_KEYS = JOURNEY.cards.map((card) => card.key);

test.describe("bloc A : composition ordonnée (L3-A1, L3-A2)", () => {
  test("1440 px : une rangée de 7 cartes de 186 px, un seul haut, une seule hauteur, 7 lignes", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    await expect(page.locator(`${FIGURE} [data-testid='ecosystem-lines'] path`)).toHaveCount(7);
    const all = await cards(page);
    expect(all.map((card) => card.key)).toEqual(CARD_KEYS);
    expect([...all].sort((a, b) => a.left - b.left).map((card) => card.key), "left → right = order of the cards").toEqual(CARD_KEYS);
    for (const card of all) expect(Math.abs(card.width - 186), `${card.key} width`).toBeLessThanOrEqual(0.5);
    const tops = all.map((card) => card.top);
    const heights = all.map((card) => card.height);
    expect(Math.max(...tops) - Math.min(...tops), "one top").toBeLessThanOrEqual(0.5);
    expect(Math.max(...heights) - Math.min(...heights), "one height").toBeLessThanOrEqual(0.5);
    const geometry = await layout(page);
    expect(geometry.top, `cards top ${geometry.top}`).toBeLessThan(900);
    expect(geometry.left).toBeGreaterThanOrEqual(32);
    expect(1440 - geometry.right).toBeGreaterThanOrEqual(32);
    expect(geometry.linesShown).toBe(true);
    expect(geometry.dots).toBe(0);
    expect(geometry.scrolls).toBe(false);
    expect(geometry.overflow).toBeLessThanOrEqual(0);
    console.log(`bloc A 1440: card height ${heights[0]!.toFixed(1)} px, cards top ${Math.round(geometry.top)} px`);
  });

  test("1024 px : 7 cartes de 216 px en 4 + 3, rangée 2 centrée, même hauteur, 3 lignes", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await openHome(page);
    await expect(page.locator(`${FIGURE} [data-testid='ecosystem-lines'] path`)).toHaveCount(3);
    const all = await cards(page);
    expect(all.map((card) => card.key)).toEqual(CARD_KEYS);
    for (const card of all) expect(Math.abs(card.width - 216), `${card.key} width`).toBeLessThanOrEqual(0.5);
    const rowOne = all.slice(0, 4);
    const rowTwo = all.slice(4);
    for (const row of [rowOne, rowTwo]) {
      const tops = row.map((card) => card.top);
      expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(0.5);
    }
    expect(rowTwo[0]!.top).toBeGreaterThan(rowOne[0]!.top + rowOne[0]!.height);
    const centre = (row: typeof all) => (Math.min(...row.map((card) => card.left)) + Math.max(...row.map((card) => card.right))) / 2;
    expect(Math.abs(centre(rowOne) - centre(rowTwo)), "row 2 centred").toBeLessThanOrEqual(1);
    const heights = all.map((card) => card.height);
    expect(Math.max(...heights) - Math.min(...heights), "one height").toBeLessThanOrEqual(0.5);
    const geometry = await layout(page);
    expect(geometry.scrolls).toBe(false);
    expect(geometry.overflow).toBeLessThanOrEqual(0);
    console.log(`bloc A 1024: card height ${heights[0]!.toFixed(1)} px`);
  });

  for (const width of [1440, 1024]) {
    test(`${width} px : aucun libellé tronqué, seule « Motivation / à demander » sur deux lignes (L3-A2)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await openHome(page);
      const labels = await page.locator(`${FIGURE} [data-check]`).evaluateAll((nodes) =>
        nodes.map((node) => {
          const label = node.previousElementSibling as HTMLElement;
          const parts = label.hasAttribute("data-stacked") ? (Array.from(label.children) as HTMLElement[]) : [label];
          return {
            key: node.getAttribute("data-case"),
            text: label.textContent,
            clipped: parts.some((part) => part.scrollWidth > part.clientWidth + 0.5),
            stacked: label.hasAttribute("data-stacked"),
            width: Math.max(...parts.map((part) => part.scrollWidth)),
          };
        }),
      );
      expect(labels.filter((label) => label.clipped).map((label) => label.text)).toEqual([]);
      expect(labels.filter((label) => label.stacked).map((label) => label.key)).toEqual(["1:2"]);
      console.log(`bloc A ${width}: widest label ${Math.max(...labels.map((label) => label.width))} px`);
    });
  }

  for (const width of [390, 360]) {
    test(`${width} px : carrousel à points, cartes de même hauteur, aucun débordement du document`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await openHome(page);
      const figure = page.locator(FIGURE);
      await figure.scrollIntoViewIfNeeded();
      const geometry = await layout(page);
      expect(geometry.scrolls).toBe(true);
      expect(geometry.dots).toBe(7);
      expect(geometry.linesShown).toBe(false);
      expect(geometry.overflow).toBeLessThanOrEqual(0);
      const heights = (await cards(page)).map((card) => card.height);
      expect(Math.max(...heights) - Math.min(...heights), "one height").toBeLessThanOrEqual(0.5);
      // Labels hold on one line (the stacked missing line aside).
      const wrapped = await page.locator(`${FIGURE} [data-check]`).evaluateAll((nodes) =>
        nodes.filter((node) => {
          const label = node.previousElementSibling as HTMLElement;
          if (label.hasAttribute("data-stacked")) return false;
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

test.describe("bloc A : trajet simple du curseur (L3-A4)", () => {
  test.use({ reducedMotion: "no-preference" });

  for (const width of [1440, 1024]) {
    test(`${width} px : parc au centre de « Validation humaine », 20 px sous la carte`, async ({ page }) => {
      test.setTimeout(60_000);
      await page.setViewportSize({ width, height: 900 });
      await openHome(page);
      const figure = page.locator(FIGURE);
      await expect(figure).toHaveAttribute("data-loop-state", "playing");
      // The cursor is parked from 900 ms to 3 140 ms of the cycle; Hugo's second box is checked at 2 020 ms.
      await expect(figure.locator("[data-case='1:1']")).toHaveAttribute("data-checked", "true", { timeout: 12_000 });
      await page.waitForTimeout(150);
      const park = await page.evaluate((selector) => {
        const node = document.querySelector<HTMLElement>(selector)!;
        const cursor = node.querySelector<HTMLElement>("[data-testid='ecosystem-cursor']")!.getBoundingClientRect();
        const card = node.querySelector<HTMLElement>("[data-card='review']")!.getBoundingClientRect();
        const box = (key: string) => node.querySelector<HTMLElement>(`[data-case='${key}']`)!.getBoundingClientRect();
        const second = box("3:1");
        const mandate = box("6:0");
        return {
          dx: cursor.left - (card.left + card.width / 2),
          dy: cursor.top - card.bottom,
          drop: Math.abs(mandate.top + mandate.height / 2 - (second.top + second.height / 2)),
        };
      }, FIGURE);
      console.log(`bloc A ${width}: park dx ${park.dx.toFixed(1)} dy ${park.dy.toFixed(1)}, validation 2 → mandate ${park.drop.toFixed(1)} px`);
      expect(Math.abs(park.dx)).toBeLessThanOrEqual(4);
      expect(Math.abs(park.dy - 20)).toBeLessThanOrEqual(4);
      if (width === 1440) expect(park.drop).toBeLessThanOrEqual(44);
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
