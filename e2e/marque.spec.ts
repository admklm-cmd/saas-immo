import { expect, test } from "@playwright/test";

import { BRAND } from "@/components/brand";

import { signIn } from "./helpers/sign-in";

/**
 * The brand lock-up, on the public site and inside the signed-in space.
 *
 * Everything asserted here is read from `components/brand.ts`: the product
 * name is never retyped in a test, so a rename cannot leave the suite green on
 * a stale spelling — nor red for the wrong reason.
 */

test("the public header shows the brand lock-up and links back home", async ({ page }) => {
  await page.goto("/estimation");

  const header = page.getByRole("banner");
  const symbol = header.getByRole("img", { name: BRAND.name });
  await expect(symbol).toBeVisible();

  // The symbol is painted through a CSS mask: there is no <img> element to
  // check, but the mark must still occupy a real painted box — a collapsed
  // span would be invisible to a sighted user while passing every role query.
  const box = await symbol.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThan(8);
  expect(box?.width ?? 0).toBeGreaterThan(8);

  // The two lines of the word mark are live text, never baked into an image.
  for (const line of BRAND.wordmark) {
    await expect(header.getByText(line, { exact: true })).toBeVisible();
  }

  await header.getByRole("link", { name: BRAND.name }).click();
  await expect(page).toHaveTitle(BRAND.name);
  expect(new URL(page.url()).pathname).toBe("/");
});

test("the signed-in space shows the same lock-up, marked as a prototype", async ({ page }) => {
  await signIn(page, "agentA");

  await expect(page.getByRole("img", { name: BRAND.name }).first()).toBeVisible();
  await expect(page.getByText(BRAND.prototype).first()).toBeVisible();
});

test("an unknown page still carries the brand and offers a way back", async ({ page }) => {
  const response = await page.goto("/cette-page-nexiste-pas");
  expect(response?.status()).toBe(404);

  await expect(page.getByRole("link", { name: BRAND.name })).toBeVisible();
});

test("the symbol is served as the site icon", async ({ page }) => {
  await page.goto("/");

  // Next.js App Router emits these <link>s from app/favicon.ico and app/icon.png.
  const icon = page.locator('link[rel="icon"]').first();
  await expect(icon).toHaveAttribute("href", /favicon\.ico|icon\.png/);

  const href = await icon.getAttribute("href");
  const response = await page.request.get(href ?? "");
  expect(response.status()).toBe(200);
});
