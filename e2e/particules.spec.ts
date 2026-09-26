import { expect, test, type Page } from "@playwright/test";

import { presetForPath } from "@/components/motion/route-presets";
import { APP_TEXTS } from "@/components/texts";

import { signIn } from "./helpers/sign-in";

/**
 * Full-page particle background of the signed-in space
 * (docs/plans/2026-09-23-particles-spec.md §5, §6, §9; docs/design-system.md §2.5.8).
 *
 * One decorative canvas, fixed behind the content, persistent across
 * navigations, driven by the route. It must never get in the way: no extra
 * canvas, no console error, every control clickable above it, and nothing at
 * all on the public site. Its state is read from the data-* attributes the
 * engine mirrors on the canvas (data-mode, data-count, data-motion, data-preset).
 *
 * The suite runs in reduced motion by default (playwright.config.ts): tests
 * that exercise a real transition opt back in with `reducedMotion: "no-preference"`.
 */

const COLD_START = 60_000;
const BACKGROUND = 'canvas[data-mode="background"]';
const NAV = APP_TEXTS.nav;
const BUDGET = { 1440: 6_000, 1024: 4_000, 390: 1_800 } as const;

const APP_PAGES = [
  "/dashboard",
  "/contacts",
  "/pipeline",
  "/taches",
  "/rendez-vous",
  "/agents-ia",
  "/agents-ia/leads-entrants",
  "/agents-ia/relances",
  "/agents-ia/a-valider",
  "/agents-ia/suivi-rendez-vous",
  "/parametres",
];

test.beforeEach(() => {
  test.setTimeout(240_000);
});

function primaryNav(page: Page) {
  return page.getByRole("navigation", { name: NAV.primaryLabel });
}

async function openPage(page: Page, href: string): Promise<void> {
  await page.goto(href);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: COLD_START });
}

/** Records every change of data-motion / data-preset of the background canvas. */
async function recordMotion(page: Page): Promise<void> {
  await page.evaluate((selector) => {
    const canvas = document.querySelector<HTMLCanvasElement>(selector);
    if (!canvas) throw new Error("no background canvas");
    const log: string[] = [];
    (window as unknown as { __motion: string[] }).__motion = log;
    new MutationObserver(() => log.push(`${canvas.dataset.motion}:${canvas.dataset.preset}`)).observe(canvas, {
      attributes: true,
      attributeFilter: ["data-motion", "data-preset"],
    });
  }, BACKGROUND);
}

function motionLog(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __motion: string[] }).__motion);
}

/** Tags the canvas element: the tag survives only if the element is never remounted. */
async function tagCanvas(page: Page): Promise<void> {
  await page.locator(BACKGROUND).evaluate((canvas) => {
    (canvas as HTMLCanvasElement & { __tag?: string }).__tag = "persistent";
  });
}

async function canvasTag(page: Page): Promise<string | undefined> {
  return page.locator(BACKGROUND).evaluate((canvas) => (canvas as HTMLCanvasElement & { __tag?: string }).__tag);
}

test("chaque page connectée a un seul fond de particules, décoratif, avec le budget du bureau large", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, "agentA");
  const record = await page.locator('a[href^="/contacts/"]').first().getAttribute("href");
  expect(record).toBeTruthy();

  for (const href of [...APP_PAGES, record!]) {
    await openPage(page, href);
    await expect(page.locator("canvas"), `${href}: one canvas`).toHaveCount(1);
    const canvas = page.locator(BACKGROUND);
    await expect(canvas, `${href}: background mode`).toHaveAttribute("aria-hidden", "true");
    await expect(canvas).toHaveAttribute("data-count", String(BUDGET[1440]));
    await expect(canvas).toHaveAttribute("data-preset", presetForPath(href));
    // Reduced motion: one static representative frame, no loop.
    await expect(canvas).toHaveAttribute("data-motion", "reduced");
    const style = await canvas.evaluate((node) => {
      const computed = getComputedStyle(node);
      return { position: computed.position, pointerEvents: computed.pointerEvents };
    });
    expect(style).toEqual({ position: "fixed", pointerEvents: "none" });
    // Decorative only: no label that could suggest an agent at work.
    await expect(canvas).not.toHaveAttribute("aria-label", /.+/);
  }
});

