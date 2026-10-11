import { expect, test, type Locator, type Page } from "@playwright/test";

import { APP_TEXTS } from "@/components/texts";
import { CONTACT_SOURCE_LABELS } from "@/features/contacts/types";
import { ESTIMATION_CONSENT_TEXTS } from "@/features/estimation/consent-texts";
import { ESTIMATION_ERROR_MESSAGES } from "@/features/estimation/types";

import { signIn } from "./helpers/sign-in";

/**
 * `/estimation` — the public estimation request form, the product's main
 * lead-acquisition channel: a visitor who is NOT signed in describes their
 * property, explicitly ticks the channels they authorise, and the request
 * becomes a raw lead in Léa's inbox (`/agents-ia/leads-entrants`).
 *
 * Rate limiting: the server refuses a 4th submission from the same IP
 * fingerprint within 10 minutes (`private.estimation_submissions`, see
 * `docs/security.md` §2.8). This file makes exactly TWO real submissions
 * (one success, one honeypot rejection; the two other tests are refused in
 * the browser, or never submit at all) — well under that cap — and never
 * needs its own cleanup helper: `private.estimation_submissions.agency_id`
 * references the fixture agency `ON DELETE CASCADE`, and Playwright's own
 * `global-setup.ts` already reloads the fixtures (deleting and recreating
 * both fixture agencies) before every `npx playwright test` invocation, which
 * wipes the rate-limit table for us the same way it wipes every other row
 * this suite might have left behind.
 *
 * Serial on purpose: the two submitting tests share the public form and would
 * otherwise race for the same rate-limit bucket (`workers: 1` already serialises the
 * whole suite, but the intent is explicit here, matching the other specs
 * that share mutable state, e.g. `leads-entrants.spec.ts`).
 */
test.describe.configure({ mode: "serial" });

const TEXTS = APP_TEXTS.estimation;
const NAV = APP_TEXTS.nav;
const COLD_START = 60_000;

test.beforeEach(() => {
  test.setTimeout(120_000);
});

function navigation(page: Page): Locator {
  return page.getByRole("navigation", { name: NAV.primaryLabel });
}

function escapeForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Matches a field by its name, with or without the visible "(obligatoire)"
 * marker required fields carry. Anchored on both ends on purpose: a plain
 * `getByLabel("Nom")` also matches "Prénom" and "Nombre de pièces".
 */
function label(text: string): RegExp {
  return new RegExp(`^${escapeForRegExp(text)}( ${escapeForRegExp(TEXTS.requiredMark)})?$`);
}

async function fillRequiredFields(page: Page, email: string): Promise<void> {
  await page.getByLabel(label(TEXTS.firstName)).fill("Camille");
  await page.getByLabel(label(TEXTS.lastName)).fill("Testeuse");
  await page.getByLabel(label(TEXTS.email)).fill(email);
  await page.getByLabel(label(TEXTS.city)).fill("La Ciotat");
  await page.getByLabel(label(TEXTS.postalCode)).fill("13600");
}

