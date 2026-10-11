import { expect, test, type Page } from "@playwright/test";

import { APP_TEXTS } from "@/components/texts";

import { adminClient } from "./helpers/local-supabase";
import { signIn } from "./helpers/sign-in";

/**
 * Analytics cards (docs/design-system.md §3.5.1): « Activité sur 30 jours » on
 * `/dashboard` and « Passage d'une étape à l'autre » on `/pipeline`.
 *
 * Protected here, against the real local database and WITHOUT waiting for an
 * animation to end (the suite runs in reduced motion; the one test that plays
 * the real entrance only waits for the hand-over flag):
 *   * placement, 30 days, exact totals, no decimal and no « k »;
 *   * six slices in order, never increasing, five rates = Math.round, « Perdus »
 *     apart, total = the dossiers really in the database;
 *   * reduced motion: charts visible at once, tooltip and keyboard work, the
 *     browser is idle (no animation frame) afterwards;
 *   * 1440 / 1024 / 390: no horizontal scroll, labels never cut, vertical funnel on a phone;
 *   * isolation: agency B sees its own figures 11 → 7 → 3 → 1 → 0 → 0;
 *   * without a session, neither card is rendered.
 * No consent checkbox exists in these journeys.
 */
const ACTIVITY = APP_TEXTS.dashboard.activity;
const FUNNEL = APP_TEXTS.pipeline.funnel;
const COLD_START = 60_000;
const WIDTHS = [
  { name: "1440", width: 1440, height: 900 },
  { name: "1024", width: 1024, height: 800 },
  { name: "390", width: 390, height: 844 },
] as const;
const SHOTS = "test-results/analytics-charts";

test.beforeEach(() => {
  test.setTimeout(150_000);
});

/** Whole numbers only: never a decimal, never « 12,4k ». */
function expectPlainCount(text: string) {
  expect(text).toMatch(/^[\d\s  ]+/);
  expect(text).not.toMatch(/\d[.,]\d|\d\s?[kKmM]\b/);
}

async function openDashboard(page: Page) {
  await page.goto("/dashboard");
  const card = page.getByTestId("dashboard-activity");
  await expect(card.getByRole("heading", { level: 2, name: ACTIVITY.title })).toBeVisible({ timeout: COLD_START });
  return card;
}

async function openPipeline(page: Page) {
  await page.goto("/pipeline");
  const card = page.getByTestId("pipeline-funnel");
  await expect(card.getByRole("heading", { level: 2, name: FUNNEL.title })).toBeVisible({ timeout: COLD_START });
  return card;
}

async function funnelValues(page: Page): Promise<number[]> {
  const texts = await page.getByTestId("funnel-value").allTextContents();
  return texts.map((text) => Number(text.trim()));
}

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

