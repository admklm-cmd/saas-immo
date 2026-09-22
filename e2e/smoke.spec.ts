import { expect, test } from "@playwright/test";

import { APP_TEXTS } from "@/components/texts";

// Smoke test: proves the E2E chain (Playwright -> Next.js server -> browser) works.
test("home page loads with the AiaA title", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("AiaA");
  await expect(
    page.getByRole("heading", { level: 1, name: APP_TEXTS.marketing.heroTitle }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
});
