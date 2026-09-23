import { expect, test, type Locator, type Page } from "@playwright/test";

import { BRAND } from "@/components/brand";
import { APP_TEXTS } from "@/components/texts";

import { signIn } from "./helpers/sign-in";

/**
 * `/dashboard` — what waits for the agency, its pipeline, its AI agents and
 * its next appointments.
 *
 * What this suite protects, against the real local database:
 *   * the logo of the signed-in space leads to the dashboard;
 *   * every block is there, « À faire maintenant » first, each figure with its
 *     scope, and no « Indisponible » in normal conditions;
 *   * the action links land on the right screen or contact file;
 *   * a pipeline figure equals what `/pipeline` shows (exact counts, not a page);
 *   * an agency never sees the other agency's contacts;
 *   * without a session, the screen is not rendered (sign-in instead).
 *
 * Requires the local Supabase stack with the fixtures loaded (`npm run db:reset`).
 * Assertions never depend on an exact fixture count: other journeys of the
 * suite legitimately consume drafts and appointments.
 */
const TEXTS = APP_TEXTS.dashboard;
const COLD_START = 60_000;

test.beforeEach(() => {
  test.setTimeout(120_000);
});

/** Opens the dashboard the way a user does: through the logo of the signed-in space. */
async function openDashboardFromLogo(page: Page): Promise<void> {
  const logoLink = page.locator("aside").getByRole("link", { name: new RegExp(BRAND.name) });
  await logoLink.click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: COLD_START });
  await expect(page.getByRole("heading", { level: 1, name: TEXTS.title })).toBeVisible({
    timeout: COLD_START,
  });
}

function card(page: Page, id: string): Locator {
  return page.getByTestId(`dashboard-${id}`);
}

test("parcours principal : le logo mène au tableau de bord, chaque bloc affiche ses chiffres avec leur périmètre", async ({
  page,
}) => {
  await signIn(page, "agentA");
  await openDashboardFromLogo(page);

  // --- « À faire maintenant » comes first ---------------------------------------
  const h2 = page.getByRole("heading", { level: 2 });
  await expect(h2.first()).toHaveText(TEXTS.todoTitle);

  const scopes: Array<[string, string]> = [
    ["messages", TEXTS.scopes.pending_all_time],
    ["leads", TEXTS.scopes.pending_all_time],
    ["tasks", TEXTS.scopes.open_all_time],
    ["appointments-to-confirm", TEXTS.scopes.pending_all_time],
    ["appointments-to-close", TEXTS.scopes.pending_all_time],
    ["upcoming", TEXTS.scopes.upcoming],
  ];
  for (const [id, scope] of scopes) {
    const block = card(page, id);
    await expect(block).toBeVisible();
    await expect(block.getByTestId("dashboard-figure")).toHaveAttribute("data-status", "ok");
    await expect(block.getByTestId("dashboard-scope")).toContainText(scope);
  }

  // The messages figure says honestly what it counts.
  await expect(card(page, "messages")).toContainText(/pas encore envoyés?/);
  await expect(card(page, "messages")).toContainText(TEXTS.messagesHint);

  // --- Pipeline: one figure per stage, with its scope ---------------------------
  const pipeline = card(page, "pipeline");
  await expect(pipeline).toBeVisible();
  await expect(pipeline.getByTestId("dashboard-figure")).toHaveCount(7);
  await expect(pipeline.getByTestId("dashboard-scope").first()).toContainText(TEXTS.scopes.current);

  // --- Agents IA: kill switch state + today / 7 days ----------------------------
  const agents = card(page, "agents");
  await expect(agents.getByTestId("dashboard-kill-switch")).toHaveAttribute("data-status", "ok");
  await expect(agents.getByTestId("dashboard-runs-today")).toContainText(TEXTS.scopes.today);
  await expect(agents.getByTestId("dashboard-runs-last-7-days")).toContainText(TEXTS.scopes.last_7_days);
  await expect(agents.getByText(TEXTS.runsBlocked)).toHaveCount(2);

  // --- Normal conditions: nothing is unavailable --------------------------------
  await expect(page.getByText(TEXTS.unavailable, { exact: true })).toHaveCount(0);
});

