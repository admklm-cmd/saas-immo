import { expect, test, type Page } from "@playwright/test";

import { HERO_TITLE, LANDING_TEXTS } from "@/components/landing-texts";

import { centerSection, instrumentPage, rafCalls } from "./helpers/landing-network";

/**
 * Block A of the hero — « Vous » in the ecosystem of the agents
 * (docs/design-system.md §2.11.8.8 L4-A, criteria L4-A1 to L4-A5): three
 * blocks (Acquisition, Validation humaine, Suivi) marked by app tiles, a slow
 * 24 s cycle. The only loop of the landing: paused off screen and in a hidden
 * tab, still on its final state under reduced motion and without JavaScript.
 * A human box is only ever checked by the « Vous » cursor, once it has
 * arrived on it; « Mandat confirmé » only after « Mandat signalé ».
 *
 * No form on this journey: no consent checkbox to check.
 */

const COLD_START = 60_000;
const JOURNEY = LANDING_TEXTS.journey;
const FIGURE = "[data-testid='hero-ecosystem']";
const BLOCK_KEYS = JOURNEY.blocks.map((block) => block.key);

async function openHome(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: HERO_TITLE })).toBeVisible({ timeout: COLD_START });
}

async function boxes(page: Page) {
  return page.locator(`${FIGURE} [data-check]`).evaluateAll((nodes) =>
    nodes.map((node) => ({ key: node.getAttribute("data-case"), by: node.getAttribute("data-check"), checked: node.getAttribute("data-checked") === "true" })),
  );
}

/** Every block: its key and its box. */
async function blocks(page: Page) {
  return page.locator(`${FIGURE} [data-block]`).evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return { key: node.getAttribute("data-block"), left: rect.left, top: rect.top + window.scrollY, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom + window.scrollY };
    }),
  );
}