for (const { name, width, height } of WIDTHS) {
  test.describe(`${name} px`, () => {
    test.use({ viewport: { width, height } });

    test("tableau de bord : la courbe vient après « À faire maintenant », 30 jours, totaux exacts", async ({ page }) => {
      await signIn(page, "agentA");
      const card = await openDashboard(page);

      // Placement: after the todo panel, before the agents.
      const todoY = (await page.getByTestId("dashboard-todo").boundingBox())!.y;
      const cardY = (await card.boundingBox())!.y;
      const agentsY = (await page.getByRole("heading", { level: 2, name: APP_TEXTS.dashboard.agentsTitle }).boundingBox())!.y;
      expect(cardY).toBeGreaterThan(todoY);
      expect(cardY).toBeLessThan(agentsY);

      // Scope, legend with two entries, simulation badge.
      await expect(card.getByText(ACTIVITY.scope)).toBeVisible();
      await expect(card.getByTestId("activity-legend").getByRole("listitem")).toHaveCount(2);
      await expect(card.getByText(APP_TEXTS.states.simulation)).toBeVisible();

      // 30 days in the table of values, totals = their exact sum.
      await card.getByText(ACTIVITY.tableSummary).click();
      const rows = card.getByTestId("activity-values").locator("tbody tr");
      await expect(rows).toHaveCount(30);
      const received = (await rows.locator("td:nth-child(2)").allTextContents()).map(Number);
      const qualified = (await rows.locator("td:nth-child(3)").allTextContents()).map(Number);
      const totals = card.getByTestId("activity-total");
      const shownReceived = (await totals.nth(0).innerText()).split(/\s+/)[0]!;
      const shownQualified = (await totals.nth(1).innerText()).split(/\s+/)[0]!;
      expectPlainCount(shownReceived);
      expectPlainCount(shownQualified);
      expect(Number(shownReceived)).toBe(received.reduce((a, b) => a + b, 0));
      expect(Number(shownQualified)).toBe(qualified.reduce((a, b) => a + b, 0));
      expect(received.every((n) => Number.isInteger(n) && n >= 0)).toBe(true);
      await expect(card.getByTestId("activity-total").first()).toContainText(ACTIVITY.totalScope);

      // The chart is there at once (reduced motion).
      await expect(card.getByTestId("activity-chart").locator("svg").first()).toBeVisible();
      await noHorizontalScroll(page);
      await card.scrollIntoViewIfNeeded();
      await card.screenshot({ path: `${SHOTS}/dashboard-${name}-reduced.png` });
    });

    test("pipeline : six tranches dans l'ordre, cinq pourcentages arrondis, « Perdus » à part", async ({ page }) => {
      await signIn(page, "agentA");
      const card = await openPipeline(page);

      // Placement: under the lost lane.
      const lostLaneY = (await page.getByTestId("pipeline-column-perdu").boundingBox())!.y;
      expect((await card.boundingBox())!.y).toBeGreaterThan(lostLaneY);

      await expect(page.getByTestId("funnel-label")).toHaveText(
        ["Nouveau", "Qualifié", "Chaud", "RDV planifié", "Estimation faite", "Mandat signé"],
      );
      const values = await funnelValues(page);
      expect(values).toHaveLength(6);
      for (let i = 1; i < values.length; i++) expect(values[i]!).toBeLessThanOrEqual(values[i - 1]!);

      // Five rates, each the rounded share of the two counts shown.
      const rates = await page.getByTestId("funnel-rate").allTextContents();
      expect(rates).toHaveLength(5);
      rates.forEach((rate, i) => {
        const expected = Math.round((values[i + 1]! / values[i]!) * 100);
        expect(rate.replace(/[^\d]/g, "")).toBe(String(expected));
        expect(rate).toContain("%");
      });

      // « Perdus » is outside the funnel.
      const lost = card.getByTestId("funnel-lost");
      await expect(lost).toContainText(/Perdus : \d+/);
      expect(await page.getByTestId("funnel-chart").getByText(/Perdus/).count()).toBe(0);
      await expect(card.getByText(FUNNEL.finding)).toBeVisible();
      await expect(page.getByTestId("funnel-signed-note")).toHaveText(FUNNEL.signedNote);

      // First slice = every dossier of the agency in the database.
      const agent = await signInAgencyId(page);
      const { count } = await adminClient().from("contacts").select("id", { count: "exact", head: true }).eq("agency_id", agent);
      expect(values[0]).toBe(count);

      await expect(page.getByTestId("funnel-plot").locator("svg").first()).toBeVisible();
      await noHorizontalScroll(page);
      await card.scrollIntoViewIfNeeded();
      await card.screenshot({ path: `${SHOTS}/pipeline-${name}-reduced.png` });
    });
  });
}

async function signInAgencyId(page: Page): Promise<string> {
  void page;
  const { fixtureUser } = await import("./helpers/sign-in");
  return (await fixtureUser("agentA")).agencyId;
}