test("les liens d'action mènent au bon écran ou à la bonne fiche", async ({ page }) => {
  await signIn(page, "agentA");
  await openDashboardFromLogo(page);

  // A contact of the « À faire maintenant » block → its file.
  const contactLink = page.getByTestId("dashboard-todo").locator('a[href^="/contacts/"]').first();
  await expect(contactLink).toBeVisible();
  const href = await contactLink.getAttribute("href");
  expect(href).toMatch(/^\/contacts\/[0-9a-f-]{36}$/);
  await contactLink.click();
  await expect(page).toHaveURL(new RegExp(`${href}$`), { timeout: COLD_START });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: COLD_START });

  // The validation queue.
  await page.goto("/dashboard");
  await card(page, "messages").getByRole("link", { name: new RegExp(`${TEXTS.messagesLink}|${TEXTS.viewAll}`) }).click();
  await expect(page).toHaveURL(/\/agents-ia\/a-valider$/, { timeout: COLD_START });
  await expect(page.getByRole("heading", { level: 1, name: APP_TEXTS.validationQueue.title })).toBeVisible({
    timeout: COLD_START,
  });

  // The agents screen, where the kill switch is operated.
  await page.goto("/dashboard");
  await page.getByRole("link", { name: TEXTS.agentsLink }).click();
  await expect(page).toHaveURL(/\/agents-ia$/, { timeout: COLD_START });
  await expect(page.getByTestId("kill-switch")).toBeVisible({ timeout: COLD_START });
});

test("chaque bloc renvoie vers l'écran qui liste ce qu'il compte, jamais vers une vue inadaptée", async ({ page }) => {
  await signIn(page, "agentA");
  await openDashboardFromLogo(page);

  // Link at the foot of each block → the screen that handles that work.
  const expected: Array<[string, string]> = [
    ["messages", "/agents-ia/a-valider"],
    ["leads", "/agents-ia/leads-entrants"],
    ["tasks", "/taches"],
    ["appointments-to-confirm", "/agents-ia/suivi-rendez-vous"],
    ["appointments-to-close", "/agents-ia/suivi-rendez-vous"],
    ["upcoming", "/rendez-vous"],
    ["pipeline", "/pipeline"],
    ["agents", "/agents-ia"],
  ];
  for (const [id, href] of expected) {
    await expect(card(page, id).locator(`a[href="${href}"]`).last()).toBeVisible();
  }

  // Every link of the screen goes to one of those screens or to a contact file.
  const allowed = new Set(expected.map(([, href]) => href));
  const hrefs = await page.locator("main a[href]").evaluateAll((links) =>
    links.map((link) => link.getAttribute("href") ?? ""),
  );
  expect(hrefs.length).toBeGreaterThan(0);
  for (const href of hrefs) {
    expect(allowed.has(href) || /^\/contacts\/[0-9a-f-]{36}$/.test(href), `lien inattendu : ${href}`).toBe(true);
  }
});

test("un compte du pipeline est identique à celui de l'écran Pipeline", async ({ page }) => {
  await signIn(page, "agentA");
  await openDashboardFromLogo(page);

  const figure = page.getByTestId("dashboard-stage-nouveau").getByTestId("dashboard-figure");
  const text = (await figure.locator("p").first().textContent()) ?? "";
  const count = Number.parseInt(text, 10);
  expect(Number.isNaN(count)).toBe(false);

  await page.getByRole("link", { name: TEXTS.pipelineLink }).click();
  await expect(page).toHaveURL(/\/pipeline$/, { timeout: COLD_START });
  await expect(page.getByTestId("pipeline-column-nouveau")).toContainText(
    APP_TEXTS.pipeline.columnCount(count),
    { timeout: COLD_START },
  );
});

test("isolation : l'agence B ne voit jamais les dossiers de l'agence A", async ({ page }) => {
  await signIn(page, "userB");
  await openDashboardFromLogo(page);

  await expect(card(page, "todo")).toBeVisible();
  const body = page.locator("body");
  for (const name of ["Frederic Masson", "Elodie Mercier", "Camille Berthier", "Marc Aubert"]) {
    await expect(body).not.toContainText(name);
  }
});

test("cas d'erreur : sans session, le tableau de bord n'est pas affiché", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/connexion$/, { timeout: COLD_START });
  await expect(page.getByRole("heading", { level: 1, name: TEXTS.title })).toHaveCount(0);
});
