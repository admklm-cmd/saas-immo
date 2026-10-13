import { expect, test, type Page } from "@playwright/test";

import { HERO_TITLE } from "@/components/landing-texts";

import { centerSection, instrumentPage, rafCalls } from "./helpers/landing-network";

/**
 * « Aucune boucle » on the whole landing (docs/design-system.md §2.11.1 rule 1,
 * §2.11.7 n° 1; plan T7): motion allowed, pointer never on the page. After
 * the load, and 5 s after each section is brought to the middle of the
 * screen: two full-viewport captures 1 s apart identical to the pixel, no
 * infinite animation running on the page and, once the hero is off screen, no
 * requestAnimationFrame call for 2 s.
 *
 * Three exceptions (docs/design-system.md §2.11.8.1 n° 3, §2.11.4 ter M), the
 * only elements carrying `data-loop="allowed"`, masked in the captures:
 * - the dust of the page (`page-dust`): a slow 30 frames/s timer, never
 *   requestAnimationFrame;
 * - the particles of band 1 (`hero-particles`, own requestAnimationFrame loop):
 *   frames allowed while band 1 is on screen; off screen they pause, and the
 *   page requests no frame at all;
 * - block A of the hero (`hero-ecosystem`): CSS transitions and one timer,
 *   never requestAnimationFrame.
 * The terminal of the hero is not a loop: typed once, then still (C20: still
 * to the pixel between 16 s and 18 s).
 */

const COLD_START = 60_000;
const SECTIONS = ["probleme", "solution", "agents", "controle", "resultat", "final"] as const;
const HIDE_PARTICLES = "[data-testid='hero-particles'], [data-testid='page-dust'] { visibility: hidden !important; }";

async function expectNothingMoves(page: Page, label: string, options: { heroOnScreen: boolean }): Promise<void> {
  const calls = await rafCalls(page);
  const mask = [page.locator("[data-loop='allowed']")];
  const first = await page.screenshot({ animations: "allow", mask });
  await page.waitForTimeout(1_000);
  const second = await page.screenshot({ animations: "allow", mask });
  await page.waitForTimeout(1_000);
  if (!options.heroOnScreen) {
    // Off screen, the hero particles are paused: not a single frame requested by the page.
    await expect(page.getByTestId("hero-particles")).toHaveAttribute("data-state", "paused");
    expect(await rafCalls(page), `${label}: requestAnimationFrame calls in 2 s`).toBe(calls);
  }
  expect(first.equals(second), `${label}: two captures 1 s apart identical`).toBe(true);
  const infinite = await page.evaluate(() =>
    document
      .getAnimations()
      .filter((animation) => animation.playState === "running" && animation.effect?.getComputedTiming().iterations === Infinity)
      .map((animation) => (animation.effect as KeyframeEffect | null)?.target?.className?.toString() ?? "?"),
  );
  expect(infinite, `${label}: infinite animations`).toEqual([]);
}

test.describe("aucune boucle sur la page d'accueil", () => {
  test.use({ reducedMotion: "no-preference" });

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    test(`${viewport.width} px : immobile après le chargement (exceptions masquées), puis 5 s après chaque section`, async ({ page }) => {
      test.setTimeout(240_000);
      await instrumentPage(page);
      await page.setViewportSize(viewport);
      const response = await page.goto("/");
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1, name: HERO_TITLE })).toBeVisible({ timeout: COLD_START });

      // Three elements only may loop: the dust, the particles and block A of the hero.
      await expect(page.locator("[data-loop]")).toHaveCount(3);
      expect(await page.locator("[data-loop='allowed']").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-testid")))).toEqual([
        "page-dust",
        "hero-particles",
        "hero-ecosystem",
      ]);

      // The terminal is typed once (≈ 12.2 s), its cursor blinks three times (≈ 15.4 s), then nothing moves:
      // still to the pixel between 16 s and 18 s (C20), the particles hidden for the two captures.
      const terminal = page.getByTestId("hero-terminal");
      await page.waitForTimeout(16_000);
      await expect(terminal).toHaveAttribute("data-terminal-state", "done");
      const hide = await page.addStyleTag({ content: HIDE_PARTICLES });
      const at16 = await terminal.screenshot({ animations: "allow" });
      await page.waitForTimeout(2_000);
      const at18 = await terminal.screenshot({ animations: "allow" });
      await hide.evaluate((node) => (node as Element).remove());
      expect(at16.equals(at18), "terminal still between 16 s and 18 s").toBe(true);

      await expectNothingMoves(page, "chargement + 18 s", { heroOnScreen: true });

      for (const scene of SECTIONS) {
        await centerSection(page, scene);
        if (scene === "probleme") {
          // Block A and the hero particles off screen: paused within a second.
          await expect(page.getByTestId("hero-ecosystem")).toHaveAttribute("data-loop-state", "paused", { timeout: 1_000 });
          await expect(page.getByTestId("hero-particles")).toHaveAttribute("data-state", "paused", { timeout: 1_000 });
        }
        await page.waitForTimeout(5_000);
        await expectNothingMoves(page, `${scene} + 5 s`, { heroOnScreen: false });
      }
    });
  }
});
