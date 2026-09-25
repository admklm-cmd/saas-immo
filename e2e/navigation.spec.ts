import { expect, test } from "@playwright/test";

import { APP_TEXTS } from "@/components/texts";

import { signIn } from "./helpers/sign-in";

/**
 * Every entry of the main navigation leads to a finished screen: a real page
 * title, and never a « Bientôt disponible » placeholder (goal of the complete
 * demo — docs/plans/2026-09-23-complete-demo.md).
 *
 * The links are READ from the rendered menu, not listed here: a new entry is
 * covered automatically.
 */

const COLD_START = 60_000;
const PLACEHOLDERS = [/Bientôt disponible/i, /prochaine itération/i];

test("chaque lien de la navigation principale ouvre un écran fini", async ({ page }) => {
  test.setTimeout(300_000);
  await signIn(page, "agentA");

  const nav = page.getByRole("navigation", { name: APP_TEXTS.nav.primaryLabel });
  const hrefs = await nav.getByRole("link").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  expect(hrefs.length).toBeGreaterThanOrEqual(10);
  expect(hrefs).toContain("/parametres");

  for (const href of hrefs) {
    expect(href, "navigation link without href").toBeTruthy();
    const response = await page.goto(href!);
    expect(response?.status(), `${href} status`).toBe(200);
    await expect(page, `${href} stays in the signed-in space`).toHaveURL(new RegExp(`${href}$`), {
      timeout: COLD_START,
    });
    await expect(page.getByRole("heading", { level: 1 }), `${href} has a page title`).toBeVisible({
      timeout: COLD_START,
    });
    // The current entry is the one just opened.
    await expect(nav.locator(`a[href="${href}"]`)).toHaveAttribute("aria-current", "page");

    const text = (await page.locator("main").textContent()) ?? "";
    for (const placeholder of PLACEHOLDERS) {
      expect(text, `${href} must not be a placeholder`).not.toMatch(placeholder);
    }
  }
});

const NAV = APP_TEXTS.nav;

/**
 * Grouped menu (Lot 2A): three groups, every entry reachable with the keyboard
 * in the reading order, one current entry marked `aria-current` (the thin
 * cobalt mark is its visual twin), and a visible focus.
 */
test("navigation groupée au clavier : groupes, ordre, entrée courante et focus visible", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, "agentA");
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: COLD_START });

  const nav = page.getByRole("navigation", { name: NAV.primaryLabel });
  await expect(nav.getByRole("list", { name: NAV.groupPilotage })).toBeVisible();
  await expect(nav.getByRole("list", { name: NAV.groupAgents })).toBeVisible();
  await expect(nav.getByRole("link", { name: NAV.agentsOverview, exact: true })).toHaveAttribute("href", "/agents-ia");
  await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
  await expect(nav.locator('[aria-current="page"]')).toHaveAttribute("href", "/dashboard");

  // Tab through the menu from the brand link: every entry, in the order of the groups.
  const expected = await nav.getByRole("link").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  await page.locator("aside").getByRole("link").first().focus();
  const reached: string[] = [];
  for (let index = 0; index < expected.length; index += 1) {
    await page.keyboard.press("Tab");
    const focused = page.locator(":focus");
    reached.push((await focused.getAttribute("href")) ?? "");
    // Focus is visible: a real outline, never removed.
    const outline = await focused.evaluate((element) => getComputedStyle(element).outlineStyle);
    expect(outline).not.toBe("none");
  }
  expect(reached).toEqual(expected);

  // Enter follows the focused entry, which becomes the current one.
  await nav.getByRole("link", { name: NAV.pipeline, exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/pipeline$/, { timeout: COLD_START });
  await expect(nav.locator('[aria-current="page"]')).toHaveAttribute("href", "/pipeline");
});

test("mobile : le menu s'ouvre au clavier, garde tous les liens et se ferme avec Échap", async ({ page }) => {
  test.setTimeout(180_000);
  await signIn(page, "agentA");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/taches");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: COLD_START });

  // The desktop column is not there; the menu is closed.
  await expect(page.locator("aside")).toBeHidden();
  const toggle = page.getByTestId("mobile-nav-toggle");
  await expect(toggle).toBeVisible();
  await expect(page.getByTestId("mobile-nav-sheet")).toBeHidden();

  await toggle.focus();
  await page.keyboard.press("Enter");
  const sheet = page.getByTestId("mobile-nav-sheet");
  await expect(sheet).toBeVisible();
  const nav = sheet.getByRole("navigation", { name: NAV.primaryLabel });
  await expect(nav.getByRole("link")).toHaveCount(11);
  await expect(nav.locator('[aria-current="page"]')).toHaveAttribute("href", "/taches");
  // Touch targets of at least 44 px.
  const heights = await nav.getByRole("link").evaluateAll((links) => links.map((link) => link.getBoundingClientRect().height));
  for (const height of heights) expect(height).toBeGreaterThanOrEqual(44);

  // Modal sheet: the page behind is inert and still, and the focus loops
  // between « Fermer » and the sheet instead of wandering behind it.
  await expect(page.locator("#content")).toHaveJSProperty("inert", true);
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe("hidden");
  await expect(toggle).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(sheet.getByRole("button", { name: NAV.signOut })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(toggle).toBeFocused();
  for (let step = 0; step < 14; step += 1) {
    await page.keyboard.press("Tab");
    const insideMenu = await page.evaluate(
      () => document.activeElement?.closest("details") !== null,
    );
    expect(insideMenu, `tabulation ${step + 1} hors du menu`).toBe(true);
  }

  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(toggle).toBeFocused();
  await expect(page.locator("#content")).toHaveJSProperty("inert", false);
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe("");

  // Following a link closes the sheet.
  await toggle.click();
  await sheet.getByRole("link", { name: NAV.dashboard, exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: COLD_START });
  await expect(page.getByTestId("mobile-nav-sheet")).toBeHidden();
  // The new page is usable: not inert, scrollable.
  await expect(page.locator("#content")).toHaveJSProperty("inert", false);
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe("");
});
