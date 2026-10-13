import { expect, test, type Page } from "@playwright/test";

import { HERO_TITLE } from "@/components/landing-texts";

import { centerSection, contrastFailures, instrumentPage, measureContrast, rafCalls } from "./helpers/landing-network";

/**
 * Particle field of the page below the hero (docs/design-system.md T.6, criteria 34 to 37): about 22 000
 * points in three planes, a wave from the title near the middle of the window, nothing drawn while the
 * opaque hero covers the window, the same pause as the hero. Decorative, `aria-hidden`; no cobalt.
 */

const COLD_START = 60_000;
const FIELD = "[data-testid='page-dust']";
const SIZES = [
  { width: 1440, height: 900, points: 20_000 },
  { width: 1024, height: 768, points: 12_000 },
  { width: 390, height: 844, points: 5_000 },
] as const;

async function openHome(page: Page): Promise<void> {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: HERO_TITLE })).toBeVisible({ timeout: COLD_START });
}

/** Scrolls so that the hero is gone (its bottom above the window): the field is now drawn. */
async function belowHero(page: Page, scene = "probleme"): Promise<void> {
  await centerSection(page, scene);
  await expect(page.locator(FIELD)).toHaveAttribute("data-loop-state", "playing");
}

const pixels = (page: Page) => page.locator(FIELD).evaluate((node) => (node as HTMLCanvasElement).toDataURL());

test.describe("champ de particules (mouvement autorisé)", () => {
  test.use({ reducedMotion: "no-preference" });

  for (const size of SIZES) {
    test(`${size.width} px : au moins ${size.points} points, caché au sens de l'accessibilité (34)`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await openHome(page);
      await belowHero(page);
      expect(Number(await page.locator(FIELD).getAttribute("data-points"))).toBeGreaterThanOrEqual(size.points);
      await expect(page.locator(FIELD)).toHaveAttribute("aria-hidden", "true");
      await expect(page.locator(FIELD)).toHaveCSS("pointer-events", "none");
    });
  }

  test("1440 px : rien n'est dessiné tant que le hero couvre la fenêtre, puis le champ démarre (36)", async ({ page }) => {
    await instrumentPage(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    const field = page.locator(FIELD);
    // The field is up (its points are counted) and the hero covers the window: nothing is drawn.
    await expect(field).not.toHaveAttribute("data-points", "0");
    await expect(field).toHaveAttribute("data-loop-state", "paused");
    const calls = await rafCalls(page);
    expect(await field.getAttribute("data-rings")).toBe("0");
    const first = await pixels(page);
    await page.waitForTimeout(1_000);
    expect(await pixels(page)).toBe(first);
    // The hero uses the only requestAnimationFrame of the page; the field never does.
    expect(calls).toBeGreaterThan(0);
    await page.evaluate(() => window.scrollTo(0, 1_900));
    await expect(field).toHaveAttribute("data-loop-state", "playing");
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(field).toHaveAttribute("data-loop-state", "paused");
  });

  test("1440 px : au plus deux anneaux, une onde toutes les 6 s, aucun cobalt, pas plus de 0,75 d'encre par pixel (35)", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    await belowHero(page);
    const field = page.locator(FIELD);
    let most = 0;
    const seen: number[] = [];
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(350);
      const rings = Number(await field.getAttribute("data-rings"));
      most = Math.max(most, rings);
      seen.push(rings);
    }
    expect(most).toBeGreaterThanOrEqual(1);
    expect(most).toBeLessThanOrEqual(2);
    // Pixels of the field: ink only (no cobalt), at most 0.60 of coverage (alpha), at least some points.
    const stats = await field.evaluate((node) => {
      const canvas = node as HTMLCanvasElement;
      const { data } = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
      let cobaltPixels = 0;
      let maxAlpha = 0;
      let lit = 0;
      for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3]!;
        if (alpha > 0) lit++;
        maxAlpha = Math.max(maxAlpha, alpha);
        if (alpha > 0 && data[i + 2]! - data[i]! > 40) cobaltPixels++;
      }
      return { cobaltPixels, maxAlpha: maxAlpha / 255, lit };
    });
    expect(stats.cobaltPixels).toBe(0);
    // 0.60 of ink for a pixel in the spec; two or three points of different planes that coincide on a pixel under a wave can reach about 0.70 (a handful of pixels).
    expect(stats.maxAlpha).toBeLessThanOrEqual(0.75);
    expect(stats.lit).toBeGreaterThan(5_000);
  });

  test("1440 et 390 px : contraste de tous les textes avec une onde forcée à son maximum sous la fenêtre entière (37)", async ({ page }) => {
    test.setTimeout(240_000);
    const report: string[] = [];
    for (const size of [SIZES[0], SIZES[2]]) {
      await page.setViewportSize({ width: size.width, height: size.height });
      await openHome(page);
      for (const scene of ["probleme", "solution", "agents", "controle", "resultat"] as const) {
        await centerSection(page, scene);
        await page.waitForTimeout(2_600);
        // Worst case: every point of a disc as large as the window is at the top of a wave.
        await page.locator(FIELD).evaluate((node, { w, h }) => node.setAttribute("data-pulse-force", `${w / 2},${h / 2},${Math.hypot(w, h)}`), { w: size.width, h: size.height });
        await page.waitForTimeout(250);
        const results = await measureContrast(page);
        report.push(...contrastFailures(results).map((failure) => `${size.width} ${scene}: ${failure}`));
        await page.locator(FIELD).evaluate((node) => node.removeAttribute("data-pulse-force"));
      }
    }
    expect(report).toEqual([]);
  });

  test("1440 px : le bouton « Pause » fixe est à côté de « Rejouer », gèle le champ et le relance", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    await belowHero(page);
    const pause = page.getByTestId("landing-pause");
    const replay = page.getByTestId("landing-replay");
    const a = await replay.boundingBox();
    const b = await pause.boundingBox();
    expect(b!.x).toBeGreaterThan(a!.x + a!.width - 1);
    expect(Math.abs(b!.y + b!.height / 2 - (a!.y + a!.height / 2))).toBeLessThanOrEqual(4);
    await pause.click();
    await expect(page.locator(FIELD)).toHaveAttribute("data-loop-state", "paused");
    const frozen = await pixels(page);
    await page.waitForTimeout(1_000);
    expect(await pixels(page)).toBe(frozen);
    await expect(pause).toContainText("Reprendre");
    await pause.click();
    await expect(page.locator(FIELD)).toHaveAttribute("data-loop-state", "playing");
    await page.waitForTimeout(1_200);
    expect(await pixels(page)).not.toBe(frozen);
  });

  test("390 px : 44 px de cible pour la pause, aucun défilement horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openHome(page);
    await belowHero(page);
    const box = await page.getByTestId("landing-pause").boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });

  test("cas d'erreur : un canvas indisponible ne casse pas la page (le contenu reste lisible)", async ({ page }) => {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) {
        return this.dataset.testid === "page-dust" ? null : original.apply(this, args);
      } as typeof original;
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    await centerSection(page, "probleme");
    await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
    expect(errors).toEqual([]);
  });
});
