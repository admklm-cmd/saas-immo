import { expect, test } from "@playwright/test";

import { APP_TEXTS } from "@/components/texts";
import { NOTABLE_CONTACTS } from "@/fixtures/dataset";

import { signIn } from "./helpers/sign-in";

/**
 * `/contacts` and the contact file (Lot 2A): a table from 768 px, one card per
 * contact on a phone; the real states of a file drawn as shapes; the history
 * as a rail of glyph tiles. Requires the local fixtures (`npm run db:reset`).
 */
const TEXTS = APP_TEXTS.contacts;
const COLD_START = 60_000;

test.beforeEach(() => {
  test.setTimeout(120_000);
});

test("parcours principal : la liste mène à la fiche, l'historique montre qui a agi", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, "agentA");

  const table = page.getByRole("table");
  await expect(table).toBeVisible();
  // A taken-over file shows the human shape, with its words for screen readers.
  const row = table.getByRole("row").filter({ hasText: "Amandine Roux" });
  await expect(row.locator('[data-mark="human-takeover"]')).toHaveText(TEXTS.humanTakeover);
  // The same stage badge as the pipeline.
  await expect(row.locator("[data-stage]")).toHaveAttribute("data-stage", "nouveau");

  await table.getByRole("link", { name: "Camille Berthier" }).click();
  await expect(page).toHaveURL(new RegExp(`/contacts/${NOTABLE_CONTACTS.missingInformation}$`), {
    timeout: COLD_START,
  });
  const timeline = page.getByTestId("contact-timeline");
  await expect(timeline).toBeVisible({ timeout: COLD_START });
  const entries = await timeline.locator("li").count();
  await expect(timeline.getByTestId("timeline-mark")).toHaveCount(entries);
  // Guard rails untouched: simulations are still badged, consents are listed per channel.
  await expect(timeline.getByText(APP_TEXTS.states.simulation).first()).toBeVisible();
  await expect(page.getByTestId("contact-consents").locator("[data-channel]")).toHaveCount(4);
  await expect(page.getByText(APP_TEXTS.contact.consentsSubtitle)).toBeVisible();
});

test("téléphone 390 px : une liste de cartes lisible, jamais un tableau qui déborde", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, "agentA");

  await expect(page.getByRole("table")).toBeHidden();
  const list = page.getByRole("list", { name: TEXTS.listLabel });
  await expect(list).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  const card = list.getByTestId("contact-list-item").filter({ hasText: "Camille Berthier" });
  await expect(card.getByText(TEXTS.openTasks(1))).toBeVisible();
  await card.getByRole("link", { name: "Camille Berthier" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Camille Berthier" })).toBeVisible({ timeout: COLD_START });
});

test("cas d'erreur : une fiche inconnue affiche « Contact introuvable » et le retour à la liste", async ({ page }) => {
  await signIn(page, "agentA");
  await page.goto("/contacts/00000000-0000-4000-8000-000000000000");
  await expect(page.getByText(APP_TEXTS.contact.notFoundTitle)).toBeVisible({ timeout: COLD_START });
  await page.getByRole("link", { name: APP_TEXTS.contact.backToList }).last().click();
  await expect(page).toHaveURL(/\/contacts$/, { timeout: COLD_START });
});

for (const width of [1280, 1440]) {
  test(`${width} px : le tableau tient sans défilement horizontal, la dernière colonne est entière`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, "directorA");

    const container = page.getByTestId("contacts-table");
    await expect(container).toBeVisible();
    const box = await container.evaluate((element) => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      right: element.getBoundingClientRect().right,
    }));
    expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

    // The last column, header and every date, is visible from edge to edge.
    const lastHeader = container.getByRole("columnheader", { name: TEXTS.columnUpdated });
    await expect(lastHeader).toBeVisible();
    const headerBox = await lastHeader.boundingBox();
    expect(headerBox!.x + headerBox!.width).toBeLessThanOrEqual(box.right + 0.5);
    const clipped = await container.evaluate((element) =>
      [...element.querySelectorAll("th, td")]
        .filter((cell) => (cell as HTMLElement).offsetParent !== null)
        .filter((cell) => cell.scrollWidth > cell.clientWidth + 1)
        .map((cell) => cell.textContent),
    );
    expect(clipped).toEqual([]);
  });
}