async function layout(page: Page) {
  return page.evaluate((selector) => {
    const figure = document.querySelector<HTMLElement>(selector)!;
    const track = figure.querySelector<HTMLElement>("[data-testid='ecosystem-track']")!;
    const svg = figure.querySelector<SVGElement>("[data-testid='ecosystem-lines']");
    return {
      lines: figure.querySelectorAll("[data-testid='ecosystem-lines'] path").length,
      linesShown: svg ? getComputedStyle(svg).display !== "none" : false,
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
  expect(all.filter((box) => box.by === "missing")).toEqual([{ key: "0:1:2", by: "missing", checked: false }]);
  expect(all.filter((box) => box.by === "you").map((box) => [box.key, box.checked])).toEqual([
    ["1:0:0", true],
    ["1:0:1", true],
    ["1:1:0", true],
  ]);
}

/** Labels: none clipped; only the missing line is stacked. */
async function labels(page: Page) {
  return page.locator(`${FIGURE} [data-check]`).evaluateAll((nodes) =>
    nodes.map((node) => {
      const label = node.previousElementSibling as HTMLElement;
      const parts = label.hasAttribute("data-stacked") ? (Array.from(label.children) as HTMLElement[]) : [label];
      return {
        key: node.getAttribute("data-case"),
        text: label.textContent,
        clipped: parts.some((part) => part.scrollWidth > part.clientWidth + 0.5),
        wrapped: !label.hasAttribute("data-stacked") && label.getBoundingClientRect().height > 22,
        stacked: label.hasAttribute("data-stacked"),
      };
    }),
  );
}

test.describe("bloc A : trois blocs (L4-A1, L4-A2)", () => {
  test("1440 px : 600 / 300 / 420 px, espacement 24, marges 0 / 28 / 12, centrés, 3 lignes", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    await expect(page.locator(`${FIGURE} [data-testid='ecosystem-lines'] path`)).toHaveCount(3);
    const all = await blocks(page);
    expect(all.map((block) => block.key)).toEqual(BLOCK_KEYS);
    expect(all.map((block) => Math.round(block.width))).toEqual([600, 300, 420]);
    expect(Math.abs(all[1]!.left - all[0]!.right - 24)).toBeLessThanOrEqual(1);
    expect(Math.abs(all[2]!.left - all[1]!.right - 24)).toBeLessThanOrEqual(1);
    const top = all[0]!.top;
    expect(all.map((block) => Math.round(block.top - top))).toEqual([0, 28, 12]);
    expect(Math.abs(all[0]!.left - (1440 - all[2]!.right)), "centred").toBeLessThanOrEqual(1);
    const viewportTop = await page.locator(`${FIGURE} [data-block]`).first().evaluate((node) => node.getBoundingClientRect().top);
    expect(viewportTop).toBeLessThan(900);
    const geometry = await layout(page);
    expect(geometry.linesShown).toBe(true);
    expect(geometry.dots).toBe(0);
    expect(geometry.scrolls).toBe(false);
    expect(geometry.overflow).toBeLessThanOrEqual(0);
    console.log(`bloc A 1440: heights ${all.map((block) => block.height.toFixed(1)).join(" / ")} px, top ${Math.round(viewportTop)} px`);
  });

  test("1024 px : grille de 912 px, Validation à droite, Suivi 456 px calé à droite sous l'Acquisition, 2 lignes", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await openHome(page);
    await expect(page.locator(`${FIGURE} [data-testid='ecosystem-lines'] path`)).toHaveCount(2);
    const [acquisition, validation, suivi] = await blocks(page);
    expect(Math.round(acquisition!.width)).toBe(600);
    expect(Math.round(validation!.width)).toBe(288);
    expect(Math.round(suivi!.width)).toBe(456);
    expect(Math.round(validation!.right - acquisition!.left)).toBe(912);
    expect(Math.abs(validation!.left - acquisition!.right - 24)).toBeLessThanOrEqual(1);
    expect(Math.abs(suivi!.right - acquisition!.right), "Suivi set right").toBeLessThanOrEqual(1);
    expect(Math.abs(suivi!.top - acquisition!.bottom - 20)).toBeLessThanOrEqual(1);
    expect(Math.abs(validation!.top - acquisition!.top - 28)).toBeLessThanOrEqual(1);
    const geometry = await layout(page);
    expect(geometry.scrolls).toBe(false);
    expect(geometry.overflow).toBeLessThanOrEqual(0);
    console.log(`bloc A 1024: heights ${[acquisition, validation, suivi].map((block) => block!.height.toFixed(1)).join(" / ")} px`);
  });

  for (const width of [1440, 1024]) {
    test(`${width} px : aucun libellé tronqué, seule « Motivation / à demander » empilée (L4-A2)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await openHome(page);
      const all = await labels(page);
      expect(all).toHaveLength(16);
      expect(all.filter((label) => label.clipped || label.wrapped).map((label) => label.text)).toEqual([]);
      expect(all.filter((label) => label.stacked).map((label) => label.key)).toEqual(["0:1:2"]);
    });
  }

  for (const width of [390, 360]) {
    test(`${width} px : carrousel de 3 blocs, 3 points, aucun libellé tronqué, aucun débordement`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await openHome(page);
      const figure = page.locator(FIGURE);
      await figure.scrollIntoViewIfNeeded();
      const geometry = await layout(page);
      expect(geometry.scrolls).toBe(true);
      expect(geometry.dots).toBe(3);
      expect(geometry.linesShown).toBe(false);
      expect(geometry.overflow).toBeLessThanOrEqual(0);
      const all = await labels(page);
      expect(all.filter((label) => label.clipped || label.wrapped).map((label) => label.text)).toEqual([]);
      const widths = (await blocks(page)).map((block) => Math.round(block.width));
      expect(new Set(widths).size).toBe(1);
      expect(widths[0]).toBe(Math.round(Math.min(340, width * 0.86)));
      // A dot brings its block into view (reduced motion: at once) and becomes current.
      const dots = figure.getByRole("group", { name: JOURNEY.dots.label }).getByRole("button");
      await expect(dots).toHaveCount(3);
      await expect(dots.first()).toHaveAttribute("aria-current", "step");
      await expect(dots.nth(2)).toHaveAccessibleName("Bloc 3 sur 3 : Suivi");
      await dots.nth(2).click();
      await expect(dots.nth(2)).toHaveAttribute("aria-current", "step");
      expect((await layout(page)).overflow).toBeLessThanOrEqual(0);
    });
  }
});

test("bloc A : tuiles d'application (L4-A3) — glyphes, tons, glyphe blanc, aucun cobalt, contraste ≥ 3:1", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openHome(page);
  const tiles = page.locator(`${FIGURE} [data-app-tile]`);
  await expect(tiles).toHaveCount(3);
  const info = await tiles.evaluateAll((nodes) =>
    nodes.map((node) => {
      const svg = node.querySelector("svg[data-icon]")!;
      const painted = Array.from(svg.querySelectorAll<SVGElement>("[data-part] path, [data-part] circle, [data-part] rect"));
      const paint = new Set<string>();
      for (const shape of painted) {
        const style = getComputedStyle(shape);
        if (style.fill !== "none") paint.add(style.fill);
        if (style.stroke !== "none" && !shape.hasAttribute("data-on-accent")) paint.add(style.stroke);
      }
      const rect = node.getBoundingClientRect();
      return {
        tone: node.getAttribute("data-tone"),
        glyph: svg.getAttribute("data-icon"),
        color: getComputedStyle(svg).color,
        paint: [...paint],
        side: Math.round(rect.width),
        hidden: node.getAttribute("aria-hidden"),
        background: getComputedStyle(node).backgroundImage,
      };
    }),
  );
  expect(info.map((tile) => [tile.glyph, tile.tone])).toEqual([
    ["leads", "orange"],
    ["humanValidation", "violet"],
    ["pipeline", "green"],
  ]);
  const cobalt = "rgb(36, 87, 255)";
  for (const tile of info) {
    expect(tile.color).toBe("rgb(255, 255, 255)");
    expect(tile.paint.join(" "), `${tile.glyph} paint`).not.toContain(cobalt);
    for (const paint of tile.paint) expect(paint, `${tile.glyph} paint`).toMatch(/^rgba?\(255, 255, 255/);
    expect(tile.side).toBe(64);
    expect(tile.hidden).toBe("true");
    expect(tile.background).toContain("linear-gradient");
  }
  // White on the top colour of each gradient: ≥ 3:1 (graphic element).
  const luminance = (hex: string) => {
    const channel = (value: number) => {
      const c = value / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const [r, g, b] = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
    return 0.2126 * channel(r!) + 0.7152 * channel(g!) + 0.0722 * channel(b!);
  };
  for (const top of ["#E8600E", "#7A5CFA", "#1E9E5A"]) {
    expect(1.05 / (luminance(top) + 0.05), top).toBeGreaterThanOrEqual(3);
  }
  // The three colours appear nowhere else on the page.
  const elsewhere = await page.evaluate(() => {
    const colours = ["rgb(232, 96, 14)", "rgb(207, 79, 8)", "rgb(122, 92, 250)", "rgb(91, 63, 224)", "rgb(30, 158, 90)", "rgb(18, 122, 69)"];
    return Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .filter((node) => !node.closest("[data-app-tile]"))
      .filter((node) => {
        const style = getComputedStyle(node);
        return colours.some((colour) => [style.color, style.backgroundColor, style.borderTopColor, style.backgroundImage].some((value) => value.includes(colour)));
      })
      .map((node) => node.tagName).length;
  });
  expect(elsewhere).toBe(0);
});

test("bloc A : état final en mouvement réduit (L4-A4), textes et action (L4-A5)", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openHome(page);
  const figure = page.locator(FIGURE);
  await expect(figure).toHaveAttribute("data-loop", "allowed");
  await expect(figure).toHaveAttribute("data-loop-state", "reduced");
  expectFinal(await boxes(page));
  await expect(figure.locator("[data-pill='you'][data-full]")).toHaveCount(1);
  await expect(figure.locator("[data-block][data-active]")).toHaveCount(0);
  // Still cursor on « Mandat confirmé » (tip at its centre, ± 4 px); no live cursor.
  await expect(page.getByTestId("ecosystem-cursor")).toHaveCount(0);
  const tip = await page.getByTestId("ecosystem-cursor-still").boundingBox();
  const mandate = await figure.locator("[data-case='1:1:0']").boundingBox();
  expect(Math.abs(tip!.x - (mandate!.x + mandate!.width / 2))).toBeLessThanOrEqual(4);
  expect(Math.abs(tip!.y - (mandate!.y + mandate!.height / 2))).toBeLessThanOrEqual(4);

  await expect(figure.getByTestId("hero-ecosystem-label")).toContainText("Simulation");
  await expect(figure.getByTestId("hero-ecosystem-label")).toContainText(JOURNEY.badge);
  await expect(figure.getByText(JOURNEY.note)).toBeVisible();
  await expect(figure.getByText(LANDING_TEXTS.hero.illustrationNote)).toBeVisible();
  await expect(figure.getByTestId("ecosystem-guard")).toBeVisible();
  await expect(figure.getByTestId("ecosystem-summary").getByRole("listitem")).toHaveText([...JOURNEY.srSummary]);
  await expect(page.getByRole("figure", { name: JOURNEY.title })).toBeVisible();
  await expect(figure.getByRole("link", { name: LANDING_TEXTS.actions.estimation })).toHaveAttribute("href", "/estimation");
});

test("bloc A sans JavaScript : l'état final complet dans le HTML serveur (cas dégradé)", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await openHome(page);
  expectFinal(await boxes(page));
  await expect(page.locator(`${FIGURE} [data-app-tile]`)).toHaveCount(3);
  await expect(page.getByTestId("ecosystem-cursor-still")).toBeVisible();
  await expect(page.locator(FIGURE).getByRole("link", { name: LANDING_TEXTS.actions.estimation })).toBeVisible();
  await context.close();
});

test.describe("bloc A en mouvement (L4-A4)", () => {
  test.use({ reducedMotion: "no-preference" });

  test("boucle de 24 s : 15 coches dans l'ordre, « Vous » coche après l'arrivée du curseur, mandat confirmé après signalé, 0 rAF", async ({ page }) => {
    test.setTimeout(120_000);
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
            if (record.attributeName === "data-checked" && node.dataset.checked === "true") {
              const entry: { what: string; at: number; dx?: number; dy?: number } = { what: `${node.dataset.check}:${node.dataset.case}`, at: performance.now() };
              if (node.dataset.check === "you") {
                const cursor = figure.querySelector<HTMLElement>("[data-testid='ecosystem-cursor']")!.getBoundingClientRect();
                const box = node.getBoundingClientRect();
                entry.dx = cursor.left - (box.left + box.width / 2);
                entry.dy = cursor.top - (box.top + box.height / 2);
              }
              log.push(entry);
            }
          }
        }).observe(figure, { attributes: true, subtree: true, attributeFilter: ["data-loop-cycles", "data-checked"] });
      };
      document.addEventListener("DOMContentLoaded", watch);
    });
    await openHome(page);
    const figure = page.locator(FIGURE);
    await expect(figure).toHaveAttribute("data-loop-state", "playing");
    await expect(figure).toHaveAttribute("data-loop-cycles", "2", { timeout: 30_000 });

    const log = await page.evaluate(() => (window as unknown as { __eco: { what: string; at: number; dx?: number; dy?: number }[] }).__eco);
    const one = log.find((entry) => entry.what === "cycle:1")!.at;
    const two = log.find((entry) => entry.what === "cycle:2")!.at;
    console.log(`bloc A: cycle measured ${Math.round(two - one)} ms`);
    expect(Math.abs(two - one - 24_000)).toBeLessThanOrEqual(150);
    const checks = log.filter((entry) => entry.at > one && entry.at < two && !entry.what.startsWith("cycle"));
    expect(checks.map((entry) => entry.what)).toEqual([
      "agent:0:0:0",
      "agent:0:0:1",
      "agent:0:0:2",
      "agent:0:1:0",
      "agent:0:1:1",
      "agent:0:2:0",
      "agent:0:2:1",
      "you:1:0:0",
      "you:1:0:1",
      "agent:2:0:0",
      "agent:2:0:1",
      "agent:2:1:0",
      "agent:2:1:1",
      "agent:2:1:2",
      "you:1:1:0",
    ]);
    for (const entry of checks.filter((check) => check.what.startsWith("you:"))) {
      expect(Math.abs(entry.dx!), `${entry.what} cursor dx`).toBeLessThanOrEqual(4);
      expect(Math.abs(entry.dy!), `${entry.what} cursor dy`).toBeLessThanOrEqual(4);
    }
    // « Mandat confirmé » (1:1:0) after « Mandat signalé » (2:1:2).
    const flagged = checks.find((entry) => entry.what === "agent:2:1:2")!.at;
    const confirmed = checks.find((entry) => entry.what === "you:1:1:0")!.at;
    expect(confirmed).toBeGreaterThan(flagged);
    // While it plays: no requestAnimationFrame in 2 s, no infinite animation.
    const calls = await rafCalls(page);
    await page.waitForTimeout(2_000);
    expect(await rafCalls(page), "requestAnimationFrame calls while block A plays").toBe(calls);
    const infinite = await page.evaluate(() =>
      document.getAnimations().filter((animation) => animation.effect?.getComputedTiming().iterations === Infinity).length,
    );
    expect(infinite).toBe(0);
  });

  test("parc : centre de « Validation humaine », 20 px sous le bloc, à 1440 et 1024", async ({ page }) => {
    test.setTimeout(60_000);
    for (const width of [1440, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      await openHome(page);
      const figure = page.locator(FIGURE);
      // 1024: two rows of blocks, the figure starts low under the title — bring it on screen.
      await figure.locator("[data-block='validation']").scrollIntoViewIfNeeded();
      await expect(figure).toHaveAttribute("data-loop-state", "playing");
      // Parked from 1 400 ms to 7 400 ms of the cycle; Hugo's second box is checked at 4 400 ms.
      await expect(figure.locator("[data-case='0:1:1']")).toHaveAttribute("data-checked", "true", { timeout: 15_000 });
      const park = await page.evaluate((selector) => {
        const node = document.querySelector<HTMLElement>(selector)!;
        const cursor = node.querySelector<HTMLElement>("[data-testid='ecosystem-cursor']")!.getBoundingClientRect();
        const block = node.querySelector<HTMLElement>("[data-block='validation']")!.getBoundingClientRect();
        return { dx: cursor.left - (block.left + block.width / 2), dy: cursor.top - block.bottom };
      }, FIGURE);
      console.log(`bloc A ${width}: park dx ${park.dx.toFixed(1)} dy ${park.dy.toFixed(1)}`);
      expect(Math.abs(park.dx)).toBeLessThanOrEqual(4);
      expect(Math.abs(park.dy - 20)).toBeLessThanOrEqual(4);
    }
  });

  test("pause : section « problème » au centre, onglet caché ; reprise au même pas", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    const figure = page.locator(FIGURE);
    await expect(figure).toHaveAttribute("data-loop-state", "playing");
    await page.waitForTimeout(2_500);

    await centerSection(page, "probleme");
    await expect(figure).toHaveAttribute("data-loop-state", "paused", { timeout: 1_000 });
    await page.waitForTimeout(1_500);
    const snapshot = () =>
      page.evaluate((selector) => {
        const node = document.querySelector<HTMLElement>(selector)!;
        return {
          step: node.dataset.step,
          checked: Array.from(node.querySelectorAll("[data-checked='true']")).length,
          cursor: node.querySelector<HTMLElement>("[data-testid='ecosystem-cursor']")?.style.transform,
          active: node.querySelectorAll("[data-block][data-active]").length,
        };
      }, FIGURE);
    const paused = await snapshot();
    await page.waitForTimeout(1_500);
    expect(await snapshot()).toEqual(paused);

    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect(figure).toHaveAttribute("data-loop-state", "playing", { timeout: 1_000 });
    expect((await snapshot()).step, "resumes at the same step").toBe(paused.step);

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
