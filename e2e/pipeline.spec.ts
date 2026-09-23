import { expect, test, type Locator, type Page } from "@playwright/test";

import { APP_TEXTS } from "@/components/texts";
import { PIPELINE_STAGE_LABELS } from "@/features/contacts/types";
import { NOTABLE_CONTACTS } from "@/fixtures/dataset";
import { fixtureUuid } from "@/fixtures/fixture-ids";

import { restoreContactStage } from "./helpers/contact-stage";
import { signIn } from "./helpers/sign-in";

/**
 * `/pipeline` — board of the agency's contacts by stage.
 *
 * No drag-and-drop: every card links to the contact file and offers a
 * keyboard-accessible « Changer d'étape » menu. This suite checks the real
 * fixture contacts land in the right column, that a card opens the contact
 * file, that an agency never sees the other fictitious agency's contacts
 * (same isolation pattern as `e2e/leads-entrants.spec.ts`), and the human
 * stage change: plain move, entry into « Mandat signé » with an explicit
 * confirmation, exit refused to an agent, exit by a director with a motive.
 *
 * The stage-change journey works on a dedicated fixture contact that no
 * other spec uses (Olivier Sanchez) and always puts it back on its starting
 * stage afterwards, so the suite stays replayable and never shifts the
 * counts another spec reads.
 *
 * Requires the local Supabase stack with the fixtures loaded (`npm run db:reset`).
 */
const TEXTS = APP_TEXTS.pipeline;
const NAV = APP_TEXTS.nav;
const CONTACT_TEXTS = APP_TEXTS.contacts;
const STAGE_TEXTS = TEXTS.stageChange;
const COLD_START = 60_000;

test.beforeEach(() => {
  test.setTimeout(120_000);
});

function navigation(page: Page): Locator {
  return page.getByRole("navigation", { name: NAV.primaryLabel });
}

function column(page: Page, stageLabel: string): Locator {
  return page.getByRole("region", { name: stageLabel });
}

/** Opens the board the way a user does: from the navigation, never by URL. */
async function openPipelineFromNav(page: Page): Promise<void> {
  const link = navigation(page).getByRole("link", { name: NAV.pipeline, exact: true });
  await link.focus();
  await expect(link).toBeFocused();
  await link.click();
  await expect(page).toHaveURL(/\/pipeline$/);
  await expect(page.getByRole("heading", { level: 1, name: TEXTS.title })).toBeVisible({
    timeout: COLD_START,
  });
}

test("parcours principal : les contacts de l'agence apparaissent dans la bonne colonne, un clic ouvre la fiche", async ({
  page,
}) => {
  await signIn(page, "agentA");
  await openPipelineFromNav(page);

  const current = navigation(page).locator('[aria-current="page"]');
  await expect(current).toHaveCount(1);
  await expect(current).toHaveText(NAV.pipeline);

  // --- an active stage, a contact with nothing special -----------------------
  const nouveau = column(page, PIPELINE_STAGE_LABELS.nouveau);
  await expect(nouveau).toBeVisible({ timeout: COLD_START });
  await expect(nouveau.getByText("Camille Berthier", { exact: true })).toBeVisible();

  // --- a human takeover is visually identifiable, in its real column ---------
  const takenOverCard = nouveau.getByTestId("pipeline-contact").filter({ hasText: "Amandine Roux" });
  await expect(takenOverCard).toBeVisible();
  await expect(takenOverCard.getByText(CONTACT_TEXTS.humanTakeover)).toBeVisible();

  // --- the far end of the active pipeline -------------------------------------
  const mandateSigned = column(page, PIPELINE_STAGE_LABELS.mandat_signe);
  await expect(mandateSigned.getByText("Alain Chevalier", { exact: true })).toBeVisible();

  // --- `perdu` is shown separately, never mixed into the active columns ------
  const lost = column(page, PIPELINE_STAGE_LABELS.perdu);
  await expect(lost).toBeVisible();
  await expect(lost.getByText("Damien Pons", { exact: true })).toBeVisible();
  await expect(page.getByText(TEXTS.lostSubtitle)).toBeVisible();

  // --- a card is a real link to the contact file, nothing else ---------------
  await nouveau
    .getByTestId("pipeline-contact")
    .filter({ hasText: "Camille Berthier" })
    .getByRole("link", { name: /Camille Berthier/ })
    .click();
  await expect(page).toHaveURL(new RegExp(`/contacts/${NOTABLE_CONTACTS.missingInformation}$`), {
    timeout: COLD_START,
  });
  await expect(page.getByRole("heading", { level: 1, name: "Camille Berthier" })).toBeVisible({
    timeout: COLD_START,
  });
});

test("isolation : l'agence A ne voit jamais les contacts de l'agence B", async ({ page }) => {
  await signIn(page, "agentA");
  await openPipelineFromNav(page);

  await expect(
    column(page, PIPELINE_STAGE_LABELS.nouveau).getByText("Camille Berthier", { exact: true }),
  ).toBeVisible({ timeout: COLD_START });
  await expect(page.locator("body")).not.toContainText("Laurent Bonnet");
});

