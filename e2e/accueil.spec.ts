import { expect, test, type Page } from "@playwright/test";

import { HERO_TITLE, LANDING_TEXTS } from "@/components/landing-texts";
import { LIVING_SCENES } from "@/components/landing/living/scenes";

/**
 * Public home page: the hero (title revealed line then word, tilted tag, black
 * then light action), the fictitious journey labelled as a simulation, and the
 * « fond vivant » that follows the section in view.
 *
 * The suite runs in reduced motion (playwright.config.ts): everything is in its
 * final state at once. One group opts back into real motion to check that the
 * background really runs, follows the sections and can be paused.
 */

const COLD_START = 60_000;
const HERO = LANDING_TEXTS.hero;
const JOURNEY = LANDING_TEXTS.journey;

async function openHome(page: Page): Promise<void> {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: HERO_TITLE })).toBeVisible({ timeout: COLD_START });
}

test("accueil : titre, étiquette, deux actions et parcours fictif étiqueté simulation", async ({ page }) => {
  await openHome(page);
  const main = page.locator("main");

  await expect(page.getByTestId("hero-tag")).toHaveText(HERO.tag);
  await expect(page.getByTestId("hero-tag")).toHaveCSS("text-transform", "uppercase");

  const hero = page.locator("section[data-living-scene='hero']");
  const estimation = hero.getByRole("link", { name: LANDING_TEXTS.actions.estimation });
  const signIn = hero.getByRole("link", { name: LANDING_TEXTS.actions.signIn });
  await expect(estimation).toHaveAttribute("href", "/estimation");
  await expect(signIn).toHaveAttribute("href", "/connexion");

  // The illustration says what it is, with the Simulation badge next to it.
  const journey = page.getByTestId("hero-journey");
  await expect(journey.getByTestId("hero-journey-label")).toContainText(JOURNEY.badge);
  await expect(journey.getByTestId("hero-journey-label")).toContainText("Simulation");
  await expect(main).toContainText(HERO.illustrationNote);

  // Reduced motion: the final state at once, nothing to pause.
  const steps = journey.getByRole("listitem");
  await expect(steps).toHaveCount(JOURNEY.steps.length);
  for (const step of await steps.all()) await expect(step).toHaveAttribute("data-state", "done");
  await expect(page.getByTestId("landing-motion-toggle")).toHaveCount(0);
  await expect(page.getByTestId("living-background")).toHaveAttribute("data-motion", "reduced");

  // One background scene per section, and nothing invented on the page.
  const scenes = await page.locator("[data-living-scene]").evaluateAll((sections) =>
    sections.map((section) => section.getAttribute("data-living-scene")),
  );
  expect(scenes).toEqual([...LIVING_SCENES]);
  await expect(main).not.toContainText(/\d\s?%|€|témoignage/i);
  // No floating contact button: no real channel is configured.
  await expect(page.getByRole("link", { name: /whatsapp|nous contacter/i })).toHaveCount(0);
});

test("cas dégradé : sans JavaScript, tout le contenu reste lisible", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await openHome(page);
  await expect(page.getByTestId("hero-tag")).toBeVisible();
  await expect(page.getByTestId("hero-journey")).toContainText(JOURNEY.badge);
  for (const step of await page.getByTestId("hero-journey").getByRole("listitem").all()) {
    await expect(step).toHaveAttribute("data-state", "done");
  }
  await expect(page.getByRole("heading", { level: 2, name: LANDING_TEXTS.control.title })).toBeVisible();
  await expect(page.locator("section[data-living-scene='final']").getByRole("link", { name: LANDING_TEXTS.actions.estimation })).toBeVisible();
  await context.close();
});

test("cas d'erreur : une adresse inconnue du site public répond 404, sans fond animé", async ({ page }) => {
  const response = await page.goto("/cette-page-n-existe-pas");
  expect(response?.status()).toBe(404);
  await expect(page.getByTestId("living-background")).toHaveCount(0);
});

test.describe("avec animations", () => {
  test.use({ reducedMotion: "no-preference" });

  test("le fond vivant tourne, suit la section visible et se met en pause", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    const canvas = page.getByTestId("living-background");
    await expect(canvas).toHaveAttribute("data-motion", "running");
    await expect(canvas).toHaveAttribute("data-scene", "hero");

    // Respects the device pixel ratio (capped), never a blurry or oversized buffer.
    const ratio = await canvas.evaluate((element) => {
      const node = element as HTMLCanvasElement;
      return node.width / node.clientWidth;
    });
    expect(ratio).toBeGreaterThanOrEqual(1);
    expect(ratio).toBeLessThanOrEqual(2);

    await page.locator("section[data-living-scene='controle']").scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 200);
    await expect(canvas).toHaveAttribute("data-scene", "controle", { timeout: 10_000 });

    // WCAG 2.2.2: one switch pauses the illustrations; the loop really stops.
    await page.evaluate(() => window.scrollTo(0, 0));
    const toggle = page.getByTestId("landing-motion-toggle");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(canvas).toHaveAttribute("data-motion", "hidden");
    await toggle.click();
    await expect(canvas).toHaveAttribute("data-motion", "running");
  });
});
