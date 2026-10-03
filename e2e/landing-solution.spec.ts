import { expect, test, type Page } from "@playwright/test";

import { HERO_TITLE, LANDING_TEXTS } from "@/components/landing-texts";
import { APP_TEXTS } from "@/components/texts";

/**
 * Block B — the « partner » grid of the solution (docs/design-system.md
 * §2.11.8.4, criteria B1–B3 of §2.11.8.6): five tiles, three columns from 1024
 * (tile 1 on two rows), two from 640, one below; arrival once, every animation
 * finished ≤ 2 s after the last tile entered, nothing under reduced motion;
 * « Exemple fictif » on tiles 1–4 only, no figure outside tile 5 (step
 * ordinals aside), no red pixel, a single cobalt dot in tile 1.
 *
 * The suite runs in reduced motion (playwright.config.ts); the motion group
 * opts back in.
 */

const COLD_START = 60_000;
const TEXTS = LANDING_TEXTS.solution;

async function openHome(page: Page): Promise<void> {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: HERO_TITLE })).toBeVisible({ timeout: COLD_START });
}

/** Boxes of the five tiles (the white tile itself, inside its list item). */
async function tileBoxes(page: Page) {
  return page.locator("[data-testid='solution-grid'] > li[data-tile]").evaluateAll((items) =>
    items.map((item) => {
      const box = item.getBoundingClientRect();
      return { tile: item.getAttribute("data-tile"), x: Math.round(box.left), y: Math.round(box.top), w: Math.round(box.width), h: Math.round(box.height) };
    }),
  );
}

/** Document overflow and any tile whose content is wider than itself. */
async function overflow(page: Page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const tiles = Array.from(document.querySelectorAll<HTMLElement>("[data-testid='solution-grid'] [data-network-cover]"));
    return {
      document: root.scrollWidth - root.clientWidth,
      tiles: tiles.filter((tile) => tile.scrollWidth > tile.clientWidth + 1).length,
    };
  });
}

