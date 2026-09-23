import { expect, test, type Locator, type Page } from "@playwright/test";

import { APP_TEXTS, MEMBERSHIP_ROLE_LABELS, RUN_OUTCOME_LABELS } from "@/components/texts";
import {
  APPOINTMENT_STATUS_LABELS,
  CONSENT_CHANNEL_LABELS,
  MESSAGE_STATUS_LABELS,
  PIPELINE_STAGE_LABELS,
  type PipelineStage,
} from "@/features/contacts/types";
import { ESTIMATION_CONSENT_TEXTS } from "@/features/estimation/consent-texts";
import { fictionMobile } from "@/fixtures/fixture-ids";
import { AGENT_ERROR_MESSAGES, AGENT_LABELS } from "@/lib/agents/messages";

import { keepAgentsRunning } from "./helpers/kill-switch";
import { signIn } from "./helpers/sign-in";

/**
 * The DEMONSTRATION JOURNEY, end to end, through the interface only:
 *
 *   public estimation form (prospect, ticks 2 of 4 consents)
 *     → Léa creates the contact file — she drafts NO message (/agents-ia/leads-entrants)
 *     → Hugo qualifies it                          (contact file)
 *     → Louis proposes a slot + drafts the FIRST message (contact file)
 *     → a human validates it, then a SIMULATED send (/agents-ia/a-valider)
 *     → Emma drafts a follow-up                    (contact file)
 *     → a human validates it, then a SIMULATED send (/agents-ia/a-valider)
 *     → a human confirms the slot, then closes it with a report
 *     → Sarah follows it up — she never declares a mandate (/agents-ia/suivi-rendez-vous)
 *     → a HUMAN moves the file to « Mandat signé », explicit confirmation (/pipeline)
 *     → the dashboard counts it, the contact history tells the whole story,
 *       including WHO validated each message and WHEN (as stored server-side)
 *     → Emma is then refused by a guard rail (signed mandate): shown as a block,
 *       not as an error, and the dashboard error count does not move.
 *
 * Why Louis's message is the first one validated (and not a message right after
 * Léa): Léa drafts nothing — a lead is not a consent and she never writes to a
 * prospect. The first outbound draft of the journey is therefore Louis's slot
 * proposal. Emma comes after it, once: her idempotency key is one draft per
 * contact and per Paris day, so a second Emma run the same day would be (rightly)
 * refused (« déjà préparée aujourd'hui »).
 *
 * Replayable: every run creates its OWN prospect (unique name, unique
 * `@example.test` email, unique number in the Arcep fiction block), so nothing
 * depends on a previous run; `e2e/global-setup.ts` reloads the fixtures before
 * each `npx playwright test` anyway. Quotas: 6 agent runs (the last one refused on
 * purpose: no follow-up once the mandate is signed) out of the agency's
 * `ai_daily_run_limit` (100), 1 public submission out of the 3 allowed per IP
 * and per 10 minutes (the estimation spec makes the 2 others).
 *
 * Serial: each step starts where the previous one stopped.
 */
test.describe.configure({ mode: "serial" });

const COLD_START = 60_000;
const ESTIMATION = APP_TEXTS.estimation;
const AGENTS = APP_TEXTS.agents;
const QUEUE = APP_TEXTS.validationQueue;
const FOLLOW = APP_TEXTS.followThrough;
const STAGE_CHANGE = APP_TEXTS.pipeline.stageChange;
const DASHBOARD = APP_TEXTS.dashboard;
const LEADS = APP_TEXTS.leadsInbox;

/** Letters only (the name is displayed and matched), unique per run. */
const RUN_TAG = Date.now()
  .toString()
  .slice(-6)
  .replace(/\d/g, (digit) => "abcdefghij"[Number(digit)]!);
