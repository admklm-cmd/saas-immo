import { expect, test, type Page } from "@playwright/test";

import { APP_TEXTS } from "@/components/texts";

import { adminClient } from "./helpers/local-supabase";
import { fixtureUser, signIn } from "./helpers/sign-in";

/**
 * `/dashboard` as the boss's statistics page (docs/design-system.md §3.5.2): the Scène, the
 * period bar, the figures, the origins ring, the flow, the Atelier.
 *
 * Protected, against the real local database and WITHOUT any exact volume (the fictitious
 * history is reloaded and extended by other work): figures are compared with each other
 * (running total = giant figure, origins = flow = rate denominator) and with a count read
 * in the database. The suite runs in reduced motion; the tests that play the real motion opt
 * back in and wait for flags (`data-playing`), never for a fixed delay.
 * No consent checkbox exists on this screen: it is asserted.
 */
const TEXTS = APP_TEXTS.dashboard.pilotage;
const COLD_START = 60_000;
const WIDTHS = [
  { name: "1440", width: 1440, height: 900 },
  { name: "1024", width: 1024, height: 800 },
  { name: "390", width: 390, height: 844 },
] as const;
const SHOTS = "test-results/pilotage";

test.beforeEach(() => {
  test.setTimeout(150_000);
});

async function openPilotage(page: Page, query = ""): Promise<void> {
  await page.goto(`/dashboard${query}`);
  await expect(page.getByTestId("pilotage-stage")).toBeVisible({ timeout: COLD_START });
  await expect(page.getByTestId("stage-chart")).toBeVisible({ timeout: COLD_START });
}

/** The written count of the giant figure (the screen-reader copy holds the final value). */
async function giant(page: Page): Promise<number> {
  const text = await page.getByTestId("stage-giant").locator(".sr-only").innerText();
  return Number.parseInt(text.replace(/\s/g, ""), 10);
}

async function tableRows(page: Page, testId: string): Promise<string[][]> {
  const details = page.getByTestId(testId);
  await details.locator("summary").click();
  return details.locator("tbody tr").evaluateAll((rows) =>
    rows.map((row) => Array.from(row.querySelectorAll("th, td")).map((cell) => (cell.textContent ?? "").trim())),
  );
}

/** Midnight of a Paris calendar day `daysAgo` days back, as an ISO instant. */
function parisMidnight(daysAgo: number): string {
  const paris = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" });
  const hour = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", hourCycle: "h23" });
  const target = new Date(Date.now() - daysAgo * 86_400_000);
  const day = paris.format(target);
  const utc = Date.parse(`${day}T00:00:00Z`);
  for (const shiftHours of [0, 1, 2, -1]) {
    const candidate = new Date(utc - shiftHours * 3_600_000);
    if (paris.format(candidate) === day && hour.format(candidate) === "00") return candidate.toISOString();
  }
  throw new Error("no Paris midnight found");
}

test("la Scène est entièrement visible sans défiler à 1440 × 900, le chiffre est géant et le graphique est là", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, "agentA");
  await openPilotage(page);

  const box = await page.getByTestId("pilotage-stage").boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y + box!.height).toBeLessThanOrEqual(900);
  const fontSize = await page.getByTestId("stage-giant").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(fontSize).toBeGreaterThanOrEqual(150);
  await expect(page.getByTestId("stage-chart")).toBeInViewport();
  await expect(page.getByTestId("stage-end-ring")).toBeVisible();
  // Confirmed by a human, and written as such.
  await expect(page.getByTestId("pilotage-stage")).toContainText(TEXTS.stage.human);
  await expect(page.getByRole("checkbox")).toHaveCount(0);
});

test("période : « 1 an » par défaut, l'URL suit, sans rechargement, et le retour arrière la restaure", async ({ page }) => {
  await signIn(page, "agentA");
  await openPilotage(page);
  await expect(page.getByTestId("pilotage")).toHaveAttribute("data-period", "365d");
  await expect(page.getByTestId("period-365d")).toHaveAttribute("aria-checked", "true");
  await page.evaluate(() => {
    (window as unknown as { __noReload: boolean }).__noReload = true;
  });

  await page.getByTestId("period-30d").click();
  await expect(page).toHaveURL(/\?periode=30j$/);
  await expect(page.getByTestId("pilotage")).toHaveAttribute("data-period", "30d");
  await expect(page.getByTestId("pilotage-stage")).toContainText(TEXTS.periods["30d"].eyebrow.toUpperCase().slice(0, 4), {
    ignoreCase: true,
  });
  await expect(page.getByTestId("pilotage-announce")).toContainText(TEXTS.periods["30d"].announce);

  await page.getByTestId("period-7d").click();
  await expect(page.getByTestId("pilotage")).toHaveAttribute("data-period", "7d");
  await page.goBack();
  await expect(page.getByTestId("pilotage")).toHaveAttribute("data-period", "30d");
  await expect(page.getByTestId("period-30d")).toHaveAttribute("aria-checked", "true");
  expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);

  // Cas d'erreur : une valeur inconnue retombe sur « 1 an ».
  await page.goto("/dashboard?periode=n-importe-quoi");
  await expect(page.getByTestId("pilotage")).toHaveAttribute("data-period", "365d");
  await page.goto("/dashboard?periode=3m");
  await expect(page.getByTestId("pilotage")).toHaveAttribute("data-period", "90d");
});

