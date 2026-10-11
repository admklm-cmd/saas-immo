import { expect, test, type Locator, type Page } from "@playwright/test";

import { APP_TEXTS } from "@/components/texts";
import { AGENT_ERROR_MESSAGES, listLeadFieldLabels } from "@/lib/agents/messages";

import { keepAgentsRunning } from "./helpers/kill-switch";
import { setAiPaused } from "./helpers/local-agency";
import { fixtureUser, signIn } from "./helpers/sign-in";

/**
 * « Leads entrants » — Léa's inbox: the demands received before any contact
 * record exists.
 *
 * The product rule this screen exists for: **a lead is not a consent**. Léa
 * verifies the source, de-duplicates and creates the record; she never records
 * a consent and nothing is ever sent from here.
 *
 * Requires the local Supabase stack with the fixtures loaded (`npm run db:start`;
 * the fixtures are reloaded before the suite by `e2e/global-setup.ts`).
 *
 * Serial mode: launching Léa consumes a pending lead of the fictitious agency,
 * and one test suspends the agency-wide kill switch.
 *
 * The main journey runs Léa on the DUPLICATE lead on purpose. It is the more
 * demanding case (an exact duplicate must never produce a second record), and
 * it leaves the number of contacts of the fixtures untouched — so that
 * `vitest run` stays green after a full `playwright test`, whatever the order
 * (`fixtures/fixtures.integration.test.ts` asserts an exact contact count).
 */
test.describe.configure({ mode: "serial" });

const TEXTS = APP_TEXTS.leadsInbox;
const NAV = APP_TEXTS.nav;
const COLD_START = 60_000;

/**
 * Excerpts of the fictitious leads (`fixtures/dataset.ts`), used to target a
 * precise card: the list is ordered by date, never by identifier.
 */
const LEAD_COMPLETE = "T2 de 44 m²";
const LEAD_DUPLICATE = "je vous ai déjà écrit la semaine";
const LEAD_OF_AGENCY_B = "ne doit jamais apparaître";

test.beforeEach(() => {
  test.setTimeout(150_000);
});

// Léa cannot run while the kill switch is on: start and leave every test with
// an agency whose agents are running, whatever happened in between.
keepAgentsRunning("agentA");

function navigation(page: Page): Locator {
  return page.getByRole("navigation", { name: NAV.primaryLabel });
}

function leadCard(page: Page, excerpt: string): Locator {
  return page.getByTestId("inbound-lead").filter({ hasText: excerpt });
}

/** Opens the inbox the way a user does: from the navigation, never by URL. */
async function openInboxFromNav(page: Page): Promise<void> {
  const link = navigation(page).getByRole("link", { name: NAV.agentsLeads, exact: true });
  // Reachable with the keyboard as well as with the mouse.
  await link.focus();
  await expect(link).toBeFocused();
  await link.click();
  await expect(page).toHaveURL(/\/agents-ia\/leads-entrants$/);
  await expect(page.getByRole("heading", { level: 1, name: TEXTS.title })).toBeVisible({
    timeout: COLD_START,
  });
}

test("parcours principal : l'écran s'atteint par la navigation, puis Léa traite un lead", async ({
  page,
}) => {
  await signIn(page, "agentA");

  // The screen is reachable by clicking, not only by typing its address.
  await openInboxFromNav(page);

  // Exactly one entry is marked as the current page, and it is this one.
  const current = navigation(page).locator('[aria-current="page"]');
  await expect(current).toHaveCount(1);
  await expect(current).toHaveText(NAV.agentsLeads);

  // The rule the screen exists for is stated on the screen itself.
  await expect(page.getByTestId("leads-rule")).toContainText(TEXTS.ruleTitle);
  // Nothing here is a real action.
  await expect(page.getByText(APP_TEXTS.states.simulation).first()).toBeVisible();

  // The lead this journey acts on is an exact duplicate of an existing record:
  // the run must attach it to that record and create NO second contact.
  const target = leadCard(page, LEAD_DUPLICATE);
  await expect(target).toBeVisible({ timeout: COLD_START });
  await expect(target).toHaveAttribute("data-status", "pending");
  await expect(target).toContainText(TEXTS.untrusted);

  await target.getByTestId("run-lea").click();

  // What Léa decided, and the replay of what she really did.
  const result = target.getByTestId("lead-result");
  await expect(result).toBeVisible({ timeout: COLD_START });
  await expect(result).toContainText(TEXTS.successTitle);
  await expect(result).toContainText(TEXTS.duplicateMatched(listLeadFieldLabels(["email", "phone"])));
  await expect(target.getByTestId("lead-replay")).toBeVisible();

  // The lead has left the "to process" state: it will never be run twice.
  await expect
    .poll(async () => target.getAttribute("data-status"), { timeout: COLD_START })
    .not.toBe("pending");
  await page.reload();
  const processed = leadCard(page, LEAD_DUPLICATE);
  await expect(processed).toContainText(TEXTS.alreadyProcessed, { timeout: COLD_START });
  await expect(processed.getByTestId("run-lea")).toHaveCount(0);
  // The record it was attached to is one click away.
  await expect(processed.getByRole("link", { name: TEXTS.contactLink })).toBeVisible();
});

test("cas d'erreur : coupe-circuit actif, Léa refuse et l'écran affiche le message du serveur", async ({
  page,
}) => {
  const user = await fixtureUser("agentA");

  await signIn(page, "agentA");
  await openInboxFromNav(page);

  const target = leadCard(page, LEAD_COMPLETE);
  await expect(target).toBeVisible({ timeout: COLD_START });

  // The agency suspends every AI agent while the screen is already open.
  await setAiPaused(user.agencyId, true);
  await target.getByTestId("run-lea").click();

  const error = target.getByTestId("lead-blocked");
  await expect(error).toBeVisible({ timeout: COLD_START });
  await expect(error).toContainText(AGENT_ERROR_MESSAGES.ai_paused);
  // Nothing was decided, and the action can be retried once the agents are back.
  await expect(target.getByTestId("lead-result")).toHaveCount(0);
  await expect(target.getByTestId("run-lea")).toBeEnabled();
});

test("isolation : l'agence A ne voit jamais le lead de l'agence B", async ({ page }) => {
  await signIn(page, "agentA");
  await openInboxFromNav(page);

  await expect(page.getByTestId("inbound-lead").first()).toBeVisible({ timeout: COLD_START });
  await expect(page.locator("body")).not.toContainText(LEAD_OF_AGENCY_B);
});

test("isolation : l'agence B ne voit jamais les leads de l'agence A", async ({ page }) => {
  await signIn(page, "userB");
  await openInboxFromNav(page);

  // Agency B has its own pending lead in the fixtures.
  await expect(leadCard(page, LEAD_OF_AGENCY_B)).toBeVisible({ timeout: COLD_START });
  await expect(page.locator("body")).not.toContainText(LEAD_COMPLETE);
  await expect(page.locator("body")).not.toContainText(LEAD_DUPLICATE);
});
