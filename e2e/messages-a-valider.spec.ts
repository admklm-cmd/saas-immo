import { expect, test, type Locator, type Page } from "@playwright/test";

import { APP_TEXTS } from "@/components/texts";
import { MESSAGE_REJECTION_REASON_LABELS } from "@/features/agents-ia/types";
import { NOTABLE_CONTACTS } from "@/fixtures/dataset";
import { AGENT_ERROR_MESSAGES } from "@/lib/agents/messages";

import { resetValidationQueue } from "./helpers/local-agency";
import { fixtureUser, signIn } from "./helpers/sign-in";

/**
 * « Messages à valider » — the queue where the product's hardest rule applies:
 * a first contact is ALWAYS validated by a human, and nothing is ever sent for
 * real (no provider is wired; a send is a simulation).
 *
 * Requires the local Supabase stack with the fixtures loaded (`npm run db:reset`).
 *
 * Validating, sending and refusing are one-way transitions, so each test starts
 * from drafts this suite creates and cleans up itself (`resetValidationQueue`):
 * the journey stays replayable without reloading the whole fixtures.
 */
test.describe.configure({ mode: "serial" });

const TEXTS = APP_TEXTS.validationQueue;
const COLD_START = 60_000;
const CONTACT_ID = NOTABLE_CONTACTS.qualifiable;

test.beforeEach(() => {
  test.setTimeout(150_000);
});

function pendingCards(page: Page): Locator {
  return page.locator('[data-testid="pending-message"][data-status="pending_validation"]');
}

/** Dual view: selects the first draft still waiting, and returns its (visible) letter. */
async function openFirstPending(page: Page): Promise<Locator> {
  const tab = page.locator("[role=tab][data-status=\"pending_validation\"]").first();
  await expect(tab).toBeVisible({ timeout: COLD_START });
  const panel = await tab.getAttribute("aria-controls");
  await tab.click();
  return page.locator(`#${panel} [data-testid="pending-message"]`);
}

async function openQueue(page: Page): Promise<void> {
  await page.goto("/agents-ia/a-valider");
  await expect(page.getByRole("heading", { level: 1, name: TEXTS.title })).toBeVisible({
    timeout: COLD_START,
  });
}

test("parcours principal : valider un brouillon, puis déclencher un envoi simulé", async ({ page }) => {
  const user = await fixtureUser("agentA");
  await resetValidationQueue(user.agencyId, CONTACT_ID, 3);

  await signIn(page, "agentA");
  await openQueue(page);

  // The rule the screen exists for is stated on the screen itself.
  await expect(page.getByTestId("validation-rule")).toContainText(TEXTS.ruleTitle);
  await expect(page.getByTestId("validation-rule-human")).toHaveText(TEXTS.ruleHumanDecision);
  await expect(page.getByText(APP_TEXTS.states.simulation).first()).toBeVisible();

  const target = await openFirstPending(page);
  await expect(target).toBeVisible({ timeout: COLD_START });
  const before = await pendingCards(page).count();
  expect(before).toBeGreaterThan(0);

  // --- validating is NOT sending -------------------------------------------
  await expect(target).toContainText(TEXTS.consent);
  await target.getByTestId("validate-message").click();

  const summary = page.getByTestId("decision-summary");
  await expect(summary).toBeVisible({ timeout: COLD_START });
  await expect(summary).toContainText(TEXTS.successValidated);
  await expect
    .poll(async () => pendingCards(page).count(), { timeout: COLD_START })
    .toBe(before - 1);

  // --- the validated draft waits for an explicit, simulated send ------------
  // Dual view: the validated draft stays the letter on the desk.
  const approved = page
    .locator('[role="tabpanel"]:visible [data-testid="pending-message"][data-status="approved"]');
  await expect(approved).toContainText(TEXTS.approvedNotSent);
  await approved.getByTestId("send-message").click();

  await expect(summary).toContainText(TEXTS.successSent, { timeout: COLD_START });
  // « Envoyé » means « envoi simulé » — the screen never says otherwise.
  await expect(summary).toContainText("simulé");
});

test("refus : motif obligatoire, note facultative, le message ne partira pas", async ({ page }) => {
  const user = await fixtureUser("agentA");
  await resetValidationQueue(user.agencyId, CONTACT_ID, 2);

  await signIn(page, "agentA");
  await openQueue(page);

  const target = await openFirstPending(page);
  await expect(target).toBeVisible({ timeout: COLD_START });
  const before = await pendingCards(page).count();
  await target.getByTestId("refuse-message").click();

  const form = target.getByTestId("rejection-form");
  await expect(form).toBeVisible();
  await form.getByLabel(MESSAGE_REJECTION_REASON_LABELS.inappropriate_tone).check();
  await form.getByLabel(TEXTS.rejectNote).fill("Trop insistant pour un premier contact.");
  await form.getByTestId("rejection-confirm").click();

  const summary = page.getByTestId("decision-summary");
  await expect(summary).toBeVisible({ timeout: COLD_START });
  await expect(summary).toContainText(
    MESSAGE_REJECTION_REASON_LABELS.inappropriate_tone,
  );
  await expect
    .poll(async () => pendingCards(page).count(), { timeout: COLD_START })
    .toBe(before - 1);
});

