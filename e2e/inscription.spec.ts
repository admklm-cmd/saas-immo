import { expect, test } from "@playwright/test";

import { APP_TEXTS } from "@/components/texts";

/**
 * `/inscription` — honest and finished: no self-service sign-up, no
 * « Bientôt disponible », no form. The way out is signing in or going home.
 */

const TEXTS = APP_TEXTS.signUp;

test("inscription : explique la mise en place accompagnée et mène à la connexion", async ({ page }) => {
  const response = await page.goto("/inscription");
  expect(response?.status()).toBe(200);

  await expect(page.getByRole("heading", { level: 1, name: TEXTS.title })).toBeVisible();
  const main = page.locator("main");
  await expect(main).toContainText(TEXTS.lead);
  await expect(main).toContainText(TEXTS.securityNote);
  await expect(main).not.toContainText(/Bientôt disponible|À venir/i);
  await expect(main.locator("form, input")).toHaveCount(0);

  await main.getByRole("link", { name: TEXTS.signIn }).click();
  await expect(page).toHaveURL(/\/connexion$/);
  await expect(page.getByRole("heading", { level: 1, name: APP_TEXTS.auth.title })).toBeVisible();
});

test("inscription : le lien de retour mène à l'accueil", async ({ page }) => {
  await page.goto("/inscription");
  await page.locator("main").getByRole("link", { name: TEXTS.backHome }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1, name: APP_TEXTS.marketing.heroTitle })).toBeVisible();
});