for (const period of ["7j", "30j", "3m", "1a"] as const) {
  test(`cohérence des chiffres (${period}) : cumul = chiffre géant, origines = flux = dénominateur du taux`, async ({ page }) => {
    await signIn(page, "agentA");
    await openPilotage(page, `?periode=${period}`);

    const total = await giant(page);
    const rows = await tableRows(page, "stage-table");
    expect(rows.length).toBeGreaterThan(0);
    // Running total never decreases, and ends on the figure.
    const cumulative = rows.map((row) => Number.parseInt(row[2] ?? "", 10));
    expect(cumulative.at(-1)).toBe(total);
    expect(cumulative.every((value, index) => index === 0 || value >= cumulative[index - 1]!)).toBe(true);
    // Per-bucket counts add up to the running total.
    expect(rows.reduce((sum, row) => sum + Number.parseInt(row[1] ?? "0", 10), 0)).toBe(total);

    // Origins: the legend adds up to the centre of the ring, which is the number of requests.
    const origin = await tableRows(page, "origin-table");
    const originTotal = origin.reduce((sum, row) => sum + Number.parseInt(row[1] ?? "0", 10), 0);
    if (originTotal > 0) {
      const flow = await tableRows(page, "flow-table");
      const received = flow.find((row) => row[0] === TEXTS.flow.received);
      expect(Number.parseInt(received?.[1] ?? "", 10)).toBe(originTotal);
      const basis = await page.getByTestId("figure-conversion").innerText();
      expect(basis).toContain(`pour ${originTotal} demande`);
    }
    // The previous period is compared in words, never with an arrow or a percentage of change.
    const comparison = (await page.getByTestId("stage-comparison").innerText()).trim();
    expect(comparison).toMatch(/^(\+\d+|−\d+|Identique|Période précédente : indisponible)/);
    await expect(page.locator("main")).not.toContainText(/avant Ascend/i);
  });
}

test("les demandes de la période sont celles de la base (agence A, 30 jours)", async ({ page }) => {
  const user = await fixtureUser("agentA");
  const { count, error } = await adminClient()
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("agency_id", user.agencyId)
    .gte("created_at", parisMidnight(29));
  expect(error).toBeNull();

  await signIn(page, "agentA");
  await openPilotage(page, "?periode=30j");
  const origin = await tableRows(page, "origin-table");
  const shown = origin.reduce((sum, row) => sum + Number.parseInt(row[1] ?? "0", 10), 0);
  // Two reads a few seconds apart: a request created in between may add one.
  expect(Math.abs(shown - (count ?? 0))).toBeLessThanOrEqual(1);
});

test("mouvement réduit : rien ne joue, tout est dans son état final, pas de bouton « Rejouer »", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signIn(page, "agentA");
  await openPilotage(page);
  const atelier = page.getByTestId("pilotage-atelier");
  await atelier.scrollIntoViewIfNeeded();
  await expect(atelier).toHaveAttribute("data-playing", "false");
  await expect(page.getByTestId("atelier-replay")).toHaveCount(0);
  // The giant figure is its final value at once, and a change of period is immediate.
  const before = await giant(page);
  await page.getByTestId("period-7d").click();
  await expect(page.getByTestId("pilotage")).toHaveAttribute("data-period", "7d");
  expect(await page.getByTestId("stage-giant").locator("[aria-hidden]").innerText()).toBe(
    (await page.getByTestId("stage-giant").locator(".sr-only").innerText()).trim(),
  );
  expect(before).toBeGreaterThanOrEqual(0);
  // Nothing is left half-hidden by an animation.
  for (const id of ["pilotage-stage", "pilotage-sheet", "origin-stage", "flow-stage"]) {
    const target = page.getByTestId(id);
    await target.scrollIntoViewIfNeeded();
    expect(await target.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  }
});