test.describe("mobile 390 px", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("entonnoir vertical, libellés jamais coupés, tableaux lisibles, aucun défilement horizontal", async ({ page }) => {
    await signIn(page, "agentA");
    const card = await openPipeline(page);

    // Vertical: labels stacked (increasing y), figures on the right.
    const ys = await page.getByTestId("funnel-label").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().top));
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
    expect(new Set(ys).size).toBe(6);

    // « Estimation faite » on its own, never truncated; every slice row is at least 44 px tall.
    const cut = await page.getByTestId("funnel-label").evaluateAll((els) => els.map((el) => el.scrollWidth > el.clientWidth));
    expect(cut).toEqual([false, false, false, false, false, false]);
    const plot = await page.getByTestId("funnel-plot").boundingBox();
    expect(plot!.height / 6).toBeGreaterThanOrEqual(44);

    await card.getByText(FUNNEL.tableSummary).click();
    await expect(card.getByTestId("funnel-values").locator("tbody tr")).toHaveCount(6);
    await noHorizontalScroll(page);
    await card.screenshot({ path: `${SHOTS}/pipeline-390-vertical.png` });
  });
});

test.describe("mouvement réduit", () => {
  test.use({ reducedMotion: "reduce" });

  test("l'infobulle de la courbe répond au survol sans attente et nomme les deux séries", async ({ page }) => {
    await signIn(page, "agentA");
    const card = await openDashboard(page);
    const chart = card.getByTestId("activity-chart");
    await chart.scrollIntoViewIfNeeded();
    const box = (await chart.locator("svg").first().boundingBox())!;
    // Keep moving over the plot: the tooltip must follow the pointer without any wait.
    await expect(async () => {
      await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
      await page.mouse.move(box.x + box.width * 0.52, box.y + box.height * 0.55);
      await expect(chart.getByText(ACTIVITY.receivedSeries)).toBeVisible({ timeout: 300 });
    }).toPass({ timeout: 3_000 });
    await expect(chart.getByText(ACTIVITY.qualifiedSeries)).toBeVisible();
  });

  test("clavier : flèches parcourent les jours, la zone vive annonce « jour : n demandes, n dossiers »", async ({ page }) => {
    await signIn(page, "agentA");
    const card = await openDashboard(page);
    const chart = card.getByTestId("activity-chart");
    await chart.focus();
    await expect(chart).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(card.getByTestId("activity-live")).toHaveText(/^\d{1,2} \p{L}+ : \d+ demandes? reçues?, \d+ dossiers? qualifiés?$/u);
    const first = await card.getByTestId("activity-live").innerText();
    await page.keyboard.press("ArrowRight");
    await expect(card.getByTestId("activity-live")).not.toHaveText(first);
    await page.keyboard.press("Escape");
    await expect(card.getByTestId("activity-live")).toHaveText("");

    // The table of values opens with Enter.
    await card.getByTestId("activity-values").locator("summary").focus();
    await page.keyboard.press("Enter");
    await expect(card.getByTestId("activity-values").locator("tbody tr").first()).toBeVisible();
  });

  test("clavier : l'entonnoir se parcourt aux flèches et annonce l'étape", async ({ page }) => {
    await signIn(page, "agentA");
    const card = await openPipeline(page);
    const chart = card.getByTestId("funnel-chart");
    await chart.focus();
    await page.keyboard.press("ArrowRight");
    await expect(card.getByTestId("funnel-live")).toHaveText(/^Nouveau : \d+ dossiers, \d+\s%/);
    await expect(card.getByTestId("funnel-tooltip")).toContainText("Nouveau");
    await expect(card.getByTestId("funnel-tooltip")).toContainText(/\d+ sur \d+ dossiers/);
    await page.keyboard.press("End");
    await expect(card.getByTestId("funnel-live")).toContainText("Mandat signé");
    await page.keyboard.press("Escape");
    await expect(card.getByTestId("funnel-tooltip")).toHaveCount(0);
  });

  test("moteur au repos : aucune image d'animation demandée une fois la page posée", async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __raf: number };
      w.__raf = 0;
      const original = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (callback) => {
        w.__raf += 1;
        return original(callback);
      };
    });
    await signIn(page, "agentA");
    const card = await openDashboard(page);
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1_500);
    await page.evaluate(() => {
      (window as unknown as { __raf: number }).__raf = 0;
    });
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => (window as unknown as { __raf: number }).__raf)).toBe(0);
  });
});