test("parcours principal : un visiteur envoie une demande d'estimation, qui rejoint les leads de l'agence", async ({
  page,
}) => {
  const marker = `e2e-estimation-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;

  await page.goto("/estimation");
  await expect(page.getByRole("heading", { level: 1, name: TEXTS.title })).toBeVisible();

  // Consent is a positive act: every channel starts unticked.
  const emailConsent = page.getByTestId("estimation-consent-email");
  await expect(emailConsent).not.toBeChecked();
  await expect(page.getByTestId("estimation-consent-sms")).not.toBeChecked();
  await expect(page.getByTestId("estimation-consent-whatsapp")).not.toBeChecked();
  await expect(page.getByTestId("estimation-consent-phone")).not.toBeChecked();

  await fillRequiredFields(page, `e2e.estimation.${Date.now()}@example.test`);
  await page.getByLabel(label(TEXTS.message)).fill(marker);

  // Usable without a mouse: the box is reachable and ticked with the keyboard
  // alone, and the legal text it carries is the one recorded as proof.
  await emailConsent.focus();
  await expect(emailConsent).toBeFocused();
  await page.keyboard.press("Space");
  await expect(emailConsent).toBeChecked();
  await expect(page.getByText(ESTIMATION_CONSENT_TEXTS.email, { exact: true })).toBeVisible();

  // The privacy notice is reachable from the form itself.
  await expect(
    page.getByRole("link", { name: TEXTS.privacyPolicyLink }),
  ).toHaveAttribute("href", "/politique-confidentialite");

  // The one promise this screen is never allowed to make.
  await expect(page.locator("body")).not.toContainText("€");

  await page.getByTestId("estimation-submit").click();

  const success = page.getByTestId("estimation-success");
  await expect(success).toBeVisible({ timeout: COLD_START });
  await expect(success).toContainText(TEXTS.successBody);
  await expect(success).not.toContainText("€");
  // Nothing left to click: a double click cannot submit it twice.
  await expect(page.getByTestId("estimation-submit")).toHaveCount(0);

  // A member of the agency signs in and finds the raw lead, untouched.
  await signIn(page, "agentA");
  const link = navigation(page).getByRole("link", { name: NAV.agentsLeads, exact: true });
  await link.click();
  await expect(page).toHaveURL(/\/agents-ia\/leads-entrants$/);
  await expect(page.getByRole("heading", { level: 1, name: APP_TEXTS.leadsInbox.title })).toBeVisible({
    timeout: COLD_START,
  });

  const lead = page.getByTestId("inbound-lead").filter({ hasText: marker });
  await expect(lead).toBeVisible({ timeout: COLD_START });
  await expect(lead).toContainText(CONTACT_SOURCE_LABELS.estimation_form);
  await expect(lead).toHaveAttribute("data-status", "pending");
  // Léa has not run yet: the action is still offered, nothing decided it.
  await expect(lead.getByTestId("run-lea")).toBeVisible();
});

test("cas d'erreur : sans case cochée, rien n'est envoyé et le visiteur sait quoi corriger", async ({ page }) => {
  await page.goto("/estimation");

  await fillRequiredFields(page, `e2e.sans-consentement.${Date.now()}@example.test`);
  await page.getByTestId("estimation-submit").click();

  // No channel authorised: the form refuses locally, so nothing leaves the
  // browser and no rate-limit slot is consumed.
  await expect(page.getByTestId("estimation-form-error")).toBeVisible();
  await expect(page.getByTestId("consent-group-error")).toHaveText(TEXTS.consentGroupError);
  await expect(page.getByTestId("estimation-success")).toHaveCount(0);
  // The message stays plain French: no field path, no schema, no code.
  await expect(page.getByTestId("estimation-form-error")).not.toContainText(/consents|zod|schema/i);

  // The visitor fixes it on the spot: ticking a box is all that was missing.
  await page.getByTestId("estimation-consent-email").check();
  await expect(page.getByTestId("estimation-consent-email")).toBeChecked();
});

test("la politique de confidentialité est atteignable depuis le formulaire", async ({ page }) => {
  await page.goto("/estimation");

  await page.getByRole("link", { name: TEXTS.privacyPolicyLink }).click();

  await expect(page).toHaveURL(/\/politique-confidentialite$/);
  await expect(page.getByRole("heading", { level: 1, name: APP_TEXTS.privacy.title })).toBeVisible({
    timeout: COLD_START,
  });
  // What the form promises must be written here, and nothing more.
  await expect(page.getByText(APP_TEXTS.privacy.prototypeNotice)).toBeVisible();
  await expect(page.locator("main")).not.toContainText("€");

  await page.getByRole("link", { name: APP_TEXTS.privacy.backToEstimation }).click();
  await expect(page.getByRole("heading", { level: 1, name: TEXTS.title })).toBeVisible();
});

test("cas d'erreur : un remplissage automatisé du champ piège est refusé par le serveur", async ({ page }) => {
  await page.goto("/estimation");

  await fillRequiredFields(page, `e2e.honeypot.${Date.now()}@example.test`);
  await page.getByTestId("estimation-consent-email").check();

  // A scripted filler that ticks every input it finds, including the trap —
  // real visitors never reach it (off-screen, aria-hidden, out of tab order).
  await page.locator('input[name="website"]').fill("http://spam.example.test", { force: true });

  await page.getByTestId("estimation-submit").click();

  const error = page.getByTestId("estimation-server-error");
  await expect(error).toBeVisible({ timeout: COLD_START });
  // The exact same generic message a normal visitor would see for any other
  // invalid submission — never a hint that a trap exists.
  await expect(error).toContainText(ESTIMATION_ERROR_MESSAGES.validation_failed);
  await expect(page.locator("body")).not.toContainText(/piège|honeypot/i);

  // The visitor can still try again: the form was not silently replaced.
  await expect(page.getByTestId("estimation-submit")).toBeVisible();
});