test("correction : le texte est réécrit par un humain et le brouillon reste à valider", async ({ page }) => {
  const user = await fixtureUser("agentA");
  await resetValidationQueue(user.agencyId, CONTACT_ID, 2);

  await signIn(page, "agentA");
  await openQueue(page);

  const target = await openFirstPending(page);
  await expect(target).toBeVisible({ timeout: COLD_START });
  const before = await pendingCards(page).count();

  await target.getByTestId("edit-message").click();
  const form = target.getByTestId("draft-edit-form");
  await expect(form).toBeVisible();
  const corrected = "Bonjour, texte corrigé par un conseiller avant validation.";
  await form.getByLabel(TEXTS.editBody).fill(corrected);
  await form.getByTestId("draft-edit-save").click();

  const summary = page.getByTestId("decision-summary");
  await expect(summary).toBeVisible({ timeout: COLD_START });
  await expect(summary).toContainText(TEXTS.editSuccess);

  // The corrected text is persisted, and the draft still waits for a decision:
  // correcting is never a way around the human validation.
  await page.reload();
  const correctedLetter = page.getByTestId("pending-message").filter({ hasText: corrected });
  await expect(correctedLetter).toHaveCount(1, { timeout: COLD_START });
  await expect(correctedLetter).toHaveAttribute("data-status", "pending_validation");
  await expect
    .poll(async () => pendingCards(page).count(), { timeout: COLD_START })
    .toBe(before);
});

test("cas d'erreur : un brouillon déjà traité par un collègue, message du serveur affiché", async ({
  page,
  context,
}) => {
  const user = await fixtureUser("agentA");
  await resetValidationQueue(user.agencyId, CONTACT_ID, 2);

  await signIn(page, "agentA");
  await openQueue(page);
  const stale = await openFirstPending(page);
  await expect(stale).toBeVisible();

  // A colleague decides on the same draft, in another tab of the same session.
  const colleague = await context.newPage();
  await openQueue(colleague);
  await (await openFirstPending(colleague)).getByTestId("validate-message").click();
  await expect(colleague.getByTestId("decision-summary")).toBeVisible({ timeout: COLD_START });
  await colleague.close();

  // The first tab is now stale: the server refuses, and says why.
  await stale.getByTestId("validate-message").click();
  const error = page.getByTestId("message-action-error");
  await expect(error).toBeVisible({ timeout: COLD_START });
  await expect(error).toContainText(AGENT_ERROR_MESSAGES.outbound_message_not_pending);
});

test("isolation : la file d'une agence ne montre jamais le brouillon d'une autre", async ({ page }) => {
  const user = await fixtureUser("agentA");
  await resetValidationQueue(user.agencyId, CONTACT_ID, 1);

  // Agency B has its own pending draft in the fixtures.
  await signIn(page, "userB");
  await openQueue(page);

  const cards = page.getByTestId("pending-message");
  await expect(cards.first()).toBeVisible({ timeout: COLD_START });
  await expect(page.locator("body")).not.toContainText("Sophie Marchand");
  await expect(page.locator("body")).not.toContainText("Brouillon de test");
});

test("vue double : la file se parcourt au clavier, la lettre suit, sans nouvelle requête", async ({ page }) => {
  const user = await fixtureUser("agentA");
  await resetValidationQueue(user.agencyId, CONTACT_ID, 2);
  await signIn(page, "agentA");
  await openQueue(page);

  const tabs = page.getByRole("tab");
  await expect(tabs.first()).toBeVisible({ timeout: COLD_START });
  const count = await tabs.count();
  expect(count).toBeGreaterThan(1);
  // Every letter is already in the page; only the selected one shows.
  await expect(page.getByTestId("pending-message")).toHaveCount(count);
  await expect(page.locator("[role=tabpanel]:visible")).toHaveCount(1);

  let requests = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" || request.url().includes("_rsc")) requests += 1;
  });

  await tabs.first().focus();
  await page.keyboard.press("ArrowDown");
  await expect(tabs.nth(1)).toBeFocused();
  await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
  const panelId = await tabs.nth(1).getAttribute("aria-controls");
  await expect(page.locator(`#${panelId}`)).toBeVisible();
  await expect(page).toHaveURL(/\?message=/);
  await page.keyboard.press("End");
  await expect(tabs.last()).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Home");
  await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
  expect(requests).toBe(0);

  const visibleLetter = page.locator("[role=tabpanel]:visible").getByTestId("pending-message");
  await expect(visibleLetter.getByTestId("message-rail")).toBeVisible();
  await expect(visibleLetter.getByTestId("decision-bar")).toBeVisible();
});

