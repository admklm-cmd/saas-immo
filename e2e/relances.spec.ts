import { expect, test, type Locator, type Page } from "@playwright/test";

import { APP_TEXTS } from "@/components/texts";
import { fixtureUuid } from "@/fixtures/fixture-ids";
import { AGENT_ERROR_MESSAGES } from "@/lib/agents/messages";

import { keepAgentsRunning } from "./helpers/kill-switch";
import { clearEmmaArtefacts, setAiPaused } from "./helpers/local-agency";
import { fixtureUser, signIn } from "./helpers/sign-in";

/**
 * « Relances Emma » — the manual workspace where a human launches a follow-up
 * draft. No cadence is ever claimed: the screen only shows what the server
 * computed (channel, pending draft, human takeover), and the server rechecks
 * every condition again at click time.
 *
 * Requires the local Supabase stack with the fixtures loaded (`npm run db:reset`).
 */
test.describe.configure({ mode: "serial" });

const TEXTS = APP_TEXTS.emmaFollowUps;
const NAV = APP_TEXTS.nav;
const COLD_START = 60_000;

// Stable fixture contacts (see fixtures/dataset.ts): each was seeded to land
// on a specific, well-known state of the Emma workspace.
const READY_CONTACT_NAME = "Nicolas Fabre";
const READY_CONTACT_ID = fixtureUuid("contact:nicolas-fabre");
const HUMAN_TAKEOVER_CONTACT = "Amandine Roux";
const PENDING_DRAFT_CONTACT = "Sophie Marchand";
const CONSENT_MISSING_CONTACT = "Julien Ottavi";

test.beforeEach(() => test.setTimeout(150_000));
keepAgentsRunning("agentA");

function navigation(page: Page): Locator {
  return page.getByRole("navigation", { name: NAV.primaryLabel });
}

function candidateCard(page: Page, name: string): Locator {
  return page.getByTestId("emma-follow-up").filter({ hasText: name });
}

async function openRelancesFromNav(page: Page): Promise<void> {
  const link = navigation(page).getByRole("link", { name: NAV.agentsFollowUps, exact: true });
  await link.focus();
  await expect(link).toBeFocused();
  await link.click();
  await expect(page).toHaveURL(/\/agents-ia\/relances$/);
  await expect(page.getByRole("heading", { level: 1, name: TEXTS.title })).toBeVisible({
    timeout: COLD_START,
  });
}

test("parcours principal : les dossiers bloqués expliquent pourquoi, un dossier prêt part en relance", async ({
  page,
}) => {
  await clearEmmaArtefacts(READY_CONTACT_ID);
  await signIn(page, "agentA");
  await openRelancesFromNav(page);

  const current = navigation(page).locator('[aria-current="page"]');
  await expect(current).toHaveCount(1);
  await expect(current).toHaveText(NAV.agentsFollowUps);
  await expect(page.getByTestId("emma-rule")).toContainText(TEXTS.ruleTitle);
  await expect(page.getByText(APP_TEXTS.states.simulation).first()).toBeVisible();

  // --- a conseiller took the file over: automation must stay stopped --------
  const takeover = candidateCard(page, HUMAN_TAKEOVER_CONTACT);
  await expect(takeover).toBeVisible({ timeout: COLD_START });
  await expect(takeover.getByTestId("emma-blocked-reason")).toContainText(TEXTS.humanTakeover);
  await expect(takeover.getByTestId("run-emma")).toBeDisabled();

  // --- a draft is already waiting: no second one is offered, with a way out -
  const pendingDraft = candidateCard(page, PENDING_DRAFT_CONTACT);
  await expect(pendingDraft).toBeVisible({ timeout: COLD_START });
  await expect(pendingDraft.getByTestId("emma-blocked-reason")).toContainText(TEXTS.pendingDraft);
  await expect(pendingDraft.getByTestId("run-emma")).toBeDisabled();
  await expect(pendingDraft.getByRole("link", { name: TEXTS.openQueue })).toHaveAttribute(
    "href",
    "/agents-ia/a-valider",
  );

  // --- no usable channel: nothing to draft towards -------------------------
  const noChannel = candidateCard(page, CONSENT_MISSING_CONTACT);
  await expect(noChannel).toBeVisible({ timeout: COLD_START });
  await expect(noChannel.getByTestId("emma-blocked-reason")).toContainText(TEXTS.consentOrChannelMissing);
  await expect(noChannel.getByTestId("run-emma")).toBeDisabled();

  // --- a launchable file: the button works and the draft is created --------
  const ready = candidateCard(page, READY_CONTACT_NAME);
  await expect(ready).toBeVisible({ timeout: COLD_START });
  await expect(ready.getByTestId("run-emma")).toBeEnabled();
  await ready.getByTestId("run-emma").click();

  await expect(ready.getByTestId("emma-result")).toBeVisible({ timeout: COLD_START });
  await expect(ready.getByTestId("emma-result")).toContainText(TEXTS.nothingSent);
  await expect(ready.getByTestId("emma-draft")).toBeVisible();
  await expect(ready.getByTestId("emma-replay")).toBeVisible();

  // --- it now waits for a human in the validation queue --------------------
  await page.goto("/agents-ia/a-valider");
  await expect(
    page.getByRole("heading", { level: 1, name: APP_TEXTS.validationQueue.title }),
  ).toBeVisible({ timeout: COLD_START });
  await expect(
    page.getByTestId("pending-message").filter({ hasText: READY_CONTACT_NAME }),
  ).toBeVisible({ timeout: COLD_START });
});

test("cas d'erreur : le coupe-circuit refuse Emma malgré un dossier affiché comme prêt", async ({ page }) => {
  const user = await fixtureUser("agentA");
  await clearEmmaArtefacts(READY_CONTACT_ID);
  await signIn(page, "agentA");
  await openRelancesFromNav(page);

  const ready = candidateCard(page, READY_CONTACT_NAME);
  await expect(ready).toBeVisible({ timeout: COLD_START });
  await expect(ready.getByTestId("run-emma")).toBeEnabled();

  // The screen only shows a display convenience: the server is still the sole
  // authority and refuses the run once the kill switch is on.
  await setAiPaused(user.agencyId, true);
  await ready.getByTestId("run-emma").click();

  await expect(ready.getByTestId("emma-blocked")).toContainText(AGENT_ERROR_MESSAGES.ai_paused, {
    timeout: COLD_START,
  });
  await expect(ready.getByTestId("emma-result")).toHaveCount(0);
  await expect(ready.getByTestId("run-emma")).toBeEnabled();
});
