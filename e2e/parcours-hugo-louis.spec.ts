import { expect, test, type Page } from "@playwright/test";

import { APP_TEXTS } from "@/components/texts";
import { NOTABLE_CONTACTS } from "@/fixtures/dataset";
import { AGENT_ERROR_MESSAGES } from "@/lib/agents/messages";

import { keepAgentsRunning } from "./helpers/kill-switch";
import { clearLouisArtefacts, setAiPaused } from "./helpers/local-agency";
import { fixtureUser, signIn } from "./helpers/sign-in";

/**
 * First complete journey: sign in (agency A) → contact list → contact file →
 * Hugo (qualification) → Louis (appointment proposal) → updated CRM history.
 *
 * Plus the guard-rail cases: agency kill switch, contact of another agency,
 * signed-in space without a session, and a refused sign-in.
 *
 * Requires the local Supabase stack with the fixtures loaded (`npm run db:reset`).
 *
 * Serial mode: one test flips the agency-wide kill switch, so the tests of this
 * file must never run at the same time.
 *
 * The generous per-assertion timeouts exist because the Next.js dev server
 * compiles each route and each server action on first hit.
 */
test.describe.configure({ mode: "serial" });

const TIMELINE = "contact-timeline";
const CONTACT_ID = NOTABLE_CONTACTS.readyForAppointment;
const COLD_START = 60_000;

test.beforeEach(() => {
  test.setTimeout(120_000);
});

// The kill switch is agency-wide: one test turns it on here, so every test of
// this file establishes and restores it instead of trusting the previous run.
keepAgentsRunning("agentA");

// Louis refuses a second proposal while one is still pending: start from a
// clean slate so the journey can be replayed.
test.beforeAll(async () => {
  await clearLouisArtefacts(CONTACT_ID);
});

async function openContactFile(page: Page, contactId: string): Promise<string> {
  // The list is a table from 768 px and cards on a phone: only one of them is shown.
  const link = page.locator(`a[href="/contacts/${contactId}"]:visible`);
  await expect(link).toBeVisible({ timeout: COLD_START });
  const name = (await link.innerText()).trim();

  await link.click();
  await expect(page).toHaveURL(new RegExp(`/contacts/${contactId}$`), { timeout: COLD_START });
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible({ timeout: COLD_START });
  return name;
}

test("parcours complet : connexion → fiche contact → Hugo → Louis → historique", async ({ page }) => {
  await signIn(page, "agentA");

  await expect(page.getByRole("table")).toBeVisible();
  await openContactFile(page, CONTACT_ID);

  const timeline = page.getByTestId(TIMELINE);
  await expect(timeline).toBeVisible();
  const entriesBefore = await timeline.locator("li").count();

  // --- Hugo — qualification -------------------------------------------------
  await page.getByRole("button", { name: APP_TEXTS.agents.runHugo }).click();
  const hugoResult = page.getByTestId("agent-result");
  await expect(hugoResult).toBeVisible({ timeout: COLD_START });
  await expect(hugoResult).toContainText(APP_TEXTS.agents.hugoSuccessTitle);

  await expect.poll(async () => timeline.locator("li").count()).toBeGreaterThan(entriesBefore);
  const afterHugo = await timeline.locator("li").count();

  // --- Louis — appointment proposal -----------------------------------------
  await page.getByRole("button", { name: APP_TEXTS.agents.runLouis }).click();
  const louisResult = page.getByTestId("agent-result");
  await expect(louisResult).toBeVisible({ timeout: COLD_START });
  await expect(louisResult).toContainText(APP_TEXTS.agents.louisSuccessTitle);
  await expect(louisResult).toContainText(APP_TEXTS.agents.draftMessage);
  // Nothing is sent: the first contact stays pending human validation.
  await expect(louisResult).toContainText(APP_TEXTS.agents.pendingValidation);

  await expect.poll(async () => timeline.locator("li").count()).toBeGreaterThan(afterHugo);

  // --- CRM history: simulated entries are badged as such --------------------
  const simulationBadges = timeline.getByText(APP_TEXTS.states.simulation);
  await expect(simulationBadges.first()).toBeVisible();
  expect(await simulationBadges.count()).toBeGreaterThan(0);

  // A full page reload shows the same, persisted history.
  await page.reload();
  const reloaded = page.getByTestId(TIMELINE);
  await expect.poll(async () => reloaded.locator("li").count()).toBeGreaterThan(afterHugo);
  await expect(reloaded.getByText(APP_TEXTS.states.simulation).first()).toBeVisible();
});

test("coupe-circuit activé : message clair et aucune action", async ({ page }) => {
  const user = await fixtureUser("agentA");

  await setAiPaused(user.agencyId, true);

  await signIn(page, "agentA");
  await openContactFile(page, CONTACT_ID);

  const timeline = page.getByTestId(TIMELINE);
  const entriesBefore = await timeline.locator("li").count();
  const stageBefore = await page.locator("[data-stage]").first().getAttribute("data-stage");

  await page.getByRole("button", { name: APP_TEXTS.agents.runHugo }).click();

  const error = page.getByTestId("agent-blocked");
  await expect(error).toBeVisible({ timeout: COLD_START });
  await expect(error).toContainText(AGENT_ERROR_MESSAGES.ai_paused);
  await expect(page.getByTestId("agent-result")).toHaveCount(0);

  // No business action at all: only the refusal is journaled (audit trail),
  // and the pipeline stage is untouched.
  await page.reload();
  await expect(page.getByTestId(TIMELINE).locator("li")).toHaveCount(entriesBefore + 1);
  await expect(page.getByTestId(TIMELINE)).toContainText(AGENT_ERROR_MESSAGES.ai_paused);
  expect(await page.locator("[data-stage]").first().getAttribute("data-stage")).toBe(stageBefore);
  // Resumed by `keepAgentsRunning()`, timeout or not.
});

test("isolation : un contact d'une autre agence est introuvable", async ({ page }) => {
  await signIn(page, "agentA");

  await page.goto(`/contacts/${NOTABLE_CONTACTS.otherAgencyContact}`);

  // The "not found" page is rendered by `notFound()`. The HTTP status is not
  // asserted: the App Router streams the response, so the status line is
  // already committed when the 404 is raised.
  await expect(page.getByText(APP_TEXTS.contact.notFoundTitle)).toBeVisible({ timeout: COLD_START });
  // No detail of the other agency leaks: no agent panel, no history.
  await expect(page.getByTestId("agent-actions")).toHaveCount(0);
  await expect(page.getByTestId(TIMELINE)).toHaveCount(0);
});

test("espace connecté : sans session, redirection vers la connexion", async ({ page }) => {
  await page.goto(`/contacts/${CONTACT_ID}`);
  await expect(page).toHaveURL(/\/connexion$/, { timeout: COLD_START });
  await expect(page.getByRole("heading", { level: 1, name: APP_TEXTS.auth.title })).toBeVisible();
});

test("connexion refusée : message clair, aucune session ouverte", async ({ page }) => {
  const user = await fixtureUser("agentA");

  await page.goto("/connexion");
  await page.getByLabel(APP_TEXTS.auth.emailLabel).fill(user.email);
  await page.getByLabel(APP_TEXTS.auth.passwordLabel).fill("mot-de-passe-invalide");
  await page.getByRole("button", { name: APP_TEXTS.auth.submit }).click();

  await expect(page.getByText(APP_TEXTS.auth.errorTitle)).toBeVisible({ timeout: COLD_START });
  await expect(page.getByText(APP_TEXTS.auth.invalidCredentials)).toBeVisible();
  await expect(page).toHaveURL(/\/connexion$/);
});
