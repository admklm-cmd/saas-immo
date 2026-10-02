import { expect, test, type Page } from "@playwright/test";

import { HERO_TITLE } from "@/components/landing-texts";

import { centerSection, instrumentPage, rafCalls } from "./helpers/landing-network";

/**
 * « Aucune boucle » on the whole landing (docs/design-system.md §2.11.1 rule 1,
 * §2.11.7 n° 1; plan T7): motion allowed, pointer never on the page. 7 s
 * after the load, and 5 s after each section is brought to the middle of the
 * screen: no requestAnimationFrame call for 2 s, two full-viewport captures
 * 1 s apart identical to the pixel, the network frame counter unchanged, no
 * impulse in flight, and no infinite animation running on the page.
 *
 * Single exception (docs/design-system.md §2.11.8.1 n° 3, §2.11.8.6): block A
 * of the hero loops on purpose. It is the ONLY element carrying
 * `data-loop="allowed"`; the captures mask it, while the
 * requestAnimationFrame counter (block A uses none) and the list of infinite
 * animations (block A has none) stay required at zero / empty. Off screen it
 * pauses: with the problem section in the middle, it is `paused`.
 */

const COLD_START = 60_000;
const SECTIONS = ["probleme", "solution", "agents", "controle", "resultat", "final"] as const;

async function expectNothingMoves(page: Page, label: string): Promise<void> {
  const network = page.getByTestId("living-background");
  const calls = await rafCalls(page);
  const frames = await network.getAttribute("data-frames");
  const mask = [page.locator("[data-loop='allowed']")];
  const first = await page.screenshot({ animations: "allow", mask });
  await page.waitForTimeout(1_000);
  const second = await page.screenshot({ animations: "allow", mask });
  await page.waitForTimeout(1_000);
  expect(await rafCalls(page), `${label}: requestAnimationFrame calls in 2 s`).toBe(calls);
  expect(first.equals(second), `${label}: two captures 1 s apart identical`).toBe(true);
  expect(await network.getAttribute("data-frames"), `${label}: network frames`).toBe(frames);
  await expect(network).toHaveAttribute("data-signals", "0");
  await expect(network).toHaveAttribute("data-lit", "0");
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
    test(`${viewport.width} px : immobile 7 s après le chargement, puis 5 s après chaque section`, async ({ page }) => {
      test.setTimeout(240_000);
      await instrumentPage(page);
      await page.setViewportSize(viewport);
      const response = await page.goto("/");
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1, name: HERO_TITLE })).toBeVisible({ timeout: COLD_START });

      // One element only may loop: block A of the hero.
      await expect(page.locator("[data-loop]")).toHaveCount(1);
      await expect(page.locator("[data-loop='allowed']")).toHaveAttribute("data-testid", "hero-ecosystem");

      await page.waitForTimeout(7_000);
      await expectNothingMoves(page, "chargement + 7 s");

      for (const scene of SECTIONS) {
        await centerSection(page, scene);
        if (scene === "probleme") {
          // Block A off screen: paused within a second.
          await expect(page.getByTestId("hero-ecosystem")).toHaveAttribute("data-loop-state", "paused", { timeout: 1_000 });
        }
        await page.waitForTimeout(5_000);
        await expectNothingMoves(page, `${scene} + 5 s`);
      }
    });
  }
});
