import { expect, test, type Page } from "@playwright/test";

import { HERO_TITLE } from "@/components/landing-texts";

import { centerSection, contrastFailures, measureContrast, type LineContrast } from "./helpers/landing-network";

/**
 * Contrast of every text posed outside a card on the landing (docs/design-system.md
 * §2.11.4, criterion (i) of the former e2e/landing-reseau.spec.ts, kept when the
 * invisible network canvas was removed — §2.11.4 bis B): small text ≥ 4.5:1 at
 * its darkest pixel, ink titles ≥ 7:1, subtle title lines ≥ 3:1 (darkest) and
 * ≥ 4.5:1 (median). Measured over the still hand-off, the veils and, in the
 * hero, the nanorobots and the terminal (§2.11.4 bis, C15).
 */

const COLD_START = 60_000;
const SECTIONS = ["probleme", "solution", "agents", "controle", "resultat", "final"] as const;

async function openHome(page: Page): Promise<void> {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: HERO_TITLE })).toBeVisible({ timeout: COLD_START });
}

/** The problem section at the top of the viewport: the worst pose measured for its subtle lines. */
async function topSection(page: Page, scene: string): Promise<void> {
  await page.locator(`section[data-living-scene='${scene}']`).evaluate((section) => section.scrollIntoView({ block: "start", behavior: "instant" }));
}

test.describe("avec animations", () => {
  test.use({ reducedMotion: "no-preference" });

  test("(i) contraste des textes hors carte : pendant l'arrivée et au repos, 1440 et 390", async ({ page }) => {
    test.setTimeout(240_000);
    const report: string[] = [];
    let worst: Record<string, number> = {};
    const record = (label: string, results: LineContrast[]) => {
      for (const line of results) {
        worst[line.role] = Math.min(worst[line.role] ?? Infinity, line.darkest);
        if (line.role === "title-subtle") worst["title-subtle-median"] = Math.min(worst["title-subtle-median"] ?? Infinity, line.median);
      }
      report.push(...contrastFailures(results).map((failure) => `${label}: ${failure}`));
    };

    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
    ]) {
      worst = {};
      await page.setViewportSize(viewport);
      await openHome(page);
      // During the arrival (title, terminal typing, first exchanges), then once the terminal is done.
      for (const instant of [1_400, 4_400, 13_000]) {
        await page.waitForTimeout(instant === 1_400 ? 1_400 : instant === 4_400 ? 3_000 : 8_600);
        record(`${viewport.width} hero +${instant}`, await measureContrast(page));
      }
      for (const scene of SECTIONS) {
        await centerSection(page, scene);
        // Section reveals and title effects end within 2.5 s.
        await page.waitForTimeout(2_600);
        record(`${viewport.width} ${scene}`, await measureContrast(page));
      }
      await topSection(page, "probleme");
      await page.waitForTimeout(900);
      record(`${viewport.width} probleme en haut`, await measureContrast(page));
      test.info().annotations.push({
        type: `contraste minimal ${viewport.width}`,
        description: Object.entries(worst)
          .map(([role, value]) => `${role} ${value.toFixed(2)}`)
          .join(" · "),
      });
    }
    expect(report).toEqual([]);
  });
});

test("(i) mouvement réduit : contraste du titre « problème » amené en haut de la fenêtre, 1440 et 390", async ({ page }) => {
  test.setTimeout(120_000);
  const report: string[] = [];
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await openHome(page);
    await expect(page.getByTestId("hero-nanorobots")).toHaveAttribute("data-loop-state", "reduced");
    await topSection(page, "probleme");
    await page.waitForTimeout(600);
    const results = await measureContrast(page);
    const subtle = results.filter((line) => line.role === "title-subtle");
    expect(subtle.length, "subtle lines measured").toBeGreaterThan(0);
    test.info().annotations.push({
      type: `contraste lignes grises réduit ${viewport.width}`,
      description: `min ${Math.min(...subtle.map((line) => line.darkest)).toFixed(2)} · médian ${Math.min(...subtle.map((line) => line.median)).toFixed(2)}`,
    });
    report.push(...contrastFailures(results).map((failure) => `${viewport.width} réduit: ${failure}`));
  }
  expect(report).toEqual([]);
});
