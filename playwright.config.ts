import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * E2E tests (one file per user journey in e2e/).
 * Prototype: Chromium only, against the local Next.js dev server.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    trace: "on-first-retry",
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
