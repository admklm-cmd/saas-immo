import { test } from "@playwright/test";
test.use({ reducedMotion: "no-preference" });
test("mid", async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const c = page.getByTestId("hero-particles");
  const ms = async () => Number(await c.getAttribute("data-sequence-ms"));
  for (const t of [1500, 3500, 4800, 5600, 6400, 7500, 9000, 10600]) {
    while ((await ms()) < t) await page.waitForTimeout(50);
    await page.screenshot({ path: `test-results/hero-morph/d-1440-${t}.png` });
  }
  console.log("ATTR", await c.evaluate((e) => JSON.stringify({ ...(e as HTMLElement).dataset })));
});
