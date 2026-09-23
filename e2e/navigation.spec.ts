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