test("isolation : l'agence B ne voit jamais les contacts de l'agence A", async ({ page }) => {
  await signIn(page, "userB");
  await openPipelineFromNav(page);

  await expect(
    column(page, PIPELINE_STAGE_LABELS.nouveau).getByText("Laurent Bonnet", { exact: true }),
  ).toBeVisible({ timeout: COLD_START });
  await expect(page.locator("body")).not.toContainText("Camille Berthier");
  await expect(page.locator("body")).not.toContainText("Alain Chevalier");
});

// -----------------------------------------------------------------------------
// Human stage change
// -----------------------------------------------------------------------------

/** Dedicated contact: used by no other spec, starts in « Qualifié » (fixtures). */
const MOVED_NAME = "Olivier Sanchez";
const MOVED_ID = fixtureUuid("contact:olivier-sanchez");
const MOVED_START = "qualifie" as const;
const EXIT_REASON = "Le vendeur a résilié le mandat (test de bout en bout).";

function movedCard(page: Page, stageLabel: string): Locator {
  return column(page, stageLabel).getByTestId("pipeline-contact").filter({ hasText: MOVED_NAME });
}

function trigger(card: Locator): Locator {
  return card.getByRole("button", { name: new RegExp(STAGE_TEXTS.trigger) });
}

/** Opens the card's menu with the keyboard only, and returns it. */
async function openStageMenu(page: Page, stageLabel: string): Promise<Locator> {
  const card = movedCard(page, stageLabel);
  await expect(card).toBeVisible({ timeout: COLD_START });
  const button = trigger(card);
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(button).toHaveAttribute("aria-expanded", "true");
  const menu = card.getByRole("group", { name: STAGE_TEXTS.menuTitle });
  await expect(menu).toBeVisible();
  return menu;
}

function stageOption(menu: Locator, label: string): Locator {
  return menu.getByRole("button", { name: new RegExp(`^${label}`) });
}

async function openMovedContactFile(page: Page, stageLabel: string): Promise<Locator> {
  await movedCard(page, stageLabel).getByRole("link", { name: new RegExp(MOVED_NAME) }).click();
  await expect(page).toHaveURL(new RegExp(`/contacts/${MOVED_ID}$`), { timeout: COLD_START });
  const timeline = page.getByTestId("contact-timeline");
  await expect(timeline).toBeVisible({ timeout: COLD_START });
  return timeline;
}

function timelineChange(page: Page, timeline: Locator, from: string, to: string): Locator {
  return timeline
    .getByRole("listitem")
    .filter({ has: page.getByText(APP_TEXTS.contact.timelineStageChange(from, to), { exact: true }) })
    .first();
}