const FIRST_NAME = "Inès";
const LAST_NAME = `Castellan-${RUN_TAG[0]!.toUpperCase()}${RUN_TAG.slice(1)}`;
const FULL_NAME = `${FIRST_NAME} ${LAST_NAME}`;
/** What the lead card may show: first name + initial of the last name, nothing more. */
const LEAD_DISPLAY_NAME = `${FIRST_NAME} ${LAST_NAME[0]!.toUpperCase()}.`;
const EMAIL = `demo.parcours.${Date.now()}@example.test`;
// Arcep fiction block only (fixtures/test-phone-numbers.test.ts scans e2e/).
const PHONE = fictionMobile(`7${String(Date.now() % 1000).padStart(3, "0")}`);
const PROSPECT_MESSAGE =
  "Bonjour, je vends mon appartement T3 de 68 m² à La Ciotat, quartier du Port. " +
  "Mutation professionnelle : je souhaite vendre d'ici 2 mois. " +
  // Unique per run: the lead card shows the prospect's words, not their identity.
  `Dossier de démonstration ${RUN_TAG}.`;
const REPORT =
  "Estimation présentée sur place. Appartement T3 lumineux, balcon, ascenseur. La vendeuse part " +
  "pour une mutation et vise une vente sous deux mois. Elle réfléchit au prix de présentation.";

/** Shared between the serial steps. */
const journey: { contactId: string | null; signedBefore: number | null } = {
  contactId: null,
  signedBefore: null,
};

test.beforeEach(() => {
  test.setTimeout(180_000);
});

// Every agent refuses to run while the kill switch is on: start (and leave)
// each step with an agency whose agents are running.
keepAgentsRunning("agentA");

function escapeForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Field by its exact name, with or without the « (obligatoire) » marker. */
function formLabel(text: string): RegExp {
  return new RegExp(`^${escapeForRegExp(text)}( ${escapeForRegExp(ESTIMATION.requiredMark)})?$`);
}

function contactId(): string {
  if (!journey.contactId) throw new Error("The contact of the journey was not created by Léa.");
  return journey.contactId;
}

async function openContactFile(page: Page): Promise<Locator> {
  await page.goto(`/contacts/${contactId()}`);
  await expect(page.getByRole("heading", { level: 1, name: FULL_NAME })).toBeVisible({ timeout: COLD_START });
  return page.getByTestId("agent-actions");
}

async function readSignedCount(page: Page): Promise<number> {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1, name: DASHBOARD.title })).toBeVisible({ timeout: COLD_START });
  const figure = page.getByTestId("dashboard-stage-mandat_signe").getByTestId("dashboard-figure");
  await expect(figure).toHaveAttribute("data-status", "ok");
  const text = (await figure.innerText()).trim();
  const value = Number.parseInt(text, 10);
  expect(Number.isNaN(value), `figure « ${text} »`).toBe(false);
  return value;
}

/** Today's execution counts on the dashboard: technical errors and guard-rail blocks. */
async function readTodayRunCounts(page: Page): Promise<{ failed: number; blocked: number }> {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1, name: DASHBOARD.title })).toBeVisible({ timeout: COLD_START });
  const today = page.getByTestId("dashboard-runs-today");
  await expect(today).toHaveAttribute("data-status", "ok");
  const read = async (key: "failed" | "blocked") => {
    const text = (await today.getByTestId(`dashboard-runs-today-${key}`).locator("dd").innerText()).trim();
    const value = Number.parseInt(text, 10);
    expect(Number.isNaN(value), `${key} « ${text} »`).toBe(false);
    return value;
  };
  return { failed: await read("failed"), blocked: await read("blocked") };
}

/** Validates the draft of the journey's contact, then triggers the simulated send. */
async function validateThenSendSimulated(page: Page, preparedBy: string): Promise<void> {
  await page.goto("/agents-ia/a-valider");
  await expect(page.getByRole("heading", { level: 1, name: QUEUE.title })).toBeVisible({ timeout: COLD_START });

  const draft = page
    .getByTestId("pending-message")
    .filter({ hasText: FULL_NAME })
    .filter({ hasText: QUEUE.preparedBy(preparedBy) });
  await expect(draft).toHaveCount(1, { timeout: COLD_START });
  await expect(draft).toHaveAttribute("data-status", "pending_validation");
  // What the member decides on: the channel, the consent of that channel, and the text.
  await expect(draft).toContainText(QUEUE.consent);
  await expect(draft.getByText(APP_TEXTS.states.simulation)).toBeVisible();

  // Validating is NOT sending.
  await draft.getByTestId("validate-message").click();
  const summary = page.getByTestId("decision-summary");
  await expect(summary).toContainText(QUEUE.successValidated, { timeout: COLD_START });
  await expect(draft).toHaveAttribute("data-status", "approved", { timeout: COLD_START });
  await expect(draft).toContainText(QUEUE.approvedNotSent);

  // A second, explicit gesture: the send, always simulated.
  await draft.getByTestId("send-message").click();
  await expect(summary).toContainText(QUEUE.successSent, { timeout: COLD_START });
  await expect(summary.getByText(APP_TEXTS.states.simulation)).toBeVisible();
  // Sent: it has left the queue.
  await expect(draft).toHaveCount(0, { timeout: COLD_START });
}

