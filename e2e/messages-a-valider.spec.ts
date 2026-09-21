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
  await expect(page.getByText(APP_TEXTS.states.simulation).first()).toBeVisible();

  const target = pendingCards(page).first();
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
  const approved = page
    .locator('[data-testid="pending-message"][data-status="approved"]')
    .first();
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

  const target = pendingCards(page).first();
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

  const target = pendingCards(page).first();
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
  await expect(page.getByText(corrected)).toBeVisible({ timeout: COLD_START });
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
  const stale = pendingCards(page).first();
  await expect(stale).toBeVisible();

  // A colleague decides on the same draft, in another tab of the same session.
  const colleague = await context.newPage();
  await openQueue(colleague);
  await pendingCards(colleague).first().getByTestId("validate-message").click();
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
