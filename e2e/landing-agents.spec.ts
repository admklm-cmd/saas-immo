import { expect, test, type Locator, type Page } from "@playwright/test";

import { HERO_TITLE, LANDING_TEXTS } from "@/components/landing-texts";

/**
 * Section « agents » of the landing, drawn as the interface of an OS: seven
 * modules (Léa → Hugo → Emma → validation humaine → Louis → Sarah → mandat),
 * the application each one opens (a fictitious scene labelled as a
 * simulation), the discreet navigation, the keyboard, and the hand-made
 * physics of the track (mouse drag with inertia, native swipe with snap).
 *
 * Desktop 1440 × 900 and mobile 390 × 844. The suite runs in reduced motion
 * (playwright.config.ts); the physics groups opt back into motion locally.
 * No form here: no consent checkbox to check on this journey.
 */

const COLD_START = 60_000;
const AGENTS = LANDING_TEXTS.agents;
const VIEWPORTS = [
  { name: "ordinateur", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;

async function openAgents(page: Page): Promise<Locator> {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: HERO_TITLE })).toBeVisible({ timeout: COLD_START });
  const carousel = page.getByTestId("agents-carousel");
  await carousel.scrollIntoViewIfNeeded();
  return carousel;
}

function scene(carousel: Locator): Locator {
  return carousel.getByRole("tabpanel").getByTestId("agent-scene");
}

/** Scroll position of the track, and the snap stops of its modules. */
async function trackState(page: Page): Promise<{ left: number; max: number; stops: number[] }> {
  return page.getByTestId("agents-tablist").evaluate((track) => {
    const padding = Number.parseFloat(getComputedStyle(track).scrollPaddingLeft) || 0;
    const max = track.scrollWidth - track.clientWidth;
    const stops = Array.from(track.querySelectorAll<HTMLElement>("[data-snap]"), (item) =>
      Math.min(Math.max(item.offsetLeft - padding, 0), max),
    );
    return { left: track.scrollLeft, max, stops: [...stops, max] };
  });
}

function onAStop(state: { left: number; stops: number[] }): boolean {
  return state.stops.some((stop) => Math.abs(stop - state.left) <= 1.5);
}