test.describe("bloc B — grille de la solution", () => {
  test("B1 : trois colonnes à 1440 et 1024 (tuile 1 sur deux rangées), deux à 768, une à 390 et 360, sans débordement", async ({ page }) => {
    test.setTimeout(120_000);
    for (const width of [1440, 1024, 768, 390, 360]) {
      await page.setViewportSize({ width, height: 900 });
      await openHome(page);
      await page.getByTestId("solution-grid").scrollIntoViewIfNeeded();
      const boxes = await tileBoxes(page);
      expect(boxes.map((box) => box.tile)).toEqual(["1", "2", "3", "4", "5"]);
      const [one, two, three, four, five] = boxes as [typeof boxes[number], typeof boxes[number], typeof boxes[number], typeof boxes[number], typeof boxes[number]];
      const columns = new Set(boxes.map((box) => box.x)).size;
      if (width >= 1024) {
        expect(columns, `${width}: columns`).toBe(3);
        expect(two.x).toBe(three.x);
        expect(four.x).toBe(five.x);
        expect(one.x).toBeLessThan(two.x);
        expect(two.x).toBeLessThan(four.x);
        // Tile 1 runs from the top of row 1 to the bottom of row 2.
        expect(Math.abs(one.y - two.y), `${width}: top of tile 1`).toBeLessThanOrEqual(1);
        expect(Math.abs(one.y + one.h - (three.y + three.h)), `${width}: bottom of tile 1`).toBeLessThanOrEqual(1);
      } else if (width >= 640) {
        expect(columns, `${width}: columns`).toBe(2);
        expect(two.x).toBe(three.x);
        expect(Math.abs(one.y + one.h - (three.y + three.h)), `${width}: tile 1 spans two rows`).toBeLessThanOrEqual(1);
        expect(four.y).toBe(five.y);
      } else {
        expect(columns, `${width}: columns`).toBe(1);
        for (let index = 1; index < boxes.length; index += 1) expect(boxes[index]!.y).toBeGreaterThan(boxes[index - 1]!.y);
      }
      expect(await overflow(page), `${width}: overflow`).toEqual({ document: 0, tiles: 0 });
    }
  });

  test("B3 : « Exemple fictif » sur les tuiles 1 à 4, aucune sur la 5, aucun chiffre hors tuile 5, un seul point cobalt dans la tuile 1", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    const tiles = page.locator("[data-testid='solution-grid'] > li[data-tile]");
    for (let index = 0; index < 4; index += 1) {
      const label = tiles.nth(index).getByTestId("solution-fictive");
      await expect(label).toBeVisible();
      await expect(label).toContainText(APP_TEXTS.states.simulation);
      await expect(label).toContainText(TEXTS.fictive);
    }
    await expect(tiles.nth(4).getByTestId("solution-fictive")).toHaveCount(0);
    await expect(tiles.nth(4).getByRole("img")).toHaveCount(0);

    // Figures: tile 5 states the real rules; elsewhere only the step ordinals and the fictitious « 3 actions prêtes ».
    const stray = await tiles.evaluateAll((items, allowed) =>
      items.slice(0, 4).map((item) =>
        (item.textContent ?? "").replace(/(?<!\d)0[1-7](?!\d)/g, "").replace(allowed, "").replace(/\D/g, ""),
      ),
    TEXTS.tiles.report.actions);
    expect(stray).toEqual(["", "", "", ""]);
    await expect(page.getByTestId("solution-grid")).not.toContainText("%");
    await expect(tiles.nth(4)).toContainText("0");
    await expect(tiles.nth(4)).toContainText("2");

    const dots = tiles.nth(0).getByTestId("solution-roadmap-dot");
    await expect(dots).toHaveCount(1);
    await expect(dots).toHaveCSS("background-color", "rgb(36, 87, 255)");
    await expect(tiles.nth(0)).toContainText(TEXTS.tiles.roadmap.pending);
  });

  test("L3-B1 : illustrations seules — aucun texte visible hors des cadres, titres et paragraphes en sr-only", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    const grid = page.getByTestId("solution-grid");
    const outside = await grid.evaluate((node) => {
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      const found: string[] = [];
      for (let text = walker.nextNode(); text; text = walker.nextNode()) {
        if (!text.textContent?.trim()) continue;
        const parent = text.parentElement!;
        if (parent.closest(".sr-only") || parent.closest("[data-testid='solution-visual']")) continue;
        const range = document.createRange();
        range.selectNodeContents(text);
        const box = range.getBoundingClientRect();
        if (box.width > 1 && box.height > 1) found.push(text.textContent.trim());
      }
      return found;
    });
    expect(outside).toEqual([]);
    const headings = grid.locator("h3");
    await expect(headings).toHaveText([
      TEXTS.tiles.roadmap.title,
      TEXTS.tiles.progress.title,
      TEXTS.tiles.team.title,
      TEXTS.tiles.report.title,
      TEXTS.tiles.guards.title,
    ]);
    for (const className of await headings.evaluateAll((nodes) => nodes.map((heading) => heading.className))) expect(className).toContain("sr-only");
    await expect(grid.getByRole("article", { name: TEXTS.tiles.roadmap.title })).toHaveCount(1);
    await expect(grid.getByRole("img")).toHaveCount(4);
    await expect(grid.getByTestId("solution-fictive")).toHaveCount(4);
  });

  test("L3-B2 : aucun cadre vide ni tronqué à 1440, 1024, 390 et 360 (tuile 5 : texte entier)", async ({ page }) => {
    test.setTimeout(120_000);
    for (const width of [1440, 1024, 390, 360]) {
      await page.setViewportSize({ width, height: 900 });
      await openHome(page);
      await page.getByTestId("solution-grid").scrollIntoViewIfNeeded();
      const frames = await page.getByTestId("solution-visual").evaluateAll((nodes) =>
        nodes.map((frame) => {
          const box = frame.getBoundingClientRect();
          const drawn = Array.from(frame.querySelectorAll<HTMLElement>("*")).filter((child) => {
            const rect = child.getBoundingClientRect();
            return rect.width > 4 && rect.height > 4;
          }).length;
          return { h: Math.round(box.height), drawn, clipped: frame.scrollHeight > frame.clientHeight + 1 };
        }),
      );
      const min = width >= 1024 ? 232 : 220;
      frames.forEach((frame, index) => {
        expect(frame.h, `${width}: frame ${index + 1} height`).toBeGreaterThanOrEqual(index === 0 ? (width >= 1024 ? 456 : 400) : min);
        expect(frame.drawn, `${width}: frame ${index + 1} drawn`).toBeGreaterThan(2);
      });
      expect(frames[4]!.clipped, `${width}: tile 5 whole`).toBe(false);
      console.log(`bloc B ${width}: frame heights ${frames.map((frame) => frame.h).join(" / ")}`);
    }
  });

  test("B3 : aucun pixel rouge dans la grille (1440, après l'arrivée)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await openHome(page);
    const grid = page.getByTestId("solution-grid");
    await grid.scrollIntoViewIfNeeded();
    const png = await grid.screenshot();
    const red = await page.evaluate(async (base64) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      let count = 0;
      for (let index = 0; index < data.length; index += 4) {
        const [r, g, b] = [data[index]!, data[index + 1]!, data[index + 2]!];
        if (r > 150 && r - Math.max(g, b) > 80) count += 1;
      }
      return count;
    }, png.toString("base64"));
    expect(red).toBe(0);
  });

  test("mouvement réduit : état final à l'instant 0, aucune animation dans la grille", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: COLD_START });
    await page.getByTestId("solution-grid").scrollIntoViewIfNeeded();
    const state = await page.getByTestId("solution-grid").evaluate((grid) => ({
      animations: grid.getAnimations({ subtree: true }).length,
      hidden: Array.from(grid.querySelectorAll<HTMLElement>("[data-network-cover]")).filter((tile) => getComputedStyle(tile).opacity !== "1").length,
      steps: Array.from(grid.querySelectorAll<HTMLElement>("[data-testid='solution-roadmap'] li")).filter((step) => getComputedStyle(step).opacity !== "1").length,
    }));
    expect(state).toEqual({ animations: 0, hidden: 0, steps: 0 });
  });

  test("cas dégradé : sans JavaScript, les cinq tuiles et leurs dessins sont dans le HTML, état final", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/", { timeout: COLD_START });
    const grid = page.getByTestId("solution-grid");
    await expect(grid.locator("> li[data-tile]")).toHaveCount(5);
    await expect(page.getByTestId("solution-roadmap").locator("li")).toHaveCount(7);
    await expect(page.getByTestId("solution-guards")).toContainText(TEXTS.tiles.guards.rows[1].value);
    await context.close();
  });

  test.describe("avec mouvement", () => {
    test.use({ reducedMotion: "no-preference" });

    test("B2 : arrivée jouée une fois, toutes les animations finies ≤ 2 s après l'entrée de la dernière tuile", async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width: 1440, height: 900 });
      await openHome(page);
      await page.mouse.move(2, 2);
      const grid = page.getByTestId("solution-grid");
      // Before entering: the tiles wait, hidden.
      await expect(grid.locator(".reveal[data-reveal='hidden']")).toHaveCount(5);
      await grid.evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
      await expect(grid.locator(".reveal[data-reveal='entering']")).toHaveCount(5, { timeout: 5_000 });
      const running = await grid.evaluate((element) => element.getAnimations({ subtree: true }).length);
      expect(running, "animations right after the entry").toBeGreaterThan(0);
      await page.waitForTimeout(2_000);
      // The Simulation badges play their own single cycle from the page load (§2.11.5): not part of block B.
      const left = await grid.evaluate((element) =>
        element
          .getAnimations({ subtree: true })
          .map((animation) => (animation as CSSAnimation).animationName ?? "?")
          .filter((name) => !/^simulation-(float|pulse)$/.test(name)),
      );
      expect(left, "animations 2 s after the last entry").toEqual([]);
      // Final state: every tile opaque, in place.
      const tiles = await grid.locator("[data-network-cover]").evaluateAll((nodes) =>
        nodes.map((node) => [getComputedStyle(node).opacity, getComputedStyle(node).transform]),
      );
      for (const [opacity, transform] of tiles) {
        expect(opacity).toBe("1");
        expect(transform).toBe("none");
      }
    });

    test("au survol (souris), la tuile monte de 2 px, puis revient", async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await openHome(page);
      const grid = page.getByTestId("solution-grid");
      await grid.evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
      await page.waitForTimeout(2_200);
      const tile = grid.locator("li[data-tile='2'] [data-network-cover]");
      const before = await tile.boundingBox();
      await tile.hover();
      await page.waitForTimeout(400);
      const after = await tile.boundingBox();
      expect(Math.round((before?.y ?? 0) - (after?.y ?? 0))).toBe(2);
    });
  });
});
