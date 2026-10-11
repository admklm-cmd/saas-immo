import { expect, test, type Page } from "@playwright/test";

import { APP_TEXTS } from "@/components/texts";

import { signIn } from "./helpers/sign-in";

/**
 * Icon family (docs/design-system.md §2.8), in a real browser:
 *   * the development gallery shows the 24 icons of the boards in both variants;
 *   * under reduced motion, no icon animates — not even on hover;
 *   * without reduced motion, nothing loops without end: a small icon plays its
 *     story once (hover), a large tile stops by itself in under 5 s (WCAG 2.2.2);
 *   * the signed-in space carries the large icon next to the page title and a
 *     small icon on every navigation entry.
 */

const COLD_START = 60_000;
const BOARD = 24;

type IconAnimation = { size: string | null; asked: boolean; iterations: number; playState: string };

/** Every CSS animation running on an element of an icon, with its variant. */
function iconAnimations(page: Page): Promise<IconAnimation[]> {
  return page.evaluate(() =>
    document.getAnimations().flatMap((animation) => {
      const target = (animation.effect as KeyframeEffect | null)?.target;
      const svg = target instanceof Element ? target.closest("svg[data-icon]") : null;
      if (!svg) return [];
      return [
        {
          size: svg.getAttribute("data-icon-size"),
          asked: svg.hasAttribute("data-animate"),
          iterations: animation.effect?.getComputedTiming().iterations ?? 0,
          playState: animation.playState,
        },
      ];
    }),
  );
}

async function openGallery(page: Page): Promise<void> {
  await page.goto("/dev/icons");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: COLD_START });
}

test.describe("galerie des icônes", () => {
  test.beforeEach(() => {
    test.setTimeout(180_000);
  });

  test("montre les 24 icônes de la planche, en petite et en grande variante", async ({ page }) => {
    await openGallery(page);
    const small = page.getByTestId("gallery-board-sm").getByTestId("icon-gallery-sm");
    const large = page.getByTestId("gallery-board-lg").getByTestId("icon-gallery-lg");
    await expect(small).toHaveCount(BOARD);
    await expect(large).toHaveCount(BOARD);
    // Each small cell: the icon at 32 and at 16 px, decorative, one grid.
    for (const svg of await small.locator("svg[data-icon]").all()) {
      await expect(svg).toHaveAttribute("aria-hidden", "true");
      await expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
      await expect(svg).toHaveAttribute("data-icon-size", "sm");
    }
    expect(await small.locator("svg[data-icon]").count()).toBe(BOARD * 2);
    // Each large cell: a frosted tile around one large icon.
    await expect(large.locator("[data-icon-tile] > svg[data-icon-size=lg]")).toHaveCount(BOARD);
    // Red only on the alert.
    const danger = await page.locator('svg[data-tone="danger"]').evaluateAll((svgs) =>
      Array.from(new Set(svgs.map((svg) => svg.getAttribute("data-icon")))),
    );
    expect(danger).toEqual(["alert"]);
  });

  test("mouvement réduit : aucune icône ne s'anime, même au survol", async ({ page }) => {
    // The suite runs under reduced motion by default (playwright.config.ts).
    await openGallery(page);
    expect(await iconAnimations(page)).toEqual([]);
    await page.getByTestId("icon-gallery-sm").first().hover();
    await page.getByTestId("icon-gallery-sm").nth(7).focus();
    expect(await iconAnimations(page)).toEqual([]);
  });

  test.describe("sans mouvement réduit", () => {
    test.use({ reducedMotion: "no-preference" });

    test("rien ne tourne en boucle ; les petites icônes ne jouent qu'au survol, une fois", async ({ page }) => {
      await openGallery(page);
      const atArrival = await iconAnimations(page);
      // Only the large tiles (and a small icon ASKED to play: an « active » step tile) move on arrival.
      expect(atArrival.length).toBeGreaterThan(0);
      expect(atArrival.filter((animation) => animation.size === "sm" && !animation.asked)).toEqual([]);
      expect(atArrival.filter((animation) => animation.size === "sm").every((animation) => animation.iterations === 1)).toBe(true);
      expect(atArrival.every((animation) => Number.isFinite(animation.iterations))).toBe(true);

      await page.getByTestId("icon-gallery-sm").first().hover();
      const onHover = (await iconAnimations(page)).filter((animation) => animation.size === "sm");
      expect(onHover.length).toBeGreaterThan(0);
      expect(onHover.every((animation) => animation.iterations === 1)).toBe(true);

      // Everything rests within 5 s (WCAG 2.2.2): no icon is still running.
      await page.mouse.move(0, 0);
      await expect
        .poll(async () => (await iconAnimations(page)).filter((animation) => animation.playState === "running").length, {
          timeout: 7_000,
        })
        .toBe(0);
    });
  });
});

test("espace connecté : grande icône à côté du titre, petite icône sur chaque entrée du menu", async ({ page }) => {
  test.setTimeout(240_000);
  await signIn(page, "agentA");
  const screens = [
    ["/dashboard", "dashboard"],
    ["/contacts", "contacts"],
    ["/pipeline", "pipeline"],
    ["/taches", "tasks"],
    ["/rendez-vous", "calendar"],
    ["/agents-ia", "aiAgent"],
    ["/parametres", "settings"],
  ] as const;
  for (const [href, icon] of screens) {
    await page.goto(href);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: COLD_START });
    const tile = page.getByTestId("page-header-icon");
    await expect(tile, href).toBeVisible();
    await expect(tile).toHaveAttribute("aria-hidden", "true");
    await expect(tile.locator("svg")).toHaveAttribute("data-icon", icon);
  }
  const nav = page.getByRole("navigation", { name: APP_TEXTS.nav.primaryLabel });
  const links = nav.getByRole("link");
  const count = await links.count();
  expect(count).toBeGreaterThanOrEqual(10);
  await expect(nav.locator("a svg[data-icon][data-icon-size=sm]")).toHaveCount(count);
  // Reduced motion (suite default): nothing moves in the signed-in space either.
  expect(await iconAnimations(page)).toEqual([]);
});