for (const viewport of VIEWPORTS) {
  test.describe(`section agents — ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("sélection d'un module : l'application s'ouvre, étiquetée exemple fictif — simulation", async ({ page }) => {
      const carousel = await openAgents(page);
      const tabs = carousel.getByRole("tab");
      await expect(tabs).toHaveCount(AGENTS.steps.length);
      await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
      await expect(scene(carousel)).toHaveAttribute("data-step", "lea");

      // The three natures are drawn differently.
      await expect(carousel.getByRole("tab", { name: /Validation humaine/ })).toHaveAttribute("data-variant", "checkpoint");
      await expect(carousel.getByRole("tab", { name: /Mandat/ })).toHaveAttribute("data-variant", "outcome");
      await expect(carousel.getByRole("tab", { name: /Sarah/ })).toHaveAttribute("data-variant", "agent");

      for (const key of ["sarah", "review", "mandate"] as const) {
        const tab = carousel.locator(`[role=tab][data-step=${key}]`);
        await tab.click();
        await expect(tab).toHaveAttribute("aria-selected", "true");
        await expect(scene(carousel)).toHaveAttribute("data-step", key);
        await expect(carousel.getByRole("tabpanel")).toContainText(AGENTS.scenes[key].title);
        const label = carousel.getByTestId("agent-scene-label");
        await expect(label).toContainText(AGENTS.carousel.sceneBadge);
        await expect(label).toContainText("Simulation");
        await expect(tab.getByTestId("step-app-icon")).toHaveAttribute("data-state", "active");
      }
      // The mandate is confirmed by a person, never declared by an agent.
      await expect(carousel.getByTestId("mandate-confirmed")).toHaveText(AGENTS.scenes.mandate.confirmed);

      const pageOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(pageOverflow).toBe(false);
    });

    test("clavier : flèches, Début, Fin, et navigation discrète inerte aux extrémités", async ({ page }) => {
      const carousel = await openAgents(page);
      await carousel.getByRole("tab", { name: /Léa/ }).focus();
      await page.keyboard.press("ArrowRight");
      await expect(carousel.getByRole("tab", { name: /Hugo/ })).toBeFocused();
      await expect(scene(carousel)).toHaveAttribute("data-step", "hugo");
      await page.keyboard.press("End");
      const mandate = carousel.getByRole("tab", { name: /Mandat/ });
      await expect(mandate).toBeFocused();
      await expect(mandate).toBeInViewport();
      await expect(carousel.getByTestId("agents-next")).toHaveAttribute("aria-disabled", "true");
      await expect(carousel.getByTestId("agents-position")).toContainText("07");
      await page.keyboard.press("Home");
      await expect(scene(carousel)).toHaveAttribute("data-step", "lea");
      await expect(carousel.getByTestId("agents-previous")).toHaveAttribute("aria-disabled", "true");

      // Previous at the start does nothing (error case: the focus and the selection stay).
      await carousel.getByTestId("agents-previous").click({ force: true });
      await expect(scene(carousel)).toHaveAttribute("data-step", "lea");
      await carousel.getByTestId("agents-next").click();
      await expect(scene(carousel)).toHaveAttribute("data-step", "hugo");

      // The panel is reachable with Tab, after the selected tab.
      await carousel.getByRole("tab", { name: /Hugo/ }).focus();
      await page.keyboard.press("Tab");
      await expect(carousel.getByRole("tabpanel")).toBeFocused();
    });

    test("mouvement réduit : état final immédiat, aucune animation d'ouverture", async ({ page }) => {
      const carousel = await openAgents(page);
      await carousel.locator("[role=tab][data-step=louis]").click();
      await expect(scene(carousel)).toHaveAttribute("data-step", "louis");
      const running = await carousel.evaluate((root) =>
        root
          .getAnimations({ subtree: true })
          // The global reduced-motion rule leaves 0.01 ms transitions: only a real duration counts.
          .filter((animation) => animation.playState === "running" && Number(animation.effect?.getTiming().duration) > 1)
          .map((animation) => String((animation.effect as KeyframeEffect | null)?.target?.className)),
      );
      expect(running).toEqual([]);
      // The track landed at once on a stop (no glide).
      expect(onAStop(await trackState(page))).toBe(true);
    });
  });
}

test.describe("physique du défilement — ordinateur", () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" });

  test("glisser à la souris : inertie, arrêt sur un module, jamais de sélection accidentelle", async ({ page }) => {
    const carousel = await openAgents(page);
    const start = await trackState(page);
    expect(start.max).toBeGreaterThan(0);
    expect(start.left).toBe(0);

    const hugo = carousel.locator("[role=tab][data-step=hugo]");
    const box = await hugo.boundingBox();
    if (!box) throw new Error("Hugo module not laid out");
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width / 2, y);
    await page.mouse.down();
    for (let step = 1; step <= 8; step += 1) await page.mouse.move(box.x + box.width / 2 - step * 30, y);
    await page.mouse.up();
    const atRelease = (await trackState(page)).left;
    expect(atRelease).toBeGreaterThan(100);

    // Inertia: the track keeps going after the release, then settles on a stop.
    await expect.poll(async () => (await trackState(page)).left, { timeout: 3_000 }).toBeGreaterThan(atRelease + 5);
    await expect.poll(async () => onAStop(await trackState(page)), { timeout: 4_000 }).toBe(true);

    // The drag started on Hugo: nothing was selected.
    await expect(carousel.locator("[role=tab][data-step=lea]")).toHaveAttribute("aria-selected", "true");
    await expect(scene(carousel)).toHaveAttribute("data-step", "lea");

    // A plain click still selects.
    await carousel.locator("[role=tab][data-step=emma]").click();
    await expect(scene(carousel)).toHaveAttribute("data-step", "emma");
  });

  test("molette horizontale et ouverture animée de l'application", async ({ page }) => {
    const carousel = await openAgents(page);
    const track = page.getByTestId("agents-tablist");
    await track.hover();
    await page.mouse.wheel(400, 0);
    await expect.poll(async () => (await trackState(page)).left, { timeout: 3_000 }).toBeGreaterThan(0);
    await expect.poll(async () => onAStop(await trackState(page)), { timeout: 4_000 }).toBe(true);

    // Opening: the header tile flies from the module (FLIP), then the scene follows.
    await carousel.getByTestId("agents-next").click();
    const flying = await carousel.evaluate((root) => root.getAnimations({ subtree: true }).length);
    expect(flying).toBeGreaterThan(0);
    await expect(scene(carousel)).toHaveAttribute("data-step", "hugo");
    await expect(scene(carousel)).toBeVisible();
  });
});

test.describe("physique du défilement — mobile", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: "no-preference" });

  test("balayage tactile natif : le rail défile, s'arrête sur un module, sans sélection", async ({ page }) => {
    const carousel = await openAgents(page);
    const tablist = page.getByTestId("agents-tablist");
    // Centred, away from the fixed navigation bar; instant page scroll, then measure.
    await tablist.evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
    const box = await tablist.boundingBox();
    if (!box) throw new Error("Track not laid out");
    const y = box.y + 60;
    // A real touch swipe (touch events, one move per frame), not a scripted scroll.
    const client = await page.context().newCDPSession(page);
    let x = box.x + box.width - 20;
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    for (let step = 0; step < 12; step += 1) {
      x -= 20;
      await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] });
      await page.waitForTimeout(16);
    }
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

    await expect.poll(async () => (await trackState(page)).left, { timeout: 3_000 }).toBeGreaterThan(50);
    await expect.poll(async () => onAStop(await trackState(page)), { timeout: 4_000 }).toBe(true);
    await expect(scene(carousel)).toHaveAttribute("data-step", "lea");

    const pageOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(pageOverflow).toBe(false);
  });
});
