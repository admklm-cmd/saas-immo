import { expect, test, type Page, type Route } from "@playwright/test";

import { APP_TEXTS } from "@/components/texts";
import { NOTABLE_CONTACTS } from "@/fixtures/dataset";

import { resetValidationQueue } from "./helpers/local-agency";
import { fixtureUser, signIn } from "./helpers/sign-in";

/**
 * Micro-interactions tied to REAL states (docs/design-system.md §2.5):
 * passive dots while a draft waits for a human, the three-dot loader while a
 * request is in flight, an error that shakes once and offers « Réessayer »
 * only when the operation can really be relaunched, and one request per
 * double click.
 *
 * The network failure is produced by aborting the server action request in
 * the browser: nothing in the product is stubbed.
 */
test.describe.configure({ mode: "serial" });

const TEXTS = APP_TEXTS.validationQueue;
const COLD_START = 60_000;
const CONTACT_ID = NOTABLE_CONTACTS.qualifiable;

test.beforeEach(() => {
  test.setTimeout(150_000);
});

function isServerAction(route: Route): boolean {
  const request = route.request();
  return request.method() === "POST" && request.headers()["next-action"] !== undefined;
}

async function openQueue(page: Page): Promise<void> {
  await page.goto("/agents-ia/a-valider");
  await expect(page.getByRole("heading", { level: 1, name: TEXTS.title })).toBeVisible({
    timeout: COLD_START,
  });
}

/** Dual view: the letter shown on the desk, once the first waiting draft is selected. */
async function firstPendingCard(page: Page) {
  const tab = page.locator('[role="tab"][data-status="pending_validation"]').first();
  await expect(tab).toBeVisible({ timeout: COLD_START });
  const panel = await tab.getAttribute("aria-controls");
  await tab.click();
  return page.locator(`#${panel} [data-testid="pending-message"]`);
}

test("attente passive : les points « en attente » accompagnent le statut « À valider »", async ({ page }) => {
  const user = await fixtureUser("agentA");
  await resetValidationQueue(user.agencyId, CONTACT_ID, 2);

  await signIn(page, "agentA");
  await openQueue(page);

  const card = await firstPendingCard(page);
  await expect(card).toBeVisible({ timeout: COLD_START });
  await expect(card.getByTestId("pending-dots")).toBeAttached();
  // Decorative only: the badge text carries the status.
  await expect(card.getByTestId("pending-dots")).toHaveAttribute("aria-hidden", "true");
  await expect(card).not.toHaveAttribute("aria-busy", "true");
});

test("cas d'erreur : une coupure réseau affiche l'erreur, puis « Réessayer » relance la même décision", async ({
  page,
}) => {
  const user = await fixtureUser("agentA");
  await resetValidationQueue(user.agencyId, CONTACT_ID, 2);

  await signIn(page, "agentA");
  await openQueue(page);

  const card = await firstPendingCard(page);
  await expect(card).toBeVisible({ timeout: COLD_START });

  let attempts = 0;
  await page.route("**/agents-ia/a-valider", async (route) => {
    if (!isServerAction(route)) return route.continue();
    attempts += 1;
    return route.abort("internetdisconnected");
  });

  await card.getByTestId("validate-message").click();

  const error = card.getByTestId("message-action-error");
  await expect(error).toBeVisible({ timeout: COLD_START });
  await expect(error).toHaveAttribute("role", "alert");
  await expect(error).toContainText(TEXTS.actionErrorTitle);
  await expect(error).toContainText(APP_TEXTS.states.unexpected);
  // The loader stopped at once; the red dots are there, next to the words.
  await expect(card.getByTestId("three-dot-loader")).toHaveCount(0);
  await expect(error.getByTestId("error-dots")).toBeAttached();
  expect(attempts).toBe(1);

  // Network back: « Réessayer » relaunches the same validation.
  await page.unroute("**/agents-ia/a-valider");
  await error.getByTestId("message-action-error-retry").click();

  await expect(page.getByTestId("decision-summary")).toContainText(TEXTS.successValidated, {
    timeout: COLD_START,
  });
});

test("double clic : une seule requête part", async ({ page }) => {
  const user = await fixtureUser("agentA");
  await resetValidationQueue(user.agencyId, CONTACT_ID, 2);

  await signIn(page, "agentA");
  await openQueue(page);

  const card = await firstPendingCard(page);
  await expect(card).toBeVisible({ timeout: COLD_START });

  let actions = 0;
  await page.route("**/agents-ia/a-valider", async (route) => {
    if (isServerAction(route)) actions += 1;
    return route.continue();
  });

  await card.getByTestId("validate-message").dblclick();
  await expect(page.getByTestId("decision-summary")).toContainText(TEXTS.successValidated, {
    timeout: COLD_START,
  });
  expect(actions).toBe(1);
  await page.unroute("**/agents-ia/a-valider");
});

test.describe("mouvement", () => {
  test.use({ reducedMotion: "no-preference" });

  test("le badge Simulation flotte quand le mouvement est autorisé", async ({ page }) => {
    await signIn(page, "agentA");
    await openQueue(page);
    const badge = page.locator(".simulation-badge").first();
    await expect(badge).toBeVisible();
    expect(await badge.evaluate((node) => getComputedStyle(node).animationName)).toBe("simulation-float");
  });
});

test("réduction des animations : badge immobile, libellé conservé", async ({ page }) => {
  // Project default: reducedMotion "reduce".
  await signIn(page, "agentA");
  await openQueue(page);
  const badge = page.locator(".simulation-badge").first();
  await expect(badge).toBeVisible();
  await expect(badge).toContainText(APP_TEXTS.states.simulation);
  expect(await badge.evaluate((node) => getComputedStyle(node).animationName)).toBe("none");
});

test("garde-fou : un refus de règle s'affiche comme information, sans « Réessayer »", async ({ page }) => {
  await signIn(page, "agentA");
  // Signed mandate: Emma refuses by rule (eligibility), nothing is written.
  await page.goto(`/contacts/${NOTABLE_CONTACTS.mandateSigned}`);
  const panel = page.getByTestId("agent-actions");
  await expect(panel).toBeVisible({ timeout: COLD_START });

  await panel.getByRole("button", { name: APP_TEXTS.agents.runEmma }).click();

  const notice = panel.getByTestId("agent-blocked");
  await expect(notice).toBeVisible({ timeout: COLD_START });
  await expect(notice).toHaveAttribute("role", "status");
  await expect(notice).toContainText(APP_TEXTS.guardRail.title);
  await expect(panel.getByTestId("agent-error")).toHaveCount(0);
  await expect(panel.getByRole("button", { name: APP_TEXTS.states.retry })).toHaveCount(0);
  await expect(panel.getByTestId("three-dot-loader")).toHaveCount(0);
  await expect(panel).not.toHaveAttribute("aria-busy", "true");
});

test.describe("arrivée des cartes", () => {
  test.use({ reducedMotion: "no-preference" });

  test("une fois arrivées, les cartes ne gardent aucune animation ni transformation", async ({ page }) => {
    await signIn(page, "agentA");
    await openQueue(page);
    const card = page.locator('[role="tabpanel"]:visible [data-testid="pending-message"]');
    await expect(card).toBeVisible({ timeout: COLD_START });
    // Poll until every arrival animation has finished (550 ms + capped stagger).
    await expect
      .poll(() => card.evaluate((node) => node.getAnimations().length), { timeout: 5_000 })
      .toBe(0);
    expect(await card.evaluate((node) => getComputedStyle(node).transform)).toBe("none");
  });
});