test.describe("mouvement réel", () => {
  test.use({ reducedMotion: "no-preference" });

  test("la scène des agents joue une fois, se pose, et se rejoue à la demande", async ({ page }) => {
    await signIn(page, "agentA");
    await page.goto("/dashboard");
    const atelier = page.getByTestId("pilotage-atelier");
    await atelier.scrollIntoViewIfNeeded();
    await expect(atelier).toHaveAttribute("data-playing", "true", { timeout: COLD_START });
    // Never more than two cobalt points at once.
    const bits = await page.locator("[data-bit]").evaluateAll((els) => els.filter((el) => getComputedStyle(el).opacity !== "0").length);
    expect(bits).toBeLessThanOrEqual(2);
    await expect(atelier).toHaveAttribute("data-playing", "false", { timeout: 20_000 });
    await expect(page.getByTestId("atelier-replay")).toBeVisible();
    await page.getByTestId("atelier-replay").click();
    await expect(atelier).toHaveAttribute("data-playing", "true");
  });

  test("changement de période : un second clic pendant la transition aboutit à la dernière période", async ({ page }) => {
    await signIn(page, "agentA");
    await openPilotage(page);
    await page.getByTestId("period-7d").click();
    await page.getByTestId("period-90d").click();
    await expect(page.getByTestId("pilotage")).toHaveAttribute("data-period", "90d");
    await expect(page.getByTestId("period-90d")).toHaveAttribute("aria-checked", "true");
    // The graphics are back (not left at opacity 0 by the interrupted fade).
    await expect
      .poll(() => page.getByTestId("stage-chart").evaluate((el) => getComputedStyle(el.closest("[data-swap]") ?? el).opacity), { timeout: 5_000 })
      .toBe("1");
    await expect(page).toHaveURL(/\?periode=3m$/);
  });

  test("aucun décalage de mise en page au chargement", async ({ page }) => {
    await signIn(page, "agentA");
    await page.addInitScript(() => {
      (window as unknown as { __cls: number }).__cls = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as unknown as Array<{ value: number; hadRecentInput: boolean }>) {
          if (!entry.hadRecentInput) (window as unknown as { __cls: number }).__cls += entry.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    });
    await openPilotage(page);
    await page.waitForTimeout(1500);
    const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
    expect(cls).toBeLessThan(0.1);
  });
});

test("clavier : le sélecteur (flèches), le graphique de la Scène et l'anneau des origines", async ({ page }) => {
  await signIn(page, "agentA");
  await openPilotage(page);

  await page.getByTestId("period-365d").focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByTestId("pilotage")).toHaveAttribute("data-period", "90d");
  await page.keyboard.press("Home");
  await expect(page.getByTestId("period-7d")).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("End");
  await expect(page.getByTestId("period-365d")).toHaveAttribute("aria-checked", "true");

  await page.getByTestId("stage-chart").focus();
  await page.keyboard.press("End");
  await expect(page.getByTestId("stage-live")).not.toHaveText("");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("stage-live")).toHaveText("");

  const group = page.getByTestId("origin-group");
  await group.scrollIntoViewIfNeeded();
  await group.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("origin-live")).toContainText(/demandes?, \d+ %/);
});

for (const { name, width, height } of WIDTHS) {
  test(`${name} px : aucun défilement horizontal, cibles tactiles, chiffre géant entier, flux adapté`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await signIn(page, "agentA");
    await openPilotage(page);
    for (const id of ["origin-stage", "flow-stage", "pilotage-atelier"]) await page.getByTestId(id).scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    const giantBox = await page.getByTestId("stage-giant").boundingBox();
    const stageBox = await page.getByTestId("pilotage-stage").boundingBox();
    expect(giantBox!.x).toBeGreaterThanOrEqual(stageBox!.x);
    expect(giantBox!.x + giantBox!.width).toBeLessThanOrEqual(stageBox!.x + stageBox!.width);

    if (width < 640) {
      const segment = await page.getByTestId("period-30d").boundingBox();
      expect(segment!.height).toBeGreaterThanOrEqual(44);
      await expect(page.getByTestId("flow-ranks")).toBeVisible();
      await expect(page.getByTestId("flow-sankey")).toHaveCount(0);
      // The rail of the Atelier is vertical: stations stack.
      const stations = await page.locator("[data-testid^='atelier-station-']").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().top));
      expect(stations.every((top, index) => index === 0 || top > stations[index - 1]!)).toBe(true);
    } else {
      await expect(page.getByTestId("flow-sankey")).toBeVisible({ timeout: COLD_START });
    }
  });
}

test("captures : 1440 / 1024 / 390 pour « 1 an » et « 30 jours », mouvement réduit, états de l'Atelier", async ({ page }) => {
  test.setTimeout(300_000);
  await signIn(page, "agentA");
  for (const { name, width, height } of WIDTHS) {
    await page.setViewportSize({ width, height });
    for (const period of ["1a", "30j"] as const) {
      await openPilotage(page, `?periode=${period}`);
      for (let y = 0; y < 6000; y += 450) {
        await page.evaluate((top) => window.scrollTo(0, top), y);
        await page.waitForTimeout(150);
      }
      for (const id of ["origin-stage", "flow-stage", "pilotage-atelier"]) {
        await page.getByTestId(id).scrollIntoViewIfNeeded();
        await page.waitForTimeout(1600);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SHOTS}/dashboard-${name}-${period}.png`, fullPage: true });
    }
    await page.goto("/pipeline");
    await expect(page.getByTestId("pipeline-funnel")).toBeVisible({ timeout: COLD_START });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SHOTS}/pipeline-${name}-top.png` });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await openPilotage(page);
  await page.getByTestId("pilotage-atelier").scrollIntoViewIfNeeded();
  await page.getByTestId("pilotage-atelier").screenshot({ path: `${SHOTS}/atelier-1440-normal.png` });
});