test("0. état de départ : compte « Mandat signé » lu sur le tableau de bord", async ({ page }) => {
  await signIn(page, "agentA");
  journey.signedBefore = await readSignedCount(page);
});

test("1. site public : un prospect demande une estimation et coche deux canaux sur quatre", async ({ page }) => {
  await page.goto("/estimation");
  await expect(page.getByRole("heading", { level: 1, name: ESTIMATION.title })).toBeVisible({ timeout: COLD_START });

  const consents = {
    email: page.getByTestId("estimation-consent-email"),
    sms: page.getByTestId("estimation-consent-sms"),
    whatsapp: page.getByTestId("estimation-consent-whatsapp"),
    phone: page.getByTestId("estimation-consent-phone"),
  };
  // Consent is a positive act: no box is ever pre-ticked.
  for (const box of Object.values(consents)) await expect(box).not.toBeChecked();

  await page.getByLabel(formLabel(ESTIMATION.firstName)).fill(FIRST_NAME);
  await page.getByLabel(formLabel(ESTIMATION.lastName)).fill(LAST_NAME);
  await page.getByLabel(formLabel(ESTIMATION.email)).fill(EMAIL);
  await page.getByLabel(formLabel(ESTIMATION.phone)).fill(PHONE);
  await page.getByLabel(formLabel(ESTIMATION.propertyType)).selectOption({ index: 1 });
  await page.getByLabel(formLabel(ESTIMATION.city)).fill("La Ciotat");
  await page.getByLabel(formLabel(ESTIMATION.postalCode)).fill("13600");
  await page.getByLabel(formLabel(ESTIMATION.message)).fill(PROSPECT_MESSAGE);

  // The exact legal texts are the ones shown next to the boxes.
  await expect(page.getByText(ESTIMATION_CONSENT_TEXTS.email, { exact: true })).toBeVisible();
  await expect(page.getByText(ESTIMATION_CONSENT_TEXTS.sms, { exact: true })).toBeVisible();
  await consents.email.check();
  await consents.sms.check();
  await expect(consents.whatsapp).not.toBeChecked();
  await expect(consents.phone).not.toBeChecked();

  await page.getByTestId("estimation-submit").click();
  await expect(page.getByTestId("estimation-success")).toContainText(ESTIMATION.successBody, {
    timeout: COLD_START,
  });
});

