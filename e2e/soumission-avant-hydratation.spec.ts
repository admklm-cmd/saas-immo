import { expect, test, type Browser } from "@playwright/test";

/**
 * A form submitted before React hydrates bypasses its `onSubmit` handler and
 * falls back to the browser's native submission. Without `method="post"` that
 * is a GET: every named field (the sign-in password included) ends up in the
 * URL, the history and the access logs. With JavaScript disabled — the
 * extreme case of "not hydrated yet" — this journey checks that the public
 * forms never leak what was typed into the address bar, and that the page
 * survives the unexpected POST without echoing the values back.
 *
 * Only synthetic canary values are typed: never a fixture credential.
 */

const COLD_START = 60_000;
const CANARY_EMAIL = "canary.hydration@example.test";
const CANARY_SECRET = "Canary-Not-A-Real-Password-42";

async function noJsPage(browser: Browser) {
  const context = await browser.newContext({ javaScriptEnabled: false });
  return { context, page: await context.newPage() };
}

test.beforeEach(() => {
  test.setTimeout(120_000);
});

test("connexion : une soumission sans JavaScript ne met ni l'email ni le mot de passe dans l'URL", async ({
  browser,
}) => {
  const { context, page } = await noJsPage(browser);
  try {
    await page.goto("/connexion", { timeout: COLD_START });
    await page.locator('input[name="email"]').fill(CANARY_EMAIL);
    await page.locator('input[type="password"]').fill(CANARY_SECRET);

    const [response] = await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/connexion"),
      page.locator('form[method="post"] button[type="submit"]').click(),
    ]);

    expect(response.status()).toBe(200);
    await page.waitForLoadState();
    expect(new URL(page.url()).search).toBe("");
    expect(page.url()).not.toContain("canary");
    expect(await page.content()).not.toContain(CANARY_SECRET);
  } finally {
    await context.close();
  }
});

test("estimation : une soumission sans JavaScript ne met aucune donnée du formulaire dans l'URL", async ({
  browser,
}) => {
  const { context, page } = await noJsPage(browser);
  try {
    await page.goto("/estimation", { timeout: COLD_START });
    const form = page.locator('form[data-sensitive][method="post"]');
    await expect(form).toHaveCount(1);
    await form.locator('input[type="email"]').fill(CANARY_EMAIL);

    const [response] = await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/estimation"),
      page.getByTestId("estimation-submit").click(),
    ]);

    expect(response.status()).toBe(200);
    await page.waitForLoadState();
    expect(new URL(page.url()).search).toBe("");
    expect(await page.content()).not.toContain(CANARY_EMAIL);
  } finally {
    await context.close();
  }
});
