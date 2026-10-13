import { expect, test, type Page } from "@playwright/test";

import { APP_TEXTS } from "@/components/texts";

import { adminClient } from "./helpers/local-supabase";
import { fixtureUser, signIn } from "./helpers/sign-in";

/**
 * « Passage d'une étape à l'autre » — the funnel at the TOP of `/pipeline`
 * (docs/design-system.md §3.5.2.J; the dashboard curve of the 11/10 lot was replaced by the
 * statistics page, covered by `pilotage.spec.ts`).
 *
 * Protected, against the real local database and WITHOUT waiting for an animation to end
 * (the suite runs in reduced motion):
 *   * placement: the funnel comes BEFORE the stage map, within the first 300 px of the page;
 *   * six slices in order, never increasing, five rates = Math.round, « Perdus » apart, the
 *     first slice = the dossiers really in the database;
 *   * the ramp: no slice paler than 48 % ink (computed fill alpha ≥ 0.47);
 *   * reduced motion: tooltip and keyboard work, the browser is idle afterwards;
 *   * 1440 / 1024 / 390: no horizontal scroll, labels never cut, vertical funnel ≤ 260 px on a phone;
 *   * isolation: agency B sees its own figures 16 → 10 → 5 → 2 → 1 → 1;
 *   * without a session, the funnel is not rendered.
 * No consent checkbox exists in these journeys.
 */
const FUNNEL = APP_TEXTS.pipeline.funnel;
const COLD_START = 60_000;
const WIDTHS = [
  { name: "1440", width: 1440, height: 900 },
  { name: "1024", width: 1024, height: 800 },
] as const;

test.beforeEach(() => {
  test.setTimeout(150_000);
});

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
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
}

for (const { name, width, height } of WIDTHS) {
  test.describe(`${name} px`, () => {
    test.use({ viewport: { width, height } });

    test("pipeline : l'entonnoir est en tête, six tranches dans l'ordre, cinq pourcentages arrondis, « Perdus » à part", async ({
      page,
    }) => {
      await signIn(page, "agentA");
      const card = await openPipeline(page);

      // Placement: first thing under the header, before the stage map and the board.
      const funnelY = (await card.boundingBox())!.y;
      const mapY = (await page.getByRole("navigation", { name: APP_TEXTS.pipeline.stageNavLabel }).boundingBox())!.y;
      expect(funnelY).toBeLessThan(mapY);
      expect(funnelY + (await page.evaluate(() => window.scrollY))).toBeLessThanOrEqual(330);

      await expect(page.getByTestId("funnel-label")).toHaveText([
        "Nouveau",
        "Qualifié",
        "Chaud",
        "RDV planifié",
        "Estimation faite",
        "Mandat signé",
      ]);
      const values = await funnelValues(page);
      expect(values).toHaveLength(6);
      for (let i = 1; i < values.length; i++) expect(values[i]!).toBeLessThanOrEqual(values[i - 1]!);

      const rates = await page.getByTestId("funnel-rate").allTextContents();
      expect(rates).toHaveLength(5);
      rates.forEach((rate, i) => {
        const expected = Math.round((values[i + 1]! / values[i]!) * 100);
        expect(rate.replace(/[^\d]/g, "")).toBe(String(expected));
        expect(rate).toContain("%");
      });

      // « Perdus » is outside the funnel.
      await expect(card.getByTestId("funnel-lost")).toContainText(/Perdus : \d+/);
      expect(await page.getByTestId("funnel-chart").getByText(/Perdus/).count()).toBe(0);
      await expect(card.getByText(FUNNEL.finding)).toBeVisible();
      await expect(page.getByTestId("funnel-signed-note")).toHaveText(FUNNEL.signedNote);

      // First slice = every dossier of the agency in the database.
      const user = await fixtureUser("agentA");
      const { count } = await adminClient().from("contacts").select("id", { count: "exact", head: true }).eq("agency_id", user.agencyId);
      expect(values[0]).toBe(count);

      await expect(page.getByTestId("funnel-plot").locator("svg").first()).toBeVisible();
      await noHorizontalScroll(page);
    });

    test("la rampe de gris : aucune tranche plus pâle que 48 % d'encre", async ({ page }) => {
      await signIn(page, "agentA");
      await openPipeline(page);
      await expect(page.getByTestId("funnel-plot").locator("svg").first()).toBeVisible();
      const alphas = await page.getByTestId("funnel-plot").evaluate((plot) => {
        const probe = document.createElement("span");
        probe.style.color = "var(--chart-1)";
        plot.appendChild(probe);
        const read = (variable: string) => {
          probe.style.color = `var(${variable})`;
          const match = /(?:color\(srgb [\d. ]+\/ ([\d.]+)\)|rgba\([^)]*,\s*([\d.]+)\))/.exec(getComputedStyle(probe).color);
          return match ? Number(match[1] ?? match[2]) : 1;
        };
        const values = [1, 2, 3, 4, 5, 6].map((i) => read(`--chart-${i}`));
        probe.remove();
        return values;
      });
      expect(Math.min(...alphas)).toBeGreaterThanOrEqual(0.47);
    });
  });
}