test("vue double : refuser depuis la lettre, le message reste visible, arrêté à « Vous »", async ({ page }) => {
  const user = await fixtureUser("agentA");
  await resetValidationQueue(user.agencyId, CONTACT_ID, 2);
  await signIn(page, "agentA");
  await openQueue(page);

  await page.getByRole("tab", { name: /Brouillon de test 1/ }).click();
  const letter = page.locator("[role=tabpanel]:visible").getByTestId("pending-message");
  await expect(letter).toContainText("Brouillon de test 1");
  await letter.getByTestId("refuse-message").click();
  await letter.getByTestId("rejection-confirm").click();

  const resolved = page.getByTestId("resolved-message");
  await expect(resolved).toBeVisible({ timeout: COLD_START });
  await expect(resolved).toHaveAttribute("data-outcome", "rejected");
  await expect(resolved.getByTestId("message-rail")).toHaveAttribute("data-human", "stopped");
  await expect(page.getByRole("tab", { name: /Brouillon de test 1/ })).toHaveCount(0);
  await expect(page.getByTestId("decision-summary")).toContainText("il ne partira pas");
});

test("vue double : valider fait franchir « Vous » à la lettre, rien n'est parti", async ({ page }) => {
  const user = await fixtureUser("agentA");
  await resetValidationQueue(user.agencyId, CONTACT_ID, 1);
  await signIn(page, "agentA");
  await openQueue(page);

  await page.getByRole("tab", { name: /Brouillon de test 1/ }).click();
  const letter = page.locator("[role=tabpanel]:visible").getByTestId("pending-message");
  await expect(letter.getByTestId("message-rail")).toHaveAttribute("data-token", "atHuman");
  await letter.getByTestId("validate-message").click();
  await expect(letter.getByTestId("message-rail")).toHaveAttribute("data-token", "atSend", { timeout: COLD_START });
  await expect(letter).toHaveAttribute("data-status", "approved", { timeout: COLD_START });
  await expect(letter).toContainText(TEXTS.approvedNotSent);
  await expect(letter.getByTestId("send-message")).toBeVisible();
});

test.describe("téléphone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("la file, puis la lettre, puis retour à la file", async ({ page }) => {
    const user = await fixtureUser("agentA");
    await resetValidationQueue(user.agencyId, CONTACT_ID, 1);
    await signIn(page, "agentA");
    await openQueue(page);

    const tab = page.getByRole("tab", { name: /Brouillon de test 1/ });
    await expect(tab).toBeVisible({ timeout: COLD_START });
    await expect(page.locator("[role=tabpanel]:visible")).toHaveCount(0);

    await tab.click();
    const letter = page.locator("[role=tabpanel]:visible");
    await expect(letter).toHaveCount(1);
    await expect(letter).toContainText("Brouillon de test 1");
    await expect(page.getByRole("tab").first()).toBeHidden();
    await expect(letter.getByTestId("validate-message")).toBeVisible();

    await letter.getByTestId("back-to-queue").click();
    await expect(page.getByRole("tab", { name: /Brouillon de test 1/ })).toBeFocused();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("sans JavaScript", () => {
  test("toutes les lettres et leurs actions sont dans le HTML, chaque message a son lien", async ({ browser }) => {
    const user = await fixtureUser("agentA");
    await resetValidationQueue(user.agencyId, CONTACT_ID, 2);
    // Sign in with JavaScript, then read the page without it.
    const signed = await browser.newContext();
    const page = await signed.newPage();
    await signIn(page, "agentA");
    const state = await signed.storageState();
    await signed.close();

    const context = await browser.newContext({ javaScriptEnabled: false, storageState: state });
    const noJs = await context.newPage();
    const response = await noJs.goto("/agents-ia/a-valider", { timeout: COLD_START });
    const html = (await response?.text()) ?? "";
    expect(html).toContain("Brouillon de test 1");
    expect(html).toContain("Brouillon de test 2");
    expect(html).toContain("répondez STOP");
    expect(html).toContain('data-testid="validate-message"');
    expect(html).toContain('data-testid="refuse-message"');
    expect(html).toMatch(/href="\/agents-ia\/a-valider\?message=[^"]+"/);
    await context.close();
  });
});