test("2. leads entrants : Léa traite la demande et crée la fiche", async ({ page }) => {
  await signIn(page, "agentA");
  await page.goto("/agents-ia/leads-entrants");
  await expect(page.getByRole("heading", { level: 1, name: APP_TEXTS.leadsInbox.title })).toBeVisible({
    timeout: COLD_START,
  });

  const lead = page.getByTestId("inbound-lead").filter({ hasText: `Dossier de démonstration ${RUN_TAG}.` });
  await expect(lead).toHaveCount(1, { timeout: COLD_START });
  await expect(lead).toHaveAttribute("data-status", "pending");
  // Named just enough to tell homonyms apart: first name + initial, and the commune.
  await expect(lead.getByTestId("lead-name")).toHaveText(LEAD_DISPLAY_NAME);
  await expect(lead.getByTestId("lead-name")).not.toContainText(LAST_NAME);
  await expect(lead.getByTestId("lead-city")).toHaveText("La Ciotat");
  // Not processed yet: no record to open.
  await expect(lead.getByTestId("lead-contact-link")).toHaveCount(0);

  await lead.getByTestId("run-lea").click();
  await expect(lead.getByTestId("lead-result")).toContainText(APP_TEXTS.leadsInbox.successTitle, {
    timeout: COLD_START,
  });
  await expect(lead.getByTestId("lead-replay")).toBeVisible();

  const link = lead.getByRole("link", { name: LEADS.contactLink });
  await expect(link).toBeVisible({ timeout: COLD_START });
  const href = await link.getAttribute("href");
  const match = href?.match(/^\/contacts\/([0-9a-f-]{36})$/);
  expect(match, `lien de fiche : ${href}`).not.toBeNull();
  journey.contactId = match![1]!;

  // Once processed, the card itself (re-read from the server) leads to that very record.
  await page.reload();
  const processed = page.getByTestId("inbound-lead").filter({ hasText: `Dossier de démonstration ${RUN_TAG}.` });
  await expect(processed).not.toHaveAttribute("data-status", "pending", { timeout: COLD_START });
  await expect(processed.getByTestId("lead-name")).toHaveText(LEAD_DISPLAY_NAME);
  const processedLink = processed.getByRole("link", { name: LEADS.contactLink });
  await expect(processedLink).toHaveAttribute("href", `/contacts/${journey.contactId}`);

  await processedLink.click();
  await expect(page.getByRole("heading", { level: 1, name: FULL_NAME })).toBeVisible({ timeout: COLD_START });
  // The consents ticked on the form are on the file — and only those.
  const consents = page.getByTestId("contact-consents");
  await expect(consents.locator('[data-channel="email"]')).toHaveAttribute("data-status", "granted");
  await expect(consents.locator('[data-channel="sms"]')).toHaveAttribute("data-status", "granted");
  await expect(consents.locator('[data-channel="whatsapp"]')).toHaveAttribute("data-status", "none");
  await expect(consents.locator('[data-channel="phone"]')).toHaveAttribute("data-status", "none");
});

test("3. fiche contact : Hugo qualifie le dossier", async ({ page }) => {
  await signIn(page, "agentA");
  const panel = await openContactFile(page);

  await panel.getByRole("button", { name: AGENTS.runHugo }).click();
  const result = panel.getByTestId("agent-result");
  await expect(result).toContainText(AGENTS.hugoSuccessTitle, { timeout: COLD_START });
  // Complete file, sale within two months: « Chaud ».
  await expect(result).toContainText(PIPELINE_STAGE_LABELS.chaud);
});

test("4. Louis propose un créneau ; un humain valide le premier message, envoi simulé", async ({ page }) => {
  await signIn(page, "agentA");
  const panel = await openContactFile(page);

  await panel.getByRole("button", { name: AGENTS.runLouis }).click();
  const result = panel.getByTestId("agent-result");
  await expect(result).toContainText(AGENTS.louisSuccessTitle, { timeout: COLD_START });
  // Nothing leaves before a human decides.
  await expect(result).toContainText(AGENTS.pendingValidation);

  await validateThenSendSimulated(page, AGENT_LABELS.louis);
});

test("5. Emma prépare une relance ; un humain la valide, envoi simulé", async ({ page }) => {
  await signIn(page, "agentA");
  const panel = await openContactFile(page);

  await panel.getByRole("button", { name: AGENTS.runEmma }).click();
  const result = panel.getByTestId("agent-result");
  await expect(result).toContainText(AGENTS.emmaSuccessTitle, { timeout: COLD_START });
  await expect(result).toContainText(AGENTS.pendingValidation);

  await validateThenSendSimulated(page, AGENT_LABELS.emma);
});

test("6. suivi : un humain confirme puis clôture avec compte-rendu, Sarah suit sans rien déclarer signé", async ({
  page,
}) => {
  await signIn(page, "agentA");
  await page.goto("/agents-ia/suivi-rendez-vous");
  await expect(page.getByRole("heading", { level: 1, name: FOLLOW.title })).toBeVisible({ timeout: COLD_START });

  const card = page.getByTestId("sarah-appointment").filter({ hasText: FULL_NAME });
  await expect(card).toHaveCount(1, { timeout: COLD_START });
  // No report yet: Sarah is not offered.
  await expect(card.getByTestId("run-sarah")).toHaveCount(0);

  await card.getByTestId("confirm-appointment").click();
  await expect(card.getByTestId("appointment-workflow-success")).toContainText(FOLLOW.confirmSuccess, {
    timeout: COLD_START,
  });

  await card.getByRole("textbox", { name: FOLLOW.report }).fill(REPORT);
  await card.getByTestId("complete-appointment").click();
  await expect(card.getByTestId("appointment-workflow-success")).toContainText(FOLLOW.completeSuccess, {
    timeout: COLD_START,
  });
  await expect(card).toContainText(REPORT);

  await card.getByTestId("run-sarah").click();
  await expect(card.getByTestId("sarah-result")).toBeVisible({ timeout: COLD_START });
  await expect(card.getByTestId("sarah-analysis")).toBeVisible();
  await expect(card.getByText(APP_TEXTS.states.simulation).first()).toBeVisible();

  // Sarah stops at « Estimation faite »: the mandate is a human decision.
  await openContactFile(page);
  await expect(page.locator("main [data-stage]").first()).toHaveAttribute("data-stage", "estimation_faite");
});