for (const width of [1024, 390] as const) {
  test(`le budget de particules suit la largeur de la fenêtre (${width} px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await signIn(page, "agentA");
    await openPage(page, "/dashboard");
    await expect(page.locator(BACKGROUND)).toHaveAttribute("data-count", String(BUDGET[width]));
    await expect(page.locator("canvas")).toHaveCount(1);
    // Neither the canvas nor the text veils shift the layout or add a horizontal scroll.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });
}

test("le fond couvre toute la fenêtre, sans masque latéral, avec de la matière à gauche comme à droite", async ({
  page,
}) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1024, height: 844 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    if (viewport.width === 1440) await signIn(page, "agentA");
    await openPage(page, "/dashboard");
    const canvas = page.locator(BACKGROUND);
    await expect(canvas).toHaveAttribute("data-motion", "reduced");

    // Full viewport, and the old left-side veil (`.app-particles` mask) is gone.
    const geometry = await canvas.evaluate((node) => {
      const box = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return {
        width: Math.round(box.width),
        height: Math.round(box.height),
        mask: style.maskImage || style.getPropertyValue("-webkit-mask-image"),
      };
    });
    expect(geometry.width, `${viewport.width}: width`).toBe(viewport.width);
    expect(geometry.height, `${viewport.width}: height`).toBe(viewport.height);
    expect(geometry.mask === "" || geometry.mask === "none", `${viewport.width}: no mask`).toBe(true);

    // The static frame (reduced motion) has ink in the left, middle and right thirds.
    const inkPerThird = await canvas.evaluate((node) => {
      const canvasNode = node as HTMLCanvasElement;
      const context = canvasNode.getContext("2d");
      if (!context) return [0, 0, 0];
      const { width, height } = canvasNode;
      const data = context.getImageData(0, 0, width, height).data;
      const thirds = [0, 0, 0];
      for (let y = 0; y < height; y += 4) {
        for (let x = 0; x < width; x += 4) {
          const alpha = data[(y * width + x) * 4 + 3] ?? 0;
          if (alpha > 0) thirds[Math.min(2, Math.floor((x / width) * 3))]! += 1;
        }
      }
      return thirds;
    });
    for (const [index, ink] of inkPerThird.entries()) {
      expect(ink, `${viewport.width}: ink in third ${index + 1}`).toBeGreaterThan(0);
    }
  }
});

test("aucun canvas de particules sur le site public", async ({ page }) => {
  for (const href of ["/", "/estimation", "/connexion", "/inscription"]) {
    await page.goto(href);
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("h1").first()).toBeVisible({ timeout: COLD_START });
    await expect(page.locator(BACKGROUND), `${href}: no particle canvas`).toHaveCount(0);
    // The home page has its own illustrative « fond vivant » (e2e/accueil.spec.ts),
    // and nothing else; the other public pages have no canvas at all.
    const expected = href === "/" ? 1 : 0;
    await expect(page.locator("canvas"), `${href}: canvas count`).toHaveCount(expected);
    if (expected) await expect(page.getByTestId("living-background")).toHaveCount(1);
  }
});

test.describe("avec animations", () => {
  test.use({ reducedMotion: "no-preference" });

  test("un clic dans le menu déclenche la transition, sans remonter le canvas", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page, "agentA");
    // Warm the target route: the dev server compiles it on first hit.
    await openPage(page, "/pipeline");
    await openPage(page, "/contacts");
    const canvas = page.locator(BACKGROUND);
    await expect(canvas).toHaveAttribute("data-motion", "running");
    await tagCanvas(page);
    await recordMotion(page);

    await primaryNav(page).getByRole("link", { name: NAV.pipeline, exact: true }).click();
    await expect(page).toHaveURL(/\/pipeline$/);
    await expect(page.getByRole("heading", { level: 1, name: APP_TEXTS.pipeline.title })).toBeVisible({
      timeout: COLD_START,
    });
    await expect(canvas).toHaveAttribute("data-preset", "current");
    // The morph lasts 700–1 000 ms, then the loop of the new shape runs.
    await expect.poll(() => motionLog(page)).toContain("transition:current");
    await expect(canvas).toHaveAttribute("data-motion", "running", { timeout: 5_000 });
    expect(await canvasTag(page)).toBe("persistent");
    await expect(page.locator("canvas")).toHaveCount(1);
  });

  test("navigation rapide, précédent et suivant : un seul canvas, aucune erreur console", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page, "agentA");
    for (const href of ["/dashboard", "/pipeline", "/agents-ia", "/parametres"]) await openPage(page, href);
    await openPage(page, "/contacts");
    await tagCanvas(page);

    // Four menu entries in a row, without waiting for any page to settle.
    const nav = primaryNav(page);
    for (const label of [NAV.dashboard, NAV.pipeline, NAV.agentsOverview, NAV.settings]) {
      await nav.getByRole("link", { name: label, exact: true }).click();
    }
    await expect(page).toHaveURL(/\/parametres$/, { timeout: COLD_START });
    const canvas = page.locator(BACKGROUND);
    await expect(canvas).toHaveAttribute("data-preset", "grid");

    // Interrupted navigations leave no history entry: « précédent » returns to
    // the last page that was really displayed. The shape follows that URL.
    await page.goBack();
    await expect(page).not.toHaveURL(/\/parametres$/, { timeout: COLD_START });
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: COLD_START });
    const previous = new URL(page.url()).pathname;
    await expect(canvas).toHaveAttribute("data-preset", presetForPath(previous));
    expect(presetForPath(previous)).not.toBe("grid");
    await page.goForward();
    await expect(page).toHaveURL(/\/parametres$/, { timeout: COLD_START });
    await expect(canvas).toHaveAttribute("data-preset", "grid");

    await expect(canvas).toHaveAttribute("data-motion", "running", { timeout: 5_000 });
    await expect(page.locator("canvas")).toHaveCount(1);
    expect(await canvasTag(page)).toBe("persistent");
    expect(errors).toEqual([]);
  });

  test("les contrôles restent cliquables au-dessus du fond (bouton, menu, lien)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page, "agentA");
    await openPage(page, "/pipeline");
    await expect(page.locator(BACKGROUND)).toHaveAttribute("data-motion", /running|transition/);

    // Nothing in the page is covered by the canvas, even where the shape is drawn.
    const hits = await page.evaluate(() =>
      [
        [0.75, 0.2],
        [0.9, 0.35],
        [0.6, 0.5],
        [0.1, 0.3],
      ].map(([x, y]) => document.elementFromPoint(innerWidth * x!, innerHeight * y!)?.tagName ?? null),
    );
    expect(hits).not.toContain("CANVAS");

    // A button: the stage menu of a card of the right-hand column, under the shape.
    const trigger = page
      .getByTestId("pipeline-contact")
      .getByRole("button", { name: new RegExp(APP_TEXTS.pipeline.stageChange.trigger) })
      .last();
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");

    // A link of the page, then an entry of the menu.
    await openPage(page, "/taches");
    await page
      .getByRole("navigation", { name: APP_TEXTS.tasks.filtersLabel })
      .getByRole("link", { name: APP_TEXTS.tasks.filters.overdue })
      .click();
    await expect(page).toHaveURL(/\/taches\?.+/);
    await primaryNav(page).getByRole("link", { name: NAV.settings, exact: true }).click();
    await expect(page).toHaveURL(/\/parametres$/, { timeout: COLD_START });
  });
});
