import { expect, test, type Page } from "@playwright/test";

import { BRAND } from "@/components/brand";
import { APP_TEXTS } from "@/components/texts";

import { keepAgentsRunning } from "./helpers/kill-switch";
import { setAiPaused } from "./helpers/local-agency";
import { fixtureUser, signIn } from "./helpers/sign-in";

/**
 * `/dashboard` — the boss's statistics page (docs/design-system.md §3.5.2): where the page
 * sits in the product, what it no longer contains, the reminder « À traiter », the server
 * HTML, isolation between agencies, the session and the kill switch. The period selector, the
 * figures and the charts are covered by `pilotage.spec.ts`.
 *
 * Requires the local Supabase stack with the fixtures loaded (`npm run db:reset`). Nothing here
 * depends on an exact fixture volume. No consent checkbox exists on this screen.
 */
const TEXTS = APP_TEXTS.dashboard;
const COLD_START = 60_000;

keepAgentsRunning("agentA");

test.beforeEach(() => {
  test.setTimeout(120_000);
});

async function openFromLogo(page: Page): Promise<void> {
  await page.locator("aside").getByRole("link", { name: new RegExp(BRAND.name) }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: COLD_START });
  await expect(page.getByRole("heading", { level: 1, name: TEXTS.title })).toBeVisible({ timeout: COLD_START });
}

test("parcours principal : le logo mène à la page de pilotage, trois surfaces, aucun bloc indisponible", async ({ page }) => {
  await signIn(page, "agentA");
  await openFromLogo(page);

  for (const id of ["pilotage-stage", "pilotage-sheet", "pilotage-atelier"]) {
    await expect(page.getByTestId(id)).toBeVisible();
  }
  // Statistics only: the h2 of each block, in the order of the page.
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    TEXTS.pilotage.stage.unit,
    TEXTS.pilotage.origin.title,
    TEXTS.pilotage.flow.title,
    TEXTS.pilotage.atelier.title,
  ]);
  await expect(page.getByText(TEXTS.pilotage.unavailable, { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("pilotage-stage")).toHaveAttribute("data-status", "ok");
});

test("les listes et les statistiques de rendez-vous de l'ancien tableau de bord ont disparu", async ({ page }) => {
  await signIn(page, "agentA");
  await openFromLogo(page);

  for (const id of ["todo", "pipeline", "upcoming", "activity", "agents", "messages", "leads", "tasks"]) {
    await expect(page.getByTestId(`dashboard-${id}`), id).toHaveCount(0);
  }
  await expect(page.getByText(TEXTS.upcomingTitle)).toHaveCount(0);
  await expect(page.getByText(TEXTS.friezeTitle)).toHaveCount(0);
});

test("le rappel « À traiter » mène aux écrans de travail, les liens restent dans l'application", async ({ page }) => {
  await signIn(page, "agentA");
  await openFromLogo(page);

  const reminder = page.getByTestId("todo-reminder");
  await expect(reminder.getByTestId("todo-leads")).toHaveAttribute("href", "/agents-ia/leads-entrants");
  await expect(reminder.getByTestId("todo-tasks")).toHaveAttribute("href", "/taches");
  await expect(reminder.getByTestId("dashboard-primary-action")).toHaveAttribute("href", "/agents-ia/a-valider");

  // Every link of the main area goes to a known screen or to a contact file.
  const allowed = new Set([
    "/agents-ia/a-valider",
    "/agents-ia/leads-entrants",
    "/taches",
    "/agents-ia/suivi-rendez-vous",
    "/contacts",
    "/agents-ia",
  ]);
  const hrefs = await page.locator("main a[href]").evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
  for (const href of hrefs) {
    expect(allowed.has(href) || /^\/contacts\/[0-9a-f-]{36}$/.test(href), `lien inattendu : ${href}`).toBe(true);
  }

  await reminder.getByTestId("dashboard-primary-action").click();
  await expect(page).toHaveURL(/\/agents-ia\/a-valider$/, { timeout: COLD_START });
  await expect(page.getByRole("heading", { level: 1, name: APP_TEXTS.validationQueue.title })).toBeVisible({
    timeout: COLD_START,
  });
});

test("le chiffre des tâches du rappel est le total exact de l'écran qu'il ouvre", async ({ page }) => {
  await signIn(page, "agentA");
  await page.goto("/dashboard");
  const tasks = Number.parseInt((await page.getByTestId("todo-tasks").locator(".figure").textContent()) ?? "", 10);
  expect(Number.isNaN(tasks)).toBe(false);
  await page.getByTestId("todo-tasks").click();
  await expect(page).toHaveURL(/\/taches$/, { timeout: COLD_START });
  await expect(page.getByTestId("tasks-total-value")).toHaveText(String(tasks), { timeout: COLD_START });
});

test("le HTML du serveur contient la période de l'URL et les trois surfaces ; une valeur inconnue retombe sur « 1 an »", async ({
  page,
}) => {
  await signIn(page, "agentA");
  const html = await (await page.request.get("/dashboard?periode=30j")).text();
  expect(html).toContain('data-period="30d"');
  expect(html).toContain('data-testid="pilotage-stage"');
  expect(html).toContain('data-testid="pilotage-sheet"');
  expect(html).toContain('data-testid="pilotage-atelier"');
  expect(html).not.toContain('data-testid="dashboard-todo"');
  const fallback = await (await page.request.get("/dashboard?periode=zzz")).text();
  expect(fallback).toContain('data-period="365d"');
});

test("coupe-circuit actif : la page le dit, la scène des agents ne joue pas et l'arrêt est visible", async ({ page }) => {
  const user = await fixtureUser("agentA");
  await setAiPaused(user.agencyId, true);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await signIn(page, "agentA");
  await page.goto("/dashboard");
  const atelier = page.getByTestId("pilotage-atelier");
  await atelier.scrollIntoViewIfNeeded();
  await expect(atelier).toHaveAttribute("data-mode", "paused", { timeout: COLD_START });
  await expect(page.getByTestId("atelier-paused-banner")).toContainText(TEXTS.pilotage.atelier.killSwitchOn);
  await expect(page.getByTestId("atelier-barrier")).toHaveCount(1);
  await expect(atelier).toHaveAttribute("data-playing", "false");
  await expect(page.getByTestId("atelier-replay")).toHaveCount(0);
  await expect(atelier.getByRole("link", { name: TEXTS.pilotage.atelier.manage })).toHaveAttribute("href", "/agents-ia");
});

test("isolation : l'agence B ne voit jamais les dossiers de l'agence A", async ({ page }) => {
  await signIn(page, "userB");
  await openFromLogo(page);

  const body = page.locator("body");
  for (const name of ["Frederic Masson", "Elodie Mercier", "Camille Berthier", "Marc Aubert", "Urbain Baudoin"]) {
    await expect(body).not.toContainText(name);
  }
  await expect(page.getByTestId("pilotage-stage")).toBeVisible();
});

test("cas d'erreur : sans session, la page de pilotage n'est pas affichée", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/connexion$/, { timeout: COLD_START });
  await expect(page.getByRole("heading", { level: 1, name: TEXTS.title })).toHaveCount(0);
  await expect(page.getByTestId("pilotage")).toHaveCount(0);
});
