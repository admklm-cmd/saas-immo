import { expect, test, type Locator, type Page } from "@playwright/test";

import { APP_TEXTS } from "@/components/texts";

import { keepAgentsRunning } from "./helpers/kill-switch";
import { signIn } from "./helpers/sign-in";

/**
 * « First glance » of every signed-in screen at the 1440 x 900 reference
 * (docs/plans/2026-09-26-typography-particles.md): without scrolling, the page
 * title and the one action that matters are both visible. The title is the
 * Geist display face (role « title »), never the body face.
 *
 * Requires the local Supabase stack with the fixtures (e2e/global-setup.ts).
 * The kill switch is kept running so that its « Suspendre » button is the one
 * on screen.
 */
test.describe.configure({ mode: "serial" });

const COLD_START = 60_000;
const VIEWPORT = { width: 1440, height: 900 } as const;

keepAgentsRunning("agentA");

test.beforeEach(() => {
  test.setTimeout(240_000);
});

type Screen = {
  path: string;
  title: string | RegExp;
  primary: (page: Page) => Locator;
};

const SCREENS: Screen[] = [
  {
    path: "/dashboard",
    title: APP_TEXTS.dashboard.title,
    primary: (page) => page.getByTestId("dashboard-primary-action"),
  },
  {
    path: "/contacts",
    title: APP_TEXTS.contacts.title,
    // Opening a seller's file: the first row of the table.
    primary: (page) => page.getByTestId("contacts-table").getByRole("link").first(),
  },
  {
    path: "/pipeline",
    title: APP_TEXTS.pipeline.title,
    primary: (page) =>
      page
        .getByTestId("pipeline-contact")
        .getByRole("button", { name: new RegExp(APP_TEXTS.pipeline.stageChange.trigger) })
        .first(),
  },
  {
    path: "/agents-ia",
    title: APP_TEXTS.agentsIa.title,
    primary: (page) => page.getByRole("button", { name: APP_TEXTS.killSwitch.pause }),
  },
  {
    path: "/agents-ia/a-valider",
    title: APP_TEXTS.validationQueue.title,
    // The decision on the open message (or, once everything was decided by
    // another journey, the send of a validated one, or the empty state's action).
    primary: (page) =>
      page
        .getByRole("button", { name: APP_TEXTS.validationQueue.validate, exact: true })
        .or(page.getByRole("button", { name: APP_TEXTS.validationQueue.send }))
        .or(page.getByRole("link", { name: APP_TEXTS.validationQueue.emptyAction }))
        .first(),
  },
  {
    path: "/rendez-vous",
    title: APP_TEXTS.appointments.title,
    primary: (page) => page.getByTestId("appointments-primary-action"),
  },
  {
    path: "/taches",
    title: APP_TEXTS.tasks.title,
    primary: (page) =>
      page
        .getByRole("button", { name: new RegExp(`^${APP_TEXTS.tasks.complete}`) })
        .or(page.getByRole("link", { name: APP_TEXTS.tasks.emptyAction }))
        .first(),
  },
  {
    path: "/parametres",
    title: APP_TEXTS.settings.title,
    primary: (page) => page.getByRole("button", { name: APP_TEXTS.killSwitch.pause }),
  },
];

/** Entirely inside the first screen: no scroll needed to see it. */
async function expectAboveTheFold(locator: Locator, label: string): Promise<void> {
  await expect(locator, label).toBeVisible({ timeout: COLD_START });
  const box = await locator.boundingBox();
  expect(box, label).not.toBeNull();
  expect(box!.y, `${label}: top`).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height, `${label}: bottom`).toBeLessThanOrEqual(VIEWPORT.height);
  expect(box!.x + box!.width, `${label}: right`).toBeLessThanOrEqual(VIEWPORT.width);
}

async function expectDisplayTitle(page: Page, title: string | RegExp, label: string): Promise<void> {
  const h1 = page.getByRole("heading", { level: 1, name: title });
  await expectAboveTheFold(h1, `${label}: h1`);
  const style = await h1.evaluate((node) => {
    const computed = getComputedStyle(node);
    return { family: computed.fontFamily, weight: Number(computed.fontWeight) };
  });
  // Role « title »: the Geist family of next/font (its generated name contains « Geist »), 800.
  expect(style.family, `${label}: title face`).toMatch(/Geist/);
  expect(style.family, `${label}: not the mono face`).not.toMatch(/Mono/);
  expect(style.weight, `${label}: title weight`).toBeGreaterThanOrEqual(800);
}

test("chaque écran connecté : titre et action principale visibles sans défiler (1440 × 900)", async ({ page }) => {
  await page.setViewportSize(VIEWPORT);
  await signIn(page, "agentA");

  const record = await page.getByTestId("contacts-table").getByRole("link").first().getAttribute("href");
  expect(record).toMatch(/^\/contacts\/.+/);

  for (const screen of SCREENS) {
    await page.goto(screen.path);
    await expectDisplayTitle(page, screen.title, screen.path);
    await expectAboveTheFold(screen.primary(page), `${screen.path}: primary action`);
  }

  // The seller's file: their name is the title, launching Hugo the first action.
  await page.goto(record!);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: COLD_START });
  await expectDisplayTitle(page, /.+/, "fiche contact");
  await expectAboveTheFold(page.getByRole("button", { name: APP_TEXTS.agents.runHugo }), "fiche contact: Lancer Hugo");
});

test("les chiffres clés utilisent la police mono à chiffres tabulaires, le corps reste en Inter", async ({ page }) => {
  await page.setViewportSize(VIEWPORT);
  await signIn(page, "agentA");
  await page.goto("/taches");
  await expect(page.getByRole("heading", { level: 1, name: APP_TEXTS.tasks.title })).toBeVisible({
    timeout: COLD_START,
  });

  const figure = page.getByTestId("tasks-total-value");
  const figureStyle = await figure.evaluate((node) => {
    const computed = getComputedStyle(node);
    return { family: computed.fontFamily, numeric: computed.fontVariantNumeric };
  });
  expect(figureStyle.family).toMatch(/Geist Mono/);
  expect(figureStyle.numeric).toContain("tabular-nums");

  const body = await page.locator("body").evaluate((node) => getComputedStyle(node).fontFamily);
  expect(body).toMatch(/Inter/);
});

test("fiche introuvable : ce qui s’est passé et une action de sortie, visibles sans défiler", async ({ page }) => {
  await page.setViewportSize(VIEWPORT);
  await signIn(page, "agentA");
  // A syntactically valid id that belongs to no contact: the not-found state of the
  // signed-in space (streamed after the skeleton, so the HTTP status stays 200 in dev).
  await page.goto("/contacts/00000000-0000-4000-8000-000000000000");
  const main = page.locator("main#content");
  await expectAboveTheFold(main.getByText(APP_TEXTS.contact.notFoundTitle), "404: what happened");
  await expectAboveTheFold(main.getByRole("link", { name: APP_TEXTS.contact.backToList }), "404: a way out");
});
