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
  // A stopped file offers no launch: the sieve shows where it stops.
  await expect(takeover.getByTestId("run-emma")).toHaveCount(0);
  await expect(page.getByTestId("sieve-group-takeover")).toContainText(TEXTS.humanTakeover);
  await expect(page.getByTestId("sieve-group-takeover").getByTestId("emma-follow-up").filter({ hasText: HUMAN_TAKEOVER_CONTACT })).toHaveCount(1);

  // --- a draft is already waiting: no second one is offered, with a way out -
  const pendingDraft = candidateCard(page, PENDING_DRAFT_CONTACT);
  await expect(pendingDraft).toBeVisible({ timeout: COLD_START });
  await expect(pendingDraft.getByTestId("emma-blocked-reason")).toContainText(TEXTS.pendingDraft);
  await expect(pendingDraft.getByTestId("run-emma")).toHaveCount(0);
  await expect(
    page.getByTestId("sieve-group-pendingDraft").getByRole("link", { name: TEXTS.openQueue }),
  ).toHaveAttribute("href", "/agents-ia/a-valider");

  // --- no usable channel: nothing to draft towards -------------------------
  const noChannel = candidateCard(page, CONSENT_MISSING_CONTACT);
  await expect(noChannel).toBeVisible({ timeout: COLD_START });
  await expect(noChannel.getByTestId("emma-blocked-reason")).toContainText(TEXTS.consentOrChannelMissing);
  await expect(noChannel.getByTestId("run-emma")).toHaveCount(0);

  // --- a launchable file: the button works and the draft is created --------
  const ready = candidateCard(page, READY_CONTACT_NAME);
  await expect(ready).toBeVisible({ timeout: COLD_START });
  await expect(ready.getByTestId("run-emma")).toBeEnabled();
  await ready.getByTestId("run-emma").click();

  await expect(ready.getByTestId("emma-result")).toBeVisible({ timeout: COLD_START });
  await expect(ready.getByTestId("emma-result")).toContainText(TEXTS.nothingSent);
  await expect(ready.getByTestId("emma-draft")).toBeVisible();
  await expect(ready.getByTestId("emma-replay")).toBeVisible();
  // The re-read list puts the file with the drafts waiting for a human, and the
  // human checkpoint of its gates is now the one awaiting a decision.
  await expect(
    page.getByTestId("sieve-group-pendingDraft").getByTestId("emma-follow-up").filter({ hasText: READY_CONTACT_NAME }),
  ).toHaveCount(1, { timeout: COLD_START });
  await expect(ready.locator("[data-gate=\"end\"] [data-kind=\"human\"]")).toHaveAttribute("data-state", "active");

  // --- the direct link opens THAT draft in the validation queue -------------
  const toDraft = ready.getByRole("link", { name: TEXTS.openQueue });
  await expect(toDraft).toHaveAttribute("href", /\/agents-ia\/a-valider\?message=/);
  await toDraft.click();
  await expect(
    page.getByRole("heading", { level: 1, name: APP_TEXTS.validationQueue.title }),
  ).toBeVisible({ timeout: COLD_START });
  const opened = page.getByTestId("pending-message").filter({ hasText: READY_CONTACT_NAME });
  await expect(opened).toBeVisible({ timeout: COLD_START });
  await expect(page.getByRole("tab", { selected: true })).toContainText(READY_CONTACT_NAME);
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

test("tamis : décomptes de la liste reçue, prêts puis bloqués par motif", async ({ page }) => {
  await clearEmmaArtefacts(READY_CONTACT_ID);
  await signIn(page, "agentA");
  await page.goto("/agents-ia/relances");
  await expect(page.getByRole("heading", { level: 1, name: TEXTS.title })).toBeVisible({ timeout: COLD_START });

  const rows = page.getByTestId("emma-follow-up");
  await expect(rows.first()).toBeVisible({ timeout: COLD_START });
  const total = await rows.count();
  const readyRows = page.getByTestId("sieve-group-ready").getByTestId("emma-follow-up");
  const blockedRows = page.getByTestId("sieve-group-blocked").getByTestId("emma-follow-up");

  // The band counts exactly what the list shows.
  await expect(page.getByTestId("sieve-total")).toHaveText(String(total));
  await expect(page.getByTestId("sieve-ready")).toContainText(String(await readyRows.count()));
  expect((await readyRows.count()) + (await blockedRows.count())).toBe(total);
  for (const gate of ["takeover", "pendingDraft", "consent"] as const) {
    const inGroup = await page.getByTestId(`sieve-group-${gate}`).getByTestId("emma-follow-up").count();
    await expect(page.getByTestId(`sieve-stopped-${gate}`)).toHaveText(TEXTS.stoppedAt(inGroup));
  }
  // Every ready file can be launched; no stopped file can.
  await expect(readyRows.getByTestId("run-emma")).toHaveCount(await readyRows.count());
  await expect(blockedRows.getByTestId("run-emma")).toHaveCount(0);
  // The rule is said once.
  await expect(page.getByTestId("emma-rule")).toHaveCount(1);
});

test.describe("téléphone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("tamis vertical, lignes empilées, action accessible", async ({ page }) => {
    await signIn(page, "agentA");
    await page.goto("/agents-ia/relances");
    await expect(page.getByRole("heading", { level: 1, name: TEXTS.title })).toBeVisible({ timeout: COLD_START });
    await expect(page.getByTestId("sieve-summary")).toBeVisible();
    const ready = candidateCard(page, READY_CONTACT_NAME);
    await expect(ready.getByTestId("run-emma")).toBeVisible({ timeout: COLD_START });
    // Nothing overflows the phone width.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