function pipelineCard(page: Page, stage: PipelineStage): Locator {
  return page
    .getByRole("region", { name: PIPELINE_STAGE_LABELS[stage] })
    .getByTestId("pipeline-contact")
    .filter({ hasText: FULL_NAME });
}

test("7. pipeline : un humain passe le dossier en « Mandat signé », case de confirmation cochée", async ({ page }) => {
  await signIn(page, "agentA");
  await page.goto("/pipeline");
  await expect(page.getByRole("heading", { level: 1, name: APP_TEXTS.pipeline.title })).toBeVisible({
    timeout: COLD_START,
  });

  const card = pipelineCard(page, "estimation_faite");
  await expect(card).toBeVisible({ timeout: COLD_START });
  await card.getByRole("button", { name: new RegExp(STAGE_CHANGE.trigger) }).click();
  const menu = card.getByRole("group", { name: STAGE_CHANGE.menuTitle });
  await menu.getByRole("button", { name: new RegExp(`^${PIPELINE_STAGE_LABELS.mandat_signe}`) }).click();

  const dialog = page.getByRole("dialog", { name: STAGE_CHANGE.enterTitle });
  await expect(dialog).toBeVisible();
  const box = dialog.getByRole("checkbox", { name: STAGE_CHANGE.enterCheckbox });
  await expect(box).not.toBeChecked();
  await expect(dialog.getByRole("button", { name: STAGE_CHANGE.enterSubmit })).toBeDisabled();
  await box.check();
  await dialog.getByRole("button", { name: STAGE_CHANGE.enterSubmit }).click();

  await expect(dialog).toBeHidden({ timeout: COLD_START });
  await expect(pipelineCard(page, "mandat_signe")).toBeVisible({ timeout: COLD_START });
  await expect(pipelineCard(page, "estimation_faite")).toHaveCount(0);
});