test.describe("mobile 390 px", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("entonnoir vertical de 260 px au plus, libellés jamais coupés, tableau lisible, aucun défilement horizontal", async ({ page }) => {
    await signIn(page, "agentA");
    const card = await openPipeline(page);

    const ys = await page.getByTestId("funnel-label").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().top));
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
    expect(new Set(ys).size).toBe(6);
    const cut = await page.getByTestId("funnel-label").evaluateAll((els) => els.map((el) => el.scrollWidth > el.clientWidth));
    expect(cut).toEqual([false, false, false, false, false, false]);
    const plot = await page.getByTestId("funnel-plot").boundingBox();
    expect(plot!.height).toBeLessThanOrEqual(260);

    await card.getByText(FUNNEL.tableSummary).click();
    await expect(card.getByTestId("funnel-values").locator("tbody tr")).toHaveCount(6);
    await noHorizontalScroll(page);
  });
});

test.describe("mouvement réduit", () => {
  test.use({ reducedMotion: "reduce" });

  test("clavier : l'entonnoir se parcourt aux flèches et annonce l'étape", async ({ page }) => {
    await signIn(page, "agentA");
    const card = await openPipeline(page);
    await card.getByTestId("funnel-chart").focus();
    await page.keyboard.press("ArrowRight");
    await expect(card.getByTestId("funnel-live")).toHaveText(/^Nouveau : \d+ dossiers, \d+\s%/);
    await expect(card.getByTestId("funnel-tooltip")).toContainText("Nouveau");
    await page.keyboard.press("End");
    await expect(card.getByTestId("funnel-live")).toContainText("Mandat signé");
    await page.keyboard.press("Escape");
    await expect(card.getByTestId("funnel-tooltip")).toHaveCount(0);
  });

  test("moteur au repos : aucune image d'animation demandée une fois la page posée", async ({ page }) => {
    await signIn(page, "agentA");
    await openPipeline(page);
    await expect(page.getByTestId("funnel-plot").locator("svg").first()).toBeVisible();
    await page.waitForTimeout(800);
    const frames = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let count = 0;
          const tick = () => {
            count += 1;
          };
          const original = window.requestAnimationFrame;
          window.requestAnimationFrame = (callback) => {
            tick();
            return original.call(window, callback);
          };
          setTimeout(() => {
            window.requestAnimationFrame = original;
            resolve(count);
          }, 400);
        }),
    );
    expect(frames).toBeLessThanOrEqual(2);
  });
});

test("isolation : l'agence B voit ses propres chiffres (son nombre de dossiers en base), jamais ceux de A", async ({ page }) => {
  await signIn(page, "userB");
  await openPipeline(page);
  const values = await funnelValues(page);
  expect(values).toHaveLength(6);
  const user = await fixtureUser("userB");
  const { count } = await adminClient().from("contacts").select("id", { count: "exact", head: true }).eq("agency_id", user.agencyId);
  expect(values[0]).toBe(count);
  const other = await fixtureUser("agentA");
  const { count: countA } = await adminClient().from("contacts").select("id", { count: "exact", head: true }).eq("agency_id", other.agencyId);
  expect(values[0]).not.toBe(countA);
  const rates = (await page.getByTestId("funnel-rate").allTextContents()).map((text) => Number(text.replace(/[^\d]/g, "")));
  rates.forEach((rate, i) => expect(rate).toBe(Math.round((values[i + 1]! / values[i]!) * 100)));
  for (const name of ["Frederic Masson", "Elodie Mercier"]) await expect(page.locator("body")).not.toContainText(name);
});

test("cas d'erreur : sans session, l'entonnoir n'est pas affiché", async ({ page }) => {
  await page.goto("/pipeline");
  await expect(page).toHaveURL(/\/connexion$/, { timeout: COLD_START });
  await expect(page.getByTestId("pipeline-funnel")).toHaveCount(0);
});
