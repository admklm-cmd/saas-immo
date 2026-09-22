import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * E2E tests (one file per user journey in e2e/).
 * Prototype: Chromium only, against the local Next.js dev server.
 */
export default defineConfig({
  testDir: "./e2e",
  // Reloads the fictitious fixtures before the suite, so that the E2E run never
  // inherits the state left by a Vitest integration run on the same local
  // database (see e2e/global-setup.ts).
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // One worker, always. Several journeys flip the agency-wide AI kill switch of
  // the same fictitious agency: run in parallel, they would refuse each other's
  // executions and fail for a reason that has nothing to do with the product.
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    trace: "on-first-retry",
    // No journey may depend on an animation to be usable or testable: the
    // suite runs in reduced motion by default (see docs/design-system.md).
    // Tests that specifically exercise a real animation opt back in locally
    // with `test.use({ reducedMotion: "no-preference" })`.
    reducedMotion: "reduce",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
