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
 */

const COLD_START = 60_000;
const SECTIONS = ["probleme", "solution", "agents", "controle", "resultat", "final"] as const;

async function expectNothingMoves(page: Page, label: string): Promise<void> {
  const network = page.getByTestId("living-background");
  const calls = await rafCalls(page);
  const frames = await network.getAttribute("data-frames");
  const first = await page.screenshot({ animations: "allow" });
  await page.waitForTimeout(1_000);
  const second = await page.screenshot({ animations: "allow" });
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

      await page.waitForTimeout(7_000);
      await expectNothingMoves(page, "chargement + 7 s");

      for (const scene of SECTIONS) {
        await centerSection(page, scene);
        await page.waitForTimeout(5_000);
        await expectNothingMoves(page, `${scene} + 5 s`);
      }
    });
  }
});
