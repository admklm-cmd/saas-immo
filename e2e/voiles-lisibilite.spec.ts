import { expect, test, type Page } from "@playwright/test";

import { signIn } from "./helpers/sign-in";

/**
 * Readability of text posed on the particle background (docs/design-system.md §2.5.8).
 *
 * The canvas covers the whole viewport at opacities up to .46: any text of the
 * signed-in space that is neither on an opaque surface (card, tile, panel) nor
 * under `.particle-veil` can fall under AA. This suite walks the DOM of each
 * screen and fails on any such text, at 1440 and 390 px. It also checks that
 * the TIGHT veil of the pipeline column headers never reaches the neighbouring
 * column (its connector line and its words stay untouched).
 *
 * The pixel-level contrast measure itself is done outside the suite (captures,
 * text made transparent, darkest pixel under each line): too slow and too
 * machine-dependent for a regression test. This test guards the cause.
 */

const COLD_START = 60_000;
/** The six active columns (« Perdu » is its own opaque lane). */
const ACTIVE_COLUMNS = "[data-pipeline-column]:not([data-pipeline-column=perdu])";

const PAGES = [
  "/dashboard",
  "/contacts",
  "/pipeline",
  "/taches",
  "/rendez-vous",
  "/agents-ia",
  "/agents-ia/a-valider",
  "/agents-ia/leads-entrants",
  "/agents-ia/relances",
  "/agents-ia/suivi-rendez-vous",
  "/parametres",
];

test.beforeEach(() => {
  test.setTimeout(240_000);
});

async function openPage(page: Page, href: string): Promise<void> {
  await page.goto(href);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: COLD_START });
}

/** Visible text of <main> that sits directly on the canvas: no veil, no opaque surface under it. */
function textOnCanvas(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const main = document.querySelector("main");
    if (!main) return ["<main> missing"];
    const exposed = new Set<string>();
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = node.textContent?.trim();
      const element = node.parentElement;
      if (!text || !element || element.closest(".sr-only")) continue;
      if (!element.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      // Clipped to 1 px (responsive `sm:sr-only`): not painted, nothing to read.
      const box = element.getBoundingClientRect();
      if (box.width < 2 || box.height < 2) continue;
      let current: Element | null = element;
      let covered = false;
      while (current && current !== main) {
        if (current.classList.contains("particle-veil")) {
          covered = true;
          break;
        }
        const alpha = getComputedStyle(current).backgroundColor.match(/[\d.]+/g);
        if (alpha && (alpha.length === 3 || Number(alpha[3]) >= 0.95)) {
          covered = true;
          break;
        }
        current = current.parentElement;
      }
      if (!covered) exposed.add(text.slice(0, 60));
    }
    return [...exposed];
  });
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`${viewport.width} px : aucun texte n'est posé à nu sur le fond de particules`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await signIn(page, "agentA");
    for (const href of PAGES) {
      await openPage(page, href);
      await page.waitForLoadState("networkidle");
      expect(await textOnCanvas(page), `${viewport.width} ${href}`).toEqual([]);
    }
  });
}

test("pipeline : le voile serré d'un en-tête de colonne n'atteint jamais la colonne voisine", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, "agentA");
  await openPage(page, "/pipeline");

  const columns = await page.locator(ACTIVE_COLUMNS).evaluateAll((sections) =>
    sections.map((section) => {
      const veils = [...section.querySelectorAll<HTMLElement>("header .particle-veil")];
      return {
        stage: section.getAttribute("data-pipeline-column"),
        left: section.getBoundingClientRect().left,
        right: section.getBoundingClientRect().right,
        // Painted extent of each veil: its box grown by the ::before overflow.
        veils: veils.map((veil) => {
          const box = veil.getBoundingClientRect();
          const before = getComputedStyle(veil, "::before");
          return {
            tight: veil.classList.contains("particle-veil-tight"),
            left: box.left + Number.parseFloat(before.left),
            right: box.right - Number.parseFloat(before.right),
            top: box.top + Number.parseFloat(before.top),
          };
        }),
      };
    }),
  );

  expect(columns).toHaveLength(6);
  for (const [index, column] of columns.entries()) {
    expect(column.veils.length, `${column.stage}: veiled header`).toBeGreaterThan(0);
    for (const veil of column.veils) {
      expect(veil.tight, `${column.stage}: tight veil`).toBe(true);
      const previous = columns[index - 1];
      const next = columns[index + 1];
      if (previous) expect(veil.left, `${column.stage}: clear of ${previous.stage}`).toBeGreaterThan(previous.right);
      if (next) expect(veil.right, `${column.stage}: clear of ${next.stage}`).toBeLessThan(next.left);
    }
  }

  // The connector line of a column (the row above the words) stays outside the veil of its words.
  const clearOfLine = await page.locator(ACTIVE_COLUMNS).evaluateAll((sections) =>
    sections.every((section) => {
      const words = section.querySelector<HTMLElement>("header > .particle-veil");
      const lineRow = section.querySelector<HTMLElement>("header > div:first-child");
      if (!words || !lineRow) return false;
      const top = words.getBoundingClientRect().top + Number.parseFloat(getComputedStyle(words, "::before").top);
      return top > lineRow.getBoundingClientRect().bottom;
    }),
  );
  expect(clearOfLine).toBe(true);
});
