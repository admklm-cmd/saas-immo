import { expect, test, type Page } from "@playwright/test";

import { HERO_TITLE, LANDING_TEXTS } from "@/components/landing-texts";

import { centerSection, instrumentPage } from "./helpers/landing-network";

/**
 * « Rejouer les animations » (docs/design-system.md §2.11.8.8 L4-D, criteria
 * L4-D1 to L4-D4): a discreet fixed button that replays every arrival of `/`
 * without reloading nor moving the page; the living background is excluded;
 * values typed by the visitor are kept. Absent without JavaScript and under
 * reduced motion.
 *
 * No form on this journey: no consent checkbox to check.
 */

const COLD_START = 60_000;
const TEXTS = LANDING_TEXTS.replay;

async function openHome(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: HERO_TITLE })).toBeVisible({ timeout: COLD_START });
}

const generation = (page: Page) => page.locator("[data-landing]").getAttribute("data-replay-generation");
const roiStates = (page: Page) =>
  page.locator("[data-testid='roi'] [data-roi-state]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-roi-state")));

test.describe("bouton « Rejouer les animations » (mouvement autorisé)", () => {
  test.use({ reducedMotion: "no-preference" });

  test("L4-D1 : fixe en bas à gauche, nom accessible, pilule 36 px ≥ 640, rond 44 × 44 < 640, focus visible", async ({ page }) => {
    for (const viewport of [
      { width: 1440, height: 900, offset: 24 },
      { width: 390, height: 844, offset: 16 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openHome(page);
      const button = page.getByRole("button", { name: TEXTS.label });
      await expect(button).toBeVisible();
      await expect(button).toHaveAttribute("data-testid", "landing-replay");
      await expect(button).toHaveCSS("position", "fixed");
      const box = (await button.boundingBox())!;
      expect(Math.round(box.x)).toBe(viewport.offset);
      expect(Math.round(viewport.height - (box.y + box.height))).toBe(viewport.offset);
      if (viewport.width >= 640) {
        expect(Math.round(box.height)).toBe(36);
        await expect(button.getByText(TEXTS.label)).toBeVisible();
      } else {
        expect([Math.round(box.width), Math.round(box.height)]).toEqual([44, 44]);
      }
      await expect(button.locator("svg[data-icon='replay']")).toHaveCount(1);
      // The last focusable of the landing: Tab from the last control of the final panel lands on it.
      await button.focus();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      await expect(button).toBeFocused();
      await expect(button).toHaveCSS("outline-style", "solid");
      await expect(button).toHaveCSS("outline-color", "rgb(36, 87, 255)");
    }
  });

  test("L4-D2 : section ROI à l'écran — widgets réarmés puis rejoués, valeurs saisies gardées, génération + 1, défilement inchangé, réseau sans séquence", async ({ page }) => {
    test.setTimeout(90_000);
    await instrumentPage(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    const button = page.getByTestId("landing-replay");
    await expect(button).toBeVisible();
    await centerSection(page, "resultat");
    await page.locator("[data-testid='roi-grid']").evaluate((grid) => grid.scrollIntoView({ block: "center", behavior: "instant" }));
    await expect.poll(() => roiStates(page), { timeout: 6_000 }).toEqual(["done", "done", "done", "done"]);
    // A value typed by the visitor.
    const negotiators = page.locator("[data-widget='time']").getByRole("slider", { name: LANDING_TEXTS.roi.widgets.time.sliders.negotiators.label });
    await negotiators.focus();
    await page.keyboard.press("ArrowRight");
    await expect(negotiators).toHaveValue("5");
    // Let the network settle (it follows the visible section), then record.
    await page.waitForTimeout(4_000);
    const network = page.getByTestId("living-background");
    const frames = await network.getAttribute("data-frames");
    const scrollY = await page.evaluate(() => window.scrollY);
    const cycles = Number(await page.getByTestId("hero-ecosystem").getAttribute("data-loop-cycles"));
    await page.evaluate(() => {
      const log: string[] = [];
      (window as unknown as { __replay: string[] }).__replay = log;
      for (const body of document.querySelectorAll<HTMLElement>("[data-testid='roi'] [data-roi-state]")) {
        new MutationObserver(() => log.push(`roi:${body.dataset.roiState}`)).observe(body, { attributes: true, attributeFilter: ["data-roi-state"] });
      }
      // The Reveal of the first tile (on screen): back to hidden, then entering.
      const reveal = document.querySelector("[data-widget='speed']")!.closest(".reveal")!;
      new MutationObserver(() => log.push(`tile:${reveal.getAttribute("data-reveal")}`)).observe(reveal, { attributes: true, attributeFilter: ["data-reveal"] });
    });

    expect(await generation(page)).toBeNull();
    await button.click();
    await expect(page.locator("[data-landing]")).toHaveAttribute("data-replay-generation", "1");
    await expect(button).toBeFocused();
    await expect.poll(() => roiStates(page), { timeout: 6_000 }).toEqual(["done", "done", "done", "done"]);
    const log = await page.evaluate(() => (window as unknown as { __replay: string[] }).__replay);
    expect(log.filter((entry) => entry === "roi:armed")).toHaveLength(4);
    expect(log.filter((entry) => entry === "roi:done")).toHaveLength(4);
    // The Reveal of a tile on screen replays its arrival.
    expect(log).toEqual(expect.arrayContaining(["tile:hidden", "tile:entering"]));
    // The value of the visitor is kept, and the arrival counted up to it.
    await expect(negotiators).toHaveValue("5");
    await expect(page.locator("[data-widget='time'] [data-roi-value] > [aria-hidden='true']").first()).toHaveText(/≈\s*340\s*h/);
    expect(Math.abs((await page.evaluate(() => window.scrollY)) - scrollY)).toBeLessThanOrEqual(1);
    // The living background received nothing (no scroll in between).
    expect(await network.getAttribute("data-frames")).toBe(frames);
    // Block A (off screen) starts over at t = 0 when it comes back.
    await expect(page.getByTestId("hero-ecosystem")).toHaveAttribute("data-step", "final");
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect(page.getByTestId("hero-ecosystem")).toHaveAttribute("data-loop-state", "playing", { timeout: 2_000 });
    expect(Number(await page.getByTestId("hero-ecosystem").getAttribute("data-loop-cycles"))).toBe(cycles + 1);
  });

  test("L4-D3 : clic puis défilement — carrousel du bloc C revenu à l'étape 1 et rejoué, frise de la section contrôle rejouée", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    // Play the control timeline and move block C to step 3 first.
    const timeline = page.getByTestId("control-timeline");
    await timeline.scrollIntoViewIfNeeded();
    await expect(timeline).toHaveAttribute("data-visual-state", "done", { timeout: 20_000 });
    const carousel = page.getByTestId("process-carousel");
    await carousel.scrollIntoViewIfNeeded();
    await page.getByTestId("process-next").click();
    await page.getByTestId("process-next").click();
    await expect(carousel).toHaveAttribute("data-active-step", "2");
    const scrollY = await page.evaluate(() => window.scrollY);

    await page.getByTestId("landing-replay").click();
    await expect(carousel).toHaveAttribute("data-active-step", "0");
    expect(Math.abs((await page.evaluate(() => window.scrollY)) - scrollY)).toBeLessThanOrEqual(1);
    // The track is back at its start at once (no glide).
    expect(await page.getByTestId("process-track").evaluate((track) => track.scrollLeft)).toBeLessThanOrEqual(1);
    // The drawing of card 1 plays again.
    const first = carousel.getByTestId("process-visual").first();
    await expect(first).toHaveAttribute("data-visual-state", /playing|done/, { timeout: 4_000 });
    await expect(first).toHaveAttribute("data-visual-state", "done", { timeout: 8_000 });

    // Control section: back to idle, then played again when it is ≥ 50 % visible.
    await expect(timeline).not.toHaveAttribute("data-visual-state", "done");
    await timeline.scrollIntoViewIfNeeded();
    await expect(timeline).toHaveAttribute("data-visual-state", "playing", { timeout: 4_000 });
    await expect(timeline).toHaveAttribute("data-visual-state", "done", { timeout: 20_000 });
  });

  test("L4-D4 : second clic pendant 1 200 ms ignoré, annonce « Animations relancées. »", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    const button = page.getByTestId("landing-replay");
    await button.click();
    await expect(page.locator("[data-landing]")).toHaveAttribute("data-replay-generation", "1");
    await expect(button).toHaveAttribute("aria-disabled", "true");
    // A real click event now (Playwright would wait for aria-disabled to go away).
    await button.evaluate((node) => (node as HTMLButtonElement).click());
    await page.waitForTimeout(200);
    await expect(page.locator("[data-landing]")).toHaveAttribute("data-replay-generation", "1");
    await expect(page.getByTestId("landing-replay-status")).toHaveText(TEXTS.done);
    await expect(button).not.toHaveAttribute("aria-disabled", "true", { timeout: 1_500 });
    await button.click();
    await expect(page.locator("[data-landing]")).toHaveAttribute("data-replay-generation", "2");
    // The hero title replays its arrival (its CSS animations restart).
    const running = await page.locator("#hero-title").evaluate((title) => title.getAnimations({ subtree: true }).filter((animation) => animation.playState === "running").length);
    expect(running).toBeGreaterThan(0);
  });
});

test("L4-D1 : absent en mouvement réduit (cas d'erreur : rien ne bouge, le bouton serait du bruit)", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openHome(page);
  await page.waitForTimeout(500);
  await expect(page.getByTestId("landing-replay")).toHaveCount(0);
});

test("L4-D1 : absent sans JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, reducedMotion: "no-preference" });
  const page = await context.newPage();
  await openHome(page);
  await expect(page.getByTestId("landing-replay")).toHaveCount(0);
  await context.close();
});
