import { defineConfig, devices } from "@playwright/test";

/**
 * Light configuration for the promo video journey only (`e2e/promo-motion.spec.ts`): no sign-in, no
 * database, so none of the fixtures reload of the main configuration. Own port (3200 by default) so that it
 * never meets another development server.
 *
 *   npx playwright test --config playwright.promo.config.ts
 */
const PORT = Number(process.env.PROMO_PORT ?? 3200);
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "promo-motion.spec.ts",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { baseURL: BASE_URL, locale: "fr-FR", reducedMotion: "reduce", viewport: { width: 1920, height: 1080 } },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1920, height: 1080 } } }],
  webServer: { command: `npx next dev -p ${PORT} --hostname 127.0.0.1`, url: BASE_URL, reuseExistingServer: true, timeout: 120_000 },
});