test.describe("mouvement normal", () => {
  test.use({ reducedMotion: "no-preference", viewport: { width: 1440, height: 900 } });

  test("l'entrée de la carte est courte, le graphique prend le relais, la hauteur ne bouge pas", async ({ page }) => {
    await signIn(page, "agentA");
    const card = await openDashboard(page);
    const stage = page.locator("[data-chart-ready]").first();
    const plot = card.getByTestId("activity-chart").locator("> div").first();
    const heightBefore = (await plot.boundingBox())!.height;

    await card.scrollIntoViewIfNeeded();
    const started = Date.now();
    await expect(stage).toHaveAttribute("data-chart-ready", "true", { timeout: 1_500 });
    expect(Date.now() - started).toBeLessThanOrEqual(1_500);

    // Zero layout shift for the chart slot; the card is back to plain CSS after the sequence.
    await expect(card.getByTestId("activity-chart").locator("svg").first()).toBeVisible();
    expect(Math.abs((await plot.boundingBox())!.height - heightBefore)).toBeLessThanOrEqual(1);
    await expect(stage).toHaveCSS("opacity", "1", { timeout: 2_000 });
    await card.screenshot({ path: `${SHOTS}/dashboard-1440-motion.png` });

    // A resize never replays the entrance.
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.waitForTimeout(300);
    await expect(stage).toHaveAttribute("data-chart-ready", "true");
    await expect(stage).toHaveCSS("opacity", "1");
  });

  test("pipeline : l'entonnoir apparaît une fois, chiffres exacts dès le HTML (aucun compteur)", async ({ page }) => {
    await signIn(page, "agentA");
    await page.goto("/pipeline");
    // The first figure is already its final value the instant the card exists.
    const first = page.getByTestId("funnel-value").first();
    await expect(first).toHaveText(/^\d+$/, { timeout: COLD_START });
    const value = await first.textContent();
    await page.getByTestId("pipeline-funnel").scrollIntoViewIfNeeded();
    for (let i = 0; i < 5; i++) {
      expect(await first.textContent()).toBe(value);
      await page.waitForTimeout(100);
    }
    await expect(page.getByTestId("funnel-plot").locator("svg").first()).toBeVisible({ timeout: 2_000 });
    await page.getByTestId("pipeline-funnel").screenshot({ path: `${SHOTS}/pipeline-1440-motion.png` });
  });
});

test("isolation : l'agence B voit ses propres chiffres, 11, 7, 3, 1, 0, 0", async ({ page }) => {
  await signIn(page, "userB");
  await openPipeline(page);
  expect(await funnelValues(page)).toEqual([11, 7, 3, 1, 0, 0]);
  // Rates computed from its own counts; a stage with nothing before it reads a dash.
  const rates = (await page.getByTestId("funnel-rate").allTextContents()).map((text) => text.replace(/\s/g, ""));
  expect(rates).toEqual(["→64%", "→43%", "→33%", "→0%", "→—"].map((rate) => rate.replace(/\s/g, "")));
  await expect(page.getByTestId("funnel-not-computable")).toHaveText(FUNNEL.notComputable);
  for (const name of ["Frederic Masson", "Elodie Mercier"]) await expect(page.locator("body")).not.toContainText(name);

  const card = await openDashboard(page);
  await expect(card.getByTestId("activity-total").first()).toBeVisible();
});

test("cas d'erreur : sans session, ni la courbe ni l'entonnoir ne sont affichés", async ({ page }) => {
  for (const route of ["/dashboard", "/pipeline"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/connexion$/, { timeout: COLD_START });
    await expect(page.getByTestId("dashboard-activity")).toHaveCount(0);
    await expect(page.getByTestId("pipeline-funnel")).toHaveCount(0);
  }
});
