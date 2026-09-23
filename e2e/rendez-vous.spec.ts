import { expect, test, type Page } from "@playwright/test";

import { APP_TEXTS } from "@/components/texts";
import { APPOINTMENT_LIST_ERROR_MESSAGES } from "@/features/appointments/types";

import { signIn } from "./helpers/sign-in";

/**
 * `/rendez-vous` — the agency's estimation appointments.
 *
 * What this suite protects, against the real local database:
 *   * the « À venir » total equals the dashboard « Prochains rendez-vous »
 *     figure, and the dashboard link lands here;
 *   * « Passés » is a URL tab, marked as current;
 *   * every simulated appointment carries the « Simulation » badge;
 *   * an invalid view shows the server's message and a way back;
 *   * agency B never sees agency A's appointments.
 *
 * Read-only: this suite changes nothing, so it can be replayed at will.
 * Assertions never depend on an exact fixture count (other journeys legitimately
 * propose or confirm appointments).
 */
const TEXTS = APP_TEXTS.appointments;
const DASHBOARD = APP_TEXTS.dashboard;
const COLD_START = 60_000;

test.beforeEach(() => {
  test.setTimeout(120_000);
});

function views(page: Page) {
  return page.getByRole("navigation", { name: TEXTS.viewsLabel });
}

test("parcours principal : « Tout voir » du tableau de bord mène ici, avec le même total à venir", async ({ page }) => {
  await signIn(page, "agentA");
  await page.goto("/dashboard");

  const card = page.getByTestId("dashboard-upcoming");
  const figure = card.getByTestId("dashboard-figure");
  await expect(figure).toHaveAttribute("data-status", "ok", { timeout: COLD_START });
  const upcoming = Number.parseInt((await figure.locator("p").first().textContent()) ?? "", 10);
  expect(Number.isNaN(upcoming)).toBe(false);

  await card.getByRole("link", { name: new RegExp(`${DASHBOARD.viewAll}|${DASHBOARD.upcomingLink}`) }).click();
  await expect(page).toHaveURL(/\/rendez-vous$/, { timeout: COLD_START });
  await expect(page.getByRole("heading", { level: 1, name: TEXTS.title })).toBeVisible({ timeout: COLD_START });

  await expect(views(page).getByRole("link", { name: TEXTS.views.upcoming })).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("appointments-total-value")).toHaveText(String(upcoming));
  await expect(page.getByTestId("appointments-total")).toContainText(TEXTS.scopes.upcoming);

  // Fixtures hold upcoming appointments: each simulated one says so in words.
  const rows = page.getByTestId("appointment-row");
  expect(await rows.count()).toBeGreaterThan(0);
  const count = await rows.count();
  for (let index = 0; index < count; index += 1) {
    await expect(rows.nth(index).getByText(APP_TEXTS.states.simulation)).toBeVisible();
  }

  // A follow-through link exists only on a row where an action is possible.
  const actionLinks = page.getByTestId("appointment-follow-through");
  const actions = await actionLinks.count();
  for (let index = 0; index < actions; index += 1) {
    await expect(actionLinks.nth(index)).toHaveAttribute("href", "/agents-ia/suivi-rendez-vous");
  }
});

test("onglet « Passés » : URL, onglet courant, statuts lisibles et lien vers la fiche", async ({ page }) => {
  await signIn(page, "agentA");
  await page.goto("/rendez-vous");

  await views(page).getByRole("link", { name: TEXTS.views.past }).click({ timeout: COLD_START });
  await expect(page).toHaveURL(/\/rendez-vous\?view=past$/, { timeout: COLD_START });
  await expect(views(page).getByRole("link", { name: TEXTS.views.past })).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("appointments-total")).toContainText(TEXTS.scopes.past);

  const list = page.getByTestId("appointment-list");
  await expect(list).toContainText("Réalisé");
  await expect(list.getByText(APP_TEXTS.states.simulation).first()).toBeVisible();

  const contactLink = list.locator('a[href^="/contacts/"]').first();
  const href = await contactLink.getAttribute("href");
  expect(href).toMatch(/^\/contacts\/[0-9a-f-]{36}$/);
  await contactLink.click();
  await expect(page).toHaveURL(new RegExp(`${href}$`), { timeout: COLD_START });
});

test("cas d'erreur : une vue inconnue affiche le message du serveur et un retour", async ({ page }) => {
  await signIn(page, "agentA");
  await page.goto("/rendez-vous?view=demain");

  const alert = page.getByTestId("appointments-error");
  await expect(alert).toContainText(APPOINTMENT_LIST_ERROR_MESSAGES.invalid_appointment_filter, {
    timeout: COLD_START,
  });
  await alert.getByRole("link", { name: TEXTS.resetFilters }).click();
  await expect(page).toHaveURL(/\/rendez-vous$/, { timeout: COLD_START });
  await expect(page.getByTestId("appointments-total")).toBeVisible({ timeout: COLD_START });
});

test("isolation : l'agence B ne voit jamais les rendez-vous de l'agence A", async ({ page }) => {
  await signIn(page, "userB");
  await page.goto("/rendez-vous");

  await expect(page.getByTestId("appointment-list")).toContainText("Martine Lopez", { timeout: COLD_START });
  const body = page.locator("body");
  for (const name of ["Frederic Masson", "Isabelle Dubreuil", "Yannick Perrot"]) {
    await expect(body).not.toContainText(name);
  }
});