test("8. tableau de bord et historique : le mandat est compté, chaque étape est tracée", async ({ page }) => {
  const advisor = await signIn(page, "agentA");

  const signedAfter = await readSignedCount(page);
  expect(journey.signedBefore).not.toBeNull();
  expect(signedAfter).toBe(journey.signedBefore! + 1);
  // Nothing of this journey is left waiting for a decision.
  await expect(page.getByTestId("dashboard-messages")).not.toContainText(FULL_NAME);
  await expect(page.getByTestId("dashboard-appointments-to-confirm")).not.toContainText(FULL_NAME);
  await expect(page.getByTestId("dashboard-appointments-to-close")).not.toContainText(FULL_NAME);

  await openContactFile(page);
  await expect(page.locator("main [data-stage]").first()).toHaveAttribute("data-stage", "mandat_signe");

  const timeline = page.getByTestId("contact-timeline");
  await expect(timeline).toBeVisible();
  const entries = timeline.getByRole("listitem");

  // Every agent that worked on this file, named.
  for (const agent of [AGENT_LABELS.lea, AGENT_LABELS.hugo, AGENT_LABELS.emma, AGENT_LABELS.louis, AGENT_LABELS.sarah]) {
    await expect(entries.filter({ has: page.getByText(agent, { exact: true }) }).first(), agent).toBeVisible();
  }
  // Their actions are simulations, and say so.
  await expect(timeline.getByText(APP_TEXTS.states.simulation).first()).toBeVisible();

  // Both drafts left only after the human validation, as simulated sends.
  const sent = `${CONSENT_CHANNEL_LABELS.email} — ${MESSAGE_STATUS_LABELS.sent_simulated}`;
  for (const agent of [AGENT_LABELS.louis, AGENT_LABELS.emma]) {
    const message = entries
      .filter({ has: page.getByText(new RegExp(`^${escapeForRegExp(sent)}`)) })
      .filter({ has: page.getByText(agent, { exact: true }) })
      .first();
    await expect(message, `message de ${agent}`).toBeVisible();
    await expect(message.getByText(APP_TEXTS.states.simulation, { exact: true })).toBeVisible();
    // Who validated it and when: the signed-in conseiller, as stamped by the server.
    const review = message.getByTestId("timeline-review");
    await expect(review).toHaveAttribute("data-outcome", "approved");
    await expect(review).toHaveText(
      new RegExp(
        `^Validé par ${escapeForRegExp(advisor.email)} \\(${MEMBERSHIP_ROLE_LABELS.agent}\\) le \\d{1,2} \\S+ \\d{4} à \\d{2}:\\d{2}$`,
      ),
    );
    await expect(review.locator("time")).toHaveAttribute("datetime", /^\d{4}-\d{2}-\d{2}T/);
    await expect(review).not.toContainText(APP_TEXTS.contact.reviewAuthorUnknown);
  }
  // The appointment, held and closed by a human.
  await expect(
    entries.filter({ hasText: `Rendez-vous d'estimation — ${APPOINTMENT_STATUS_LABELS.done}` }).first(),
  ).toBeVisible();

  // The mandate: a human, never an agent — and never badged as a simulation.
  const mandate = entries
    .filter({
      has: page.getByText(
        APP_TEXTS.contact.timelineStageChange(PIPELINE_STAGE_LABELS.estimation_faite, PIPELINE_STAGE_LABELS.mandat_signe),
        { exact: true },
      ),
    })
    .first();
  await expect(mandate).toBeVisible();
  await expect(mandate.getByText(MEMBERSHIP_ROLE_LABELS.agent, { exact: true })).toBeVisible();
  await expect(mandate.getByText(APP_TEXTS.states.simulation, { exact: true })).toHaveCount(0);
});

test("garde-fou : une fois le mandat signé, Emma est bloquée — un blocage, pas une erreur", async ({ page }) => {
  await signIn(page, "agentA");
  const before = await readTodayRunCounts(page);
  const panel = await openContactFile(page);

  await panel.getByRole("button", { name: AGENTS.runEmma }).click();
  const notice = panel.getByTestId("agent-blocked");
  await expect(notice).toBeVisible({ timeout: COLD_START });
  await expect(notice).toContainText(APP_TEXTS.guardRail.title);
  // The RIGHT reason: the mandate is signed — not a vague « non éligible ».
  await expect(notice).toContainText(AGENT_ERROR_MESSAGES.follow_up_mandate_signed);
  await expect(notice).not.toContainText(AGENT_ERROR_MESSAGES.follow_up_stage_not_eligible);
  // Informative, never an error.
  await expect(notice).toHaveAttribute("role", "status");
  await expect(panel.getByRole("alert")).toHaveCount(0);
  await expect(panel.getByTestId("agent-error")).toHaveCount(0);
  await expect(panel.getByTestId("agent-result")).toHaveCount(0);

  // The history names it as a guard-rail block.
  await page.reload();
  const emmaRun = page
    .getByTestId("contact-timeline")
    .getByRole("listitem")
    .filter({ has: page.getByText(AGENT_LABELS.emma, { exact: true }) })
    .filter({ hasText: RUN_OUTCOME_LABELS.blocked })
    .first();
  await expect(emmaRun).toBeVisible({ timeout: COLD_START });
  await expect(emmaRun).not.toContainText(RUN_OUTCOME_LABELS.failed);

  // Counted as a block, never as an error.
  const after = await readTodayRunCounts(page);
  expect(after.failed).toBe(before.failed);
  expect(after.blocked).toBe(before.blocked + 1);

  // No draft reaches the validation queue.
  await page.goto("/agents-ia/a-valider");
  await expect(page.getByRole("heading", { level: 1, name: QUEUE.title })).toBeVisible({ timeout: COLD_START });
  await expect(page.getByTestId("pending-message").filter({ hasText: FULL_NAME })).toHaveCount(0);
});
