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
const AGENTS = LANDING_TEXTS.agents;
const PROBLEM = LANDING_TEXTS.problem;

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

test("carrousel des agents : sept étapes, clic sur Hugo puis clavier et boutons", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openHome(page);
  const carousel = page.getByTestId("agents-carousel");
  await carousel.scrollIntoViewIfNeeded();

  const tabs = carousel.getByRole("tab");
  await expect(tabs).toHaveCount(AGENTS.steps.length);
  await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
  const panel = carousel.getByRole("tabpanel");
  await expect(panel.getByTestId("agent-scene")).toHaveAttribute("data-step", "lea");

  // Click on Hugo: his scene, labelled as a fictitious simulation, with the missing information flagged.
  await carousel.getByRole("tab", { name: /Hugo/ }).click();
  await expect(panel.getByTestId("agent-scene")).toHaveAttribute("data-step", "hugo");
  await expect(panel.getByTestId("agent-scene")).toBeVisible();
  await expect(panel).toContainText(AGENTS.scenes.hugo.title);
  await expect(panel.getByTestId("agent-scene-label")).toContainText(AGENTS.carousel.sceneBadge);
  await expect(panel.getByTestId("agent-scene-label")).toContainText("Simulation");
  await expect(panel.getByTestId("hugo-missing")).toContainText(AGENTS.scenes.hugo.missing);

  // Keyboard: the arrows move the selection and the focus (roving tabindex).
  await page.keyboard.press("ArrowRight");
  await expect(carousel.getByRole("tab", { name: /Emma/ })).toBeFocused();
  await expect(panel.getByTestId("agent-scene")).toHaveAttribute("data-step", "emma");
  await page.keyboard.press("ArrowRight");
  await expect(panel.getByTestId("agent-scene")).toHaveAttribute("data-step", "review");
  await expect(carousel.getByRole("tab", { name: /Validation humaine/ })).toHaveAttribute("data-kind", "human");

  // Next / previous buttons, inert at the end.
  const next = carousel.getByRole("button", { name: AGENTS.carousel.next });
  for (const key of ["louis", "sarah", "mandate"]) {
    await next.click();
    await expect(panel.getByTestId("agent-scene")).toHaveAttribute("data-step", key);
  }
  await expect(next).toHaveAttribute("aria-disabled", "true");
  const lastTab = carousel.getByRole("tab", { name: /Mandat/ });
  await expect(lastTab).toBeInViewport();
  await carousel.getByRole("button", { name: AGENTS.carousel.previous }).click();
  await expect(panel.getByTestId("agent-scene")).toHaveAttribute("data-step", "sarah");
});

test("carrousel sur mobile (390 px) : défilement horizontal interne, page sans débordement", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openHome(page);
  const tablist = page.getByTestId("agents-tablist");
  await tablist.scrollIntoViewIfNeeded();
  const overflow = await tablist.evaluate((element) => element.scrollWidth > element.clientWidth);
  expect(overflow).toBe(true);
  const pageOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(pageOverflow).toBe(false);
  await page.getByRole("tab", { name: /Louis/ }).click();
  await expect(page.getByTestId("agents-panel").getByTestId("agent-scene")).toHaveAttribute("data-step", "louis");
});

test("graphique « blocage administratif » : étiquette fictive, aucun chiffre, description accessible", async ({ page }) => {
  await openHome(page);
  const section = page.locator("section[data-living-scene='probleme']");
  await expect(section.getByRole("heading", { level: 2, name: PROBLEM.title })).toBeVisible();
  const chart = section.getByTestId("blocker-chart");
  await chart.scrollIntoViewIfNeeded();
  await expect(chart).toBeVisible();
  await expect(chart.getByTestId("blocker-chart-label")).toHaveText(PROBLEM.chart.label);
  const svg = chart.getByRole("img");
  await expect(svg).toBeVisible();
  expect(await svg.textContent()).not.toMatch(/\d/);
  await expect(svg).toHaveAccessibleDescription(PROBLEM.chart.description);
  for (const symptom of PROBLEM.symptoms) await expect(section).toContainText(symptom.title);
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
  // Carousel: the first step and its scene are in the server HTML; the chart is complete.
  await expect(page.getByTestId("agents-panel").getByTestId("agent-scene")).toHaveAttribute("data-step", "lea");
  await expect(page.getByTestId("agents-panel")).toContainText(AGENTS.carousel.sceneBadge);
  await expect(page.getByTestId("blocker-chart-label")).toHaveText(PROBLEM.chart.label);
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

  test("le réseau des sections problème et agents reste sous 4 ms par image", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    const canvas = page.getByTestId("living-background");
    await expect(canvas).toHaveAttribute("data-motion", "running");

    for (const scene of ["probleme", "agents"] as const) {
      // Put the section across the middle of the screen, like a reader would.
      await page.locator(`section[data-living-scene='${scene}']`).evaluate((section) => {
        window.scrollTo(0, section.getBoundingClientRect().top + window.scrollY + 120);
      });
      await expect(canvas).toHaveAttribute("data-scene", scene, { timeout: 10_000 });
      await expect(canvas).toHaveAttribute("data-motion", "running");
      // data-frame-ms is the average cost of a frame over the last 2 s window.
      // Skip the window running during the scroll, then read one measured
      // entirely in this scene.
      for (let pass = 0; pass < 2; pass++) {
        await canvas.evaluate((element) => {
          delete (element as HTMLCanvasElement).dataset.frameMs;
        });
        await expect.poll(async () => canvas.getAttribute("data-frame-ms"), { timeout: 10_000 }).not.toBeNull();
      }
      const cost = Number(await canvas.getAttribute("data-frame-ms"));
      test.info().annotations.push({ type: `data-frame-ms ${scene}`, description: String(cost) });
      expect(cost).toBeGreaterThan(0);
      expect(cost).toBeLessThan(4);
    }
  });
});
