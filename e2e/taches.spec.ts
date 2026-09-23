import { expect, test, type Page } from "@playwright/test";

import { APP_TEXTS } from "@/components/texts";
import { NOTABLE_CONTACTS } from "@/fixtures/dataset";
import { FIXTURE_AGENCY_IDS } from "@/fixtures/fixture-ids";
import { TASK_ERROR_MESSAGES } from "@/features/tasks/types";

import { signIn } from "./helpers/sign-in";
import { clearE2eTasks, E2E_TASK_TITLE, resetE2eTask } from "./helpers/tasks";

/**
 * `/taches` — the agency's open tasks.
 *
 * What this suite protects, against the real local database:
 *   * the dashboard « Tâches ouvertes » figure equals the « Toutes » total, and
 *     its link lands on this screen;
 *   * « Marquer comme faite » removes the task, decrements the exact total, and
 *     the dashboard agrees;
 *   * « En retard » is a URL filter, written in words;
 *   * a task links to its contact file;
 *   * an invalid filter shows the server's message and a way back;
 *   * agency B never sees agency A's tasks.
 *
 * Replayable: the journey completes a task of its own (`resetE2eTask`), never a
 * fixture task — a closed task cannot be reopened from the interface.
 */
const TEXTS = APP_TEXTS.tasks;
const DASHBOARD = APP_TEXTS.dashboard;
const COLD_START = 60_000;
const CONTACT_ID = NOTABLE_CONTACTS.qualifiable;

test.beforeEach(async () => {
  test.setTimeout(120_000);
  await resetE2eTask(FIXTURE_AGENCY_IDS.a, CONTACT_ID);
});

test.afterAll(async () => {
  await clearE2eTasks(FIXTURE_AGENCY_IDS.a);
});

async function dashboardOpenTasks(page: Page): Promise<number> {
  await page.goto("/dashboard");
  const figure = page.getByTestId("dashboard-tasks").getByTestId("dashboard-figure");
  await expect(figure).toHaveAttribute("data-status", "ok", { timeout: COLD_START });
  const text = (await figure.locator("p").first().textContent()) ?? "";
  const count = Number.parseInt(text, 10);
  expect(Number.isNaN(count)).toBe(false);
  return count;
}

async function listTotal(page: Page): Promise<number> {
  const text = (await page.getByTestId("tasks-total-value").textContent()) ?? "";
  return Number.parseInt(text, 10);
}

function e2eRow(page: Page) {
  return page.getByTestId("task-row").filter({ hasText: E2E_TASK_TITLE });
}

test("parcours principal : du tableau de bord à « Marquer comme faite », total et tableau de bord cohérents", async ({
  page,
}) => {
  await signIn(page, "agentA");
  const before = await dashboardOpenTasks(page);

  // The dashboard card leads here (« Tout voir » when the sample is partial).
  await page
    .getByTestId("dashboard-tasks")
    .getByRole("link", { name: new RegExp(`${DASHBOARD.viewAll}|${DASHBOARD.tasksLink}`) })
    .click();
  await expect(page).toHaveURL(/\/taches$/, { timeout: COLD_START });
  await expect(page.getByRole("heading", { level: 1, name: TEXTS.title })).toBeVisible({ timeout: COLD_START });

  // Same definition as the dashboard figure.
  expect(await listTotal(page)).toBe(before);
  await expect(page.getByTestId("tasks-total")).toContainText(TEXTS.scopes.all);
  await expect(
    page.getByRole("navigation", { name: TEXTS.filtersLabel }).getByRole("link", { name: TEXTS.filters.all }),
  ).toHaveAttribute("aria-current", "page");

  // The suite's task: overdue, said in words, linked to its contact.
  const row = e2eRow(page);
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(TEXTS.overdue);
  await expect(row.locator(`a[href="/contacts/${CONTACT_ID}"]`)).toBeVisible();

  await row.getByRole("button", { name: new RegExp(TEXTS.complete) }).click();

  await expect(page.getByTestId("task-completion-status")).toContainText(TEXTS.completed(E2E_TASK_TITLE), {
    timeout: COLD_START,
  });
  await expect(e2eRow(page)).toHaveCount(0, { timeout: COLD_START });
  await expect(page.getByTestId("tasks-total-value")).toHaveText(String(before - 1));

  // The dashboard counts the same rows.
  expect(await dashboardOpenTasks(page)).toBe(before - 1);
});

test("le filtre « En retard » est une URL, marqué comme courant, et liste la tâche échue", async ({ page }) => {
  await signIn(page, "agentA");
  await page.goto("/taches");

  const filters = page.getByRole("navigation", { name: TEXTS.filtersLabel });
  await filters.getByRole("link", { name: TEXTS.filters.overdue }).click({ timeout: COLD_START });

  await expect(page).toHaveURL(/\/taches\?scope=overdue$/, { timeout: COLD_START });
  await expect(filters.getByRole("link", { name: TEXTS.filters.overdue })).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("tasks-total")).toContainText(TEXTS.scopes.overdue);
  await expect(e2eRow(page)).toHaveCount(1);
  // Every task of this filter says « En retard » in words.
  const rows = page.getByTestId("task-row");
  const count = await rows.count();
  for (let index = 0; index < count; index += 1) {
    await expect(rows.nth(index)).toContainText(TEXTS.overdue);
  }
});

test("une tâche mène à la fiche de son contact", async ({ page }) => {
  await signIn(page, "agentA");
  await page.goto("/taches");

  await e2eRow(page).locator(`a[href="/contacts/${CONTACT_ID}"]`).click({ timeout: COLD_START });
  await expect(page).toHaveURL(new RegExp(`/contacts/${CONTACT_ID}$`), { timeout: COLD_START });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: COLD_START });
});

test("cas d'erreur : un filtre inconnu affiche le message du serveur et un retour", async ({ page }) => {
  await signIn(page, "agentA");
  await page.goto("/taches?scope=inconnu");

  const alert = page.getByTestId("tasks-error");
  await expect(alert).toContainText(TASK_ERROR_MESSAGES.invalid_task_filter, { timeout: COLD_START });
  await alert.getByRole("link", { name: TEXTS.resetFilters }).click();
  await expect(page).toHaveURL(/\/taches$/, { timeout: COLD_START });
  await expect(page.getByTestId("tasks-total")).toBeVisible({ timeout: COLD_START });
});

test("isolation : l'agence B ne voit jamais les tâches de l'agence A", async ({ page }) => {
  await signIn(page, "userB");
  await page.goto("/taches");

  await expect(page.getByTestId("tasks-total")).toBeVisible({ timeout: COLD_START });
  await expect(page.getByTestId("task-list")).toContainText("Information manquante : projet du vendeur");
  const body = page.locator("body");
  for (const text of [E2E_TASK_TITLE, "Recueillir le consentement avant tout contact", "Camille Berthier"]) {
    await expect(body).not.toContainText(text);
  }
});

test("sans session, l'écran n'est pas affiché", async ({ page }) => {
  await page.goto("/taches");
  await expect(page).toHaveURL(/\/connexion$/, { timeout: COLD_START });
});