test.describe.serial("changement d'étape depuis le pipeline", () => {
  test.beforeAll(async () => {
    await restoreContactStage(MOVED_ID, MOVED_START);
  });

  test.afterAll(async () => {
    await restoreContactStage(MOVED_ID, MOVED_START);
  });

  test("parcours principal : un conseiller change l'étape, la carte change de colonne et l'historique le montre", async ({
    page,
  }) => {
    await signIn(page, "agentA");
    await openPipelineFromNav(page);

    const menu = await openStageMenu(page, PIPELINE_STAGE_LABELS.qualifie);
    const current = stageOption(menu, PIPELINE_STAGE_LABELS.qualifie);
    await expect(current).toHaveAttribute("aria-current", "true");
    await expect(current).toHaveAttribute("aria-disabled", "true");

    // Escape closes the menu without writing anything.
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();

    const reopened = await openStageMenu(page, PIPELINE_STAGE_LABELS.qualifie);
    await stageOption(reopened, PIPELINE_STAGE_LABELS.chaud).click();

    await expect(page.getByTestId("pipeline-stage-status")).toContainText(
      STAGE_TEXTS.success(MOVED_NAME, PIPELINE_STAGE_LABELS.chaud),
      { timeout: COLD_START },
    );
    await expect(movedCard(page, PIPELINE_STAGE_LABELS.chaud)).toBeVisible({ timeout: COLD_START });
    await expect(movedCard(page, PIPELINE_STAGE_LABELS.qualifie)).toHaveCount(0);

    const timeline = await openMovedContactFile(page, PIPELINE_STAGE_LABELS.chaud);
    const change = timelineChange(page, timeline, PIPELINE_STAGE_LABELS.qualifie, PIPELINE_STAGE_LABELS.chaud);
    await expect(change).toBeVisible();
    // A human CRM decision: never badged as a simulation.
    await expect(change.getByText(APP_TEXTS.states.simulation, { exact: true })).toHaveCount(0);
  });

  test("mandat signé : la confirmation est obligatoire, la case n'est jamais précochée", async ({ page }) => {
    await signIn(page, "agentA");
    await openPipelineFromNav(page);

    let menu = await openStageMenu(page, PIPELINE_STAGE_LABELS.chaud);
    await stageOption(menu, PIPELINE_STAGE_LABELS.mandat_signe).click();

    let dialog = page.getByRole("dialog", { name: STAGE_TEXTS.enterTitle });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(STAGE_TEXTS.enterHumanRule)).toBeVisible();
    await expect(dialog.getByRole("checkbox", { name: STAGE_TEXTS.enterCheckbox })).not.toBeChecked();
    await expect(dialog.getByRole("button", { name: STAGE_TEXTS.enterSubmit })).toBeDisabled();

    // Escape cancels: nothing moves, the focus is back on the card's trigger.
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger(movedCard(page, PIPELINE_STAGE_LABELS.chaud))).toBeFocused();

    menu = await openStageMenu(page, PIPELINE_STAGE_LABELS.chaud);
    await stageOption(menu, PIPELINE_STAGE_LABELS.mandat_signe).click();
    dialog = page.getByRole("dialog", { name: STAGE_TEXTS.enterTitle });
    const box = dialog.getByRole("checkbox", { name: STAGE_TEXTS.enterCheckbox });
    await expect(box).not.toBeChecked();
    await box.check();
    await dialog.getByRole("button", { name: STAGE_TEXTS.enterSubmit }).click();

    await expect(dialog).toBeHidden({ timeout: COLD_START });
    await expect(movedCard(page, PIPELINE_STAGE_LABELS.mandat_signe)).toBeVisible({ timeout: COLD_START });
    await expect(movedCard(page, PIPELINE_STAGE_LABELS.chaud)).toHaveCount(0);
  });

  test("cas d'erreur : un conseiller ne peut pas sortir un dossier de « Mandat signé »", async ({ page }) => {
    await signIn(page, "agentA");
    await openPipelineFromNav(page);

    const menu = await openStageMenu(page, PIPELINE_STAGE_LABELS.mandat_signe);
    await expect(menu.getByText(STAGE_TEXTS.exitDirectorOnly)).toBeVisible();
    const back = stageOption(menu, PIPELINE_STAGE_LABELS.estimation_faite);
    await expect(back).toHaveAttribute("aria-disabled", "true");

    // aria-disabled (not `disabled`): still reachable with the keyboard, so the
    // reason is announced — but activating it does nothing.
    await back.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.reload();
    await expect(movedCard(page, PIPELINE_STAGE_LABELS.mandat_signe)).toBeVisible({ timeout: COLD_START });
  });

  test("un directeur sort un dossier de « Mandat signé » avec un motif, conservé dans l'historique", async ({
    page,
  }) => {
    await signIn(page, "directorA");
    await openPipelineFromNav(page);

    const menu = await openStageMenu(page, PIPELINE_STAGE_LABELS.mandat_signe);
    await expect(menu.getByText(STAGE_TEXTS.exitDirectorOnly)).toHaveCount(0);
    await stageOption(menu, PIPELINE_STAGE_LABELS.qualifie).click();

    const dialog = page.getByRole("dialog", { name: STAGE_TEXTS.exitTitle });
    await expect(dialog).toBeVisible();
    const box = dialog.getByRole("checkbox", { name: STAGE_TEXTS.exitCheckbox });
    const reason = dialog.getByRole("textbox", { name: STAGE_TEXTS.reasonLabel });
    const confirm = dialog.getByRole("button", { name: STAGE_TEXTS.exitSubmit });
    await expect(box).not.toBeChecked();
    await expect(confirm).toBeDisabled();

    await box.check();
    await expect(confirm).toBeDisabled(); // the motive is still missing
    await reason.fill("ok");
    await expect(confirm).toBeDisabled(); // under 3 characters
    await reason.fill(EXIT_REASON);
    await expect(dialog.getByText(STAGE_TEXTS.reasonCounter(EXIT_REASON.length, 500))).toBeVisible();
    await confirm.click();

    await expect(dialog).toBeHidden({ timeout: COLD_START });
    await expect(movedCard(page, PIPELINE_STAGE_LABELS.qualifie)).toBeVisible({ timeout: COLD_START });
    await expect(movedCard(page, PIPELINE_STAGE_LABELS.mandat_signe)).toHaveCount(0);

    const timeline = await openMovedContactFile(page, PIPELINE_STAGE_LABELS.qualifie);
    const exit = timelineChange(page, timeline, PIPELINE_STAGE_LABELS.mandat_signe, PIPELINE_STAGE_LABELS.qualifie);
    await expect(exit).toContainText(EXIT_REASON);
    // The signature itself stays in the history (append-only).
    await expect(
      timelineChange(page, timeline, PIPELINE_STAGE_LABELS.chaud, PIPELINE_STAGE_LABELS.mandat_signe),
    ).toBeVisible();
  });
});
