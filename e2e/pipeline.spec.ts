import { expect, test, type Locator, type Page } from "@playwright/test";

import { APP_TEXTS } from "@/components/texts";
import { PIPELINE_STAGE_LABELS } from "@/features/contacts/types";
import { NOTABLE_CONTACTS } from "@/fixtures/dataset";

import { signIn } from "./helpers/sign-in";

/**
 * `/pipeline` — read-only board of the agency's contacts by stage.
 *
 * No drag-and-drop, no stage change: every card only links to the contact
 * file. This suite checks the real fixture contacts land in the right
 * column, that a card opens the contact file, and that an agency never sees
 * the other fictitious agency's contacts (same isolation pattern as
 * `e2e/leads-entrants.spec.ts`).
 *
 * Requires the local Supabase stack with the fixtures loaded (`npm run db:reset`).
 */
const TEXTS = APP_TEXTS.pipeline;
const NAV = APP_TEXTS.nav;
const CONTACT_TEXTS = APP_TEXTS.contacts;
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
  await expect(nouveau.getByText("Camille Berthier")).toBeVisible();

  // --- a human takeover is visually identifiable, in its real column ---------
  const takenOverCard = nouveau.getByTestId("pipeline-contact").filter({ hasText: "Amandine Roux" });
  await expect(takenOverCard).toBeVisible();
  await expect(takenOverCard.getByText(CONTACT_TEXTS.humanTakeover)).toBeVisible();

  // --- the far end of the active pipeline -------------------------------------
  const mandateSigned = column(page, PIPELINE_STAGE_LABELS.mandat_signe);
  await expect(mandateSigned.getByText("Alain Chevalier")).toBeVisible();

  // --- `perdu` is shown separately, never mixed into the active columns ------
  const lost = column(page, PIPELINE_STAGE_LABELS.perdu);
  await expect(lost).toBeVisible();
  await expect(lost.getByText("Damien Pons")).toBeVisible();
  await expect(page.getByText(TEXTS.lostSubtitle)).toBeVisible();

  // --- a card is a real link to the contact file, nothing else ---------------
  await nouveau.getByTestId("pipeline-contact").filter({ hasText: "Camille Berthier" }).click();
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

  await expect(column(page, PIPELINE_STAGE_LABELS.nouveau).getByText("Camille Berthier")).toBeVisible({
    timeout: COLD_START,
  });
  await expect(page.locator("body")).not.toContainText("Laurent Bonnet");
});

test("isolation : l'agence B ne voit jamais les contacts de l'agence A", async ({ page }) => {
  await signIn(page, "userB");
  await openPipelineFromNav(page);

  await expect(column(page, PIPELINE_STAGE_LABELS.nouveau).getByText("Laurent Bonnet")).toBeVisible({
    timeout: COLD_START,
  });
  await expect(page.locator("body")).not.toContainText("Camille Berthier");
  await expect(page.locator("body")).not.toContainText("Alain Chevalier");
});
