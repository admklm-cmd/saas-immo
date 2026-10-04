import { expect, test, type Page } from "@playwright/test";

import { HERO_TITLE, LANDING_TEXTS } from "@/components/landing-texts";

import { centerSection, instrumentPage, rafCalls } from "./helpers/landing-network";

/**
 * ROI section of the landing (docs/design-system.md §2.11.8.8 L4-B, criteria
 * L4-B1 to L4-B6; figures: docs/recherche-roi-agences.md). Four widgets, each
 * figure tagged « Source », « Hypothèse » or « Potentiel estimé »; sliders
 * whose values are never stored nor sent; an arrival played once (anime.js),
 * then nothing moves. Indicative orders of magnitude, never a promise.
 *
 * No form on this journey (sliders only, nothing is submitted): no consent
 * checkbox to check.
 */

const COLD_START = 60_000;
const ROI = LANDING_TEXTS.roi;
const SECTION = "[data-testid='roi']";
const ORDER = ["speed", "mandates", "time", "followup"];
/** Default values, visible text without spaces (fr-FR narrow spaces removed). */
const DEFAULTS = ["×21", "×7", "≈51000€HT", "480", "72", "≈5,8", "≈3,5", "≈270h", "900hd'administratifparan", "≈10800€detempsvaloriséparan", "93%"];

async function openHome(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: HERO_TITLE })).toBeVisible({ timeout: COLD_START });
}

/** Visible figures of the section, in DOM order, without any space. */
async function figures(page: Page): Promise<string[]> {
  return page.locator(`${SECTION} [data-roi-value] > [aria-hidden='true']`).evaluateAll((nodes) => nodes.map((node) => (node.textContent ?? "").replace(/\s/g, "")));
}

async function states(page: Page): Promise<string[]> {
  return page.locator(`${SECTION} [data-roi-state]`).evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-roi-state") ?? ""));
}

const widget = (page: Page, key: string) => page.locator(`${SECTION} [data-testid='roi-widget'][data-widget='${key}']`);

test.describe("section ROI : structure, chiffres, étiquettes (L4-B1 à L4-B3)", () => {
  test("1440 px : en-tête ROI sans effet, quatre widgets W1, W3, W2, W4, valeurs par défaut, étiquettes, mentions", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    const section = page.locator(SECTION);
    await expect(section).toHaveAttribute("data-living-scene", "resultat");
    await expect(section).toHaveAttribute("aria-labelledby", "result-title");
    await expect(section.getByText("Étapes du pipeline")).toHaveCount(0);
    await expect(section.getByTestId("overline")).toHaveText(ROI.kicker);
    const title = page.locator("#result-title");
    await expect(page.getByRole("heading", { level: 2, name: ROI.title })).toHaveCount(1);
    await expect(title).not.toHaveAttribute("data-accent-effect");
    await expect(title).not.toHaveAttribute("data-accent-replayable");
    await expect(title.locator("[data-accent]")).toHaveText(ROI.titleAccent);

    const widgets = section.getByTestId("roi-widget");
    await expect(widgets).toHaveCount(4);
    expect(await widgets.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-widget")))).toEqual(ORDER);
    for (const key of ORDER) {
      const texts = ROI.widgets[key as keyof typeof ROI.widgets];
      await expect(widget(page, key).getByRole("heading", { level: 3, name: texts.title })).toBeVisible();
      // L4-B3: each source note, word for word.
      await expect(widget(page, key).locator("[data-roi-note]")).toHaveText(texts.note);
    }
    await expect(section.getByTestId("roi-disclaimer")).toHaveText(ROI.disclaimer);

    // L4-B2: default values, final, at once (reduced motion).
    expect(await states(page)).toEqual(["done", "done", "done", "done"]);
    expect(await figures(page)).toEqual(DEFAULTS);
    // Screen readers: the final rounded value with its unit.
    await expect(widget(page, "time").locator("[data-roi-value] .sr-only").first()).toHaveText("environ 270 heures par an");
    await expect(widget(page, "mandates").locator("[data-roi-value] .sr-only").first()).toHaveText(/environ 51\s000 euros hors taxes par an/);

    // L4-B3: tags. W1, W4 and the « 23 % » landmark are American studies; the calculated results are estimates.
    const tags = (key: string) => widget(page, key).locator("[data-roi-tag]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-roi-tag")));
    expect((await tags("speed")).slice(0, 2)).toEqual(["source", "us"]);
    expect((await tags("followup")).slice(0, 2)).toEqual(["source", "us"]);
    expect((await tags("time"))[0]).toBe("estimate");
    expect((await tags("mandates"))[0]).toBe("estimate");
    expect(await tags("mandates")).toEqual(expect.arrayContaining(["hypothesis", "source", "us"]));
    await expect(widget(page, "mandates").getByText("audit américain : 23 % sans réponse").locator("..").locator("[data-roi-tag='us']")).toHaveCount(1);
    expect(await tags("time")).toEqual(expect.arrayContaining(["hypothesis", "source"]));
    // The hours slider is adjustable: Hypothesis; only its published landmark « étude : 4 à 6 h » is a Source.
    const hoursSlider = widget(page, "time").locator("[data-roi-slider]").filter({ hasText: ROI.widgets.time.sliders.hours.label });
    await expect(hoursSlider.locator("[data-roi-tag]").first()).toHaveAttribute("data-roi-tag", "hypothesis");
    await expect(hoursSlider.getByText("étude : 4 à 6 h").locator("..").locator("[data-roi-tag]")).toHaveAttribute("data-roi-tag", "source");
    // Legend: the three tags explained.
    await expect(section.locator("ul").first().locator("[data-roi-tag]")).toHaveCount(3);
    // Never a promise.
    expect(await section.textContent()).not.toMatch(/garanti|vous gagnerez/i);
  });

  for (const viewport of [
    { width: 1440, height: 900, columns: "12" },
    { width: 1280, height: 900, columns: "12" },
    { width: 1024, height: 768, columns: "2" },
    { width: 390, height: 844, columns: "1" },
    { width: 360, height: 800, columns: "1" },
  ]) {
    test(`${viewport.width} px : disposition (${viewport.columns === "12" ? "damier 5 + 7 / 7 + 5" : `${viewport.columns} colonne(s)`}), aucun débordement`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openHome(page);
      await page.locator(`${SECTION} [data-testid='roi-grid']`).scrollIntoViewIfNeeded();
      const boxes = await page.locator(`${SECTION} [data-testid='roi-widget']`).evaluateAll((nodes) =>
        nodes.map((node) => {
          const rect = node.getBoundingClientRect();
          return { left: Math.round(rect.left), top: Math.round(rect.top + window.scrollY), width: Math.round(rect.width), right: Math.round(rect.right) };
        }),
      );
      const [w1, w3, w2, w4] = boxes;
      if (viewport.columns === "12") {
        expect(w1!.top).toBe(w3!.top);
        expect(w2!.top).toBe(w4!.top);
        expect(w2!.top).toBeGreaterThan(w1!.top);
        expect(w3!.width).toBeGreaterThan(w1!.width);
        expect(w2!.width).toBeGreaterThan(w4!.width);
        expect(Math.abs(w1!.width - w4!.width)).toBeLessThanOrEqual(1);
        expect(Math.abs(w3!.width - w2!.width)).toBeLessThanOrEqual(1);
      } else if (viewport.columns === "2") {
        expect(w1!.top).toBe(w3!.top);
        expect(Math.abs(w1!.width - w3!.width)).toBeLessThanOrEqual(1);
        expect(w2!.top).toBeGreaterThan(w1!.top);
      } else {
        expect(new Set(boxes.map((box) => box.left)).size).toBe(1);
        expect(boxes.map((box) => box.top)).toEqual([...boxes.map((box) => box.top)].sort((a, b) => a - b));
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      // No figure overflows its tile.
      const clipped = await page.locator(`${SECTION} [data-roi-value]`).evaluateAll((nodes) =>
        nodes.filter((node) => {
          const tile = node.closest("article")!.getBoundingClientRect();
          const rect = node.getBoundingClientRect();
          return rect.right > tile.right + 0.5 || rect.left < tile.left - 0.5;
        }).length,
      );
      expect(clipped).toBe(0);
    });
  }
});

test.describe("section ROI : réglages (L4-B4)", () => {
  test("clavier : négociateurs 4 → 5 donne ≈ 340 h et ≈ 13 500 € ; « Valeurs par défaut » n'apparaît qu'après un changement ; annonce polie ; focus cobalt ; cible ≥ 44 px", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    const time = widget(page, "time");
    const slider = time.getByRole("slider", { name: ROI.widgets.time.sliders.negotiators.label });
    await slider.scrollIntoViewIfNeeded();
    await expect(slider).toHaveAttribute("aria-valuetext", "4 négociateurs");
    await expect(slider).toBeEnabled();
    expect((await slider.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(time.getByRole("button", { name: ROI.reset })).toHaveCount(0);
    const live = time.locator("[data-roi-live]");
    await expect(live).toHaveText("");

    await slider.focus();
    await page.keyboard.press("ArrowRight");
    await expect(slider).toHaveValue("5");
    await expect(slider).toHaveAttribute("aria-valuetext", "5 négociateurs");
    await expect.poll(async () => (await figures(page)).slice(7, 10)).toEqual(["≈340h", "1125hd'administratifparan", "≈13500€detempsvaloriséparan"]);
    await expect(time.locator("[data-roi-value]").first()).toHaveAttribute("data-roi-value", "337.5");
    // Spoken 500 ms after the last change, once.
    await expect(live).toHaveText(/Potentiel estimé : environ 340 heures et 13\s500 euros par an\./, { timeout: 1_500 });
    // Focus ring of the product on the thumb (cobalt): keyboard focus is visible, the rule exists.
    expect(await slider.evaluate((node) => node.matches(":focus-visible"))).toBe(true);
    const ring = await page.evaluate(() =>
      Array.from(document.styleSheets).some((sheet) => {
        try {
          return Array.from(sheet.cssRules).some((rule) => /:focus-visible::-webkit-slider-thumb/.test(rule.cssText) && /--color-accent/.test(rule.cssText));
        } catch {
          return false;
        }
      }),
    );
    expect(ring).toBe(true);

    // Home / End: bounds; « Valeurs par défaut » brings the defaults back.
    await page.keyboard.press("End");
    await expect(slider).toHaveValue("15");
    const reset = time.getByRole("button", { name: ROI.reset });
    await expect(reset).toBeVisible();
    expect((await reset.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await reset.click();
    await expect(slider).toHaveValue("4");
    await expect(time.getByRole("button", { name: ROI.reset })).toHaveCount(0);
    await expect.poll(async () => (await figures(page))[7]).toBe("≈270h");

    // W3: requests and late share, with their units.
    const mandates = widget(page, "mandates");
    const requests = mandates.getByRole("slider", { name: ROI.widgets.mandates.sliders.requests.label });
    const late = mandates.getByRole("slider", { name: ROI.widgets.mandates.sliders.lateShare.label });
    await expect(requests).toHaveAttribute("aria-valuetext", "40 demandes par mois");
    await expect(late).toHaveAttribute("aria-valuetext", "15 pour cent");
    await late.focus();
    await page.keyboard.press("End");
    await expect(late).toHaveAttribute("aria-valuetext", "30 pour cent");
    await requests.focus();
    await page.keyboard.press("End");
    await expect.poll(async () => (await figures(page))[2]).toBe("≈254000€HT");
  });

  test("valeurs jamais envoyées : aucun appel réseau ni changement d'adresse quand un curseur bouge", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    const url = page.url();
    const requests: string[] = [];
    page.on("request", (request) => {
      if (!/\/_next\/|webpack|hot-update|__nextjs/.test(request.url())) requests.push(`${request.method()} ${request.url()}`);
    });
    const slider = widget(page, "mandates").getByRole("slider").first();
    await expect(slider).toBeEnabled();
    await slider.scrollIntoViewIfNeeded();
    await slider.focus();
    for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(800);
    expect(requests).toEqual([]);
    expect(page.url()).toBe(url);
    const stored = await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length, cookie: document.cookie.includes("roi") }));
    expect(stored).toEqual({ local: 0, session: 0, cookie: false });
  });
});

test("sans JavaScript : valeurs par défaut finales, curseurs désactivés et note (cas dégradé)", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await openHome(page);
  expect(await figures(page)).toEqual(DEFAULTS);
  expect(await states(page)).toEqual(["done", "done", "done", "done"]);
  const sliders = page.locator(`${SECTION} input[type='range']`);
  await expect(sliders).toHaveCount(4);
  for (const slider of await sliders.all()) await expect(slider).toBeDisabled();
  await expect(page.locator(SECTION).getByText(ROI.noScript)).toHaveCount(2);
  await expect(page.getByTestId("roi-disclaimer")).toHaveText(ROI.disclaimer);
  await expect(page.getByTestId("landing-replay")).toHaveCount(0);
  await context.close();
});

test.describe("section ROI en mouvement (L4-B5)", () => {
  test.use({ reducedMotion: "no-preference" });

  test("arrivée : armed → playing → done ≤ 1 900 ms après 40 % visible ; puis immobile, 0 requestAnimationFrame", async ({ page }) => {
    test.setTimeout(90_000);
    await instrumentPage(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    await expect.poll(() => states(page)).toEqual(["armed", "armed", "armed", "armed"]);
    // Armed: numbers at their start (×1 for W1, 0 elsewhere).
    expect((await figures(page))[0]).toBe("×1");
    expect((await figures(page))[7]).toBe("≈0h");

    await page.evaluate(() => {
      const log: { widget: string; what: string; at: number }[] = [];
      (window as unknown as { __roi: typeof log }).__roi = log;
      for (const tile of document.querySelectorAll<HTMLElement>("[data-testid='roi-widget']")) {
        const key = tile.dataset.widget ?? "";
        const body = tile.querySelector<HTMLElement>("[data-roi-state]")!;
        new MutationObserver(() => log.push({ widget: key, what: body.dataset.roiState ?? "", at: performance.now() })).observe(body, {
          attributes: true,
          attributeFilter: ["data-roi-state"],
        });
        new IntersectionObserver(
          (entries) => {
            if (entries.some((entry) => entry.intersectionRatio >= 0.4)) log.push({ widget: key, what: "visible40", at: performance.now() });
          },
          { threshold: [0.4] },
        ).observe(tile);
      }
    });
    await centerSection(page, "resultat");
    await page.locator(`${SECTION} [data-testid='roi-grid']`).evaluate((grid) => grid.scrollIntoView({ block: "center", behavior: "instant" }));
    await expect.poll(() => states(page), { timeout: 6_000 }).toEqual(["done", "done", "done", "done"]);
    expect(await figures(page)).toEqual(DEFAULTS);

    const log = await page.evaluate(() => (window as unknown as { __roi: { widget: string; what: string; at: number }[] }).__roi);
    for (const key of ORDER) {
      const entries = log.filter((entry) => entry.widget === key);
      const visible = entries.find((entry) => entry.what === "visible40")!.at;
      const playing = entries.find((entry) => entry.what === "playing")!.at;
      const done = entries.find((entry) => entry.what === "done")!.at;
      console.log(`ROI ${key}: playing +${Math.round(playing - visible)} ms, done +${Math.round(done - visible)} ms after 40 %`);
      expect(playing - visible).toBeGreaterThanOrEqual(200);
      expect(done - visible).toBeLessThanOrEqual(1_900);
    }

    // Then: still. No requestAnimationFrame for 2 s once the network has settled; no infinite animation.
    await page.waitForTimeout(4_000);
    const calls = await rafCalls(page);
    const before = await figures(page);
    await page.waitForTimeout(2_000);
    expect(await rafCalls(page), "requestAnimationFrame calls once done").toBe(calls);
    expect(await figures(page)).toEqual(before);
    const infinite = await page.evaluate(() =>
      document.getAnimations().filter((animation) => animation.playState === "running" && animation.effect?.getComputedTiming().iterations === Infinity).length,
    );
    expect(infinite).toBe(0);
    // 10 s after the arrival, nothing has changed.
    await page.waitForTimeout(4_000);
    expect(await states(page)).toEqual(["done", "done", "done", "done"]);
    expect(await figures(page)).toEqual(DEFAULTS);
  });

  test("changement de curseur en mouvement : le chiffre compte vers la nouvelle valeur en ≈ 320 ms", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    const time = widget(page, "time");
    const slider = time.getByRole("slider", { name: ROI.widgets.time.sliders.negotiators.label });
    // Hydrated (the server HTML disables the sliders), then the arrival plays and ends.
    await expect(slider).toBeEnabled();
    await time.scrollIntoViewIfNeeded();
    await expect(time.locator("[data-roi-state]")).not.toHaveAttribute("data-roi-state", "armed", { timeout: 6_000 });
    await expect(time.locator("[data-roi-state]")).toHaveAttribute("data-roi-state", "done", { timeout: 6_000 });
    await slider.focus();
    await page.keyboard.press("End");
    // 15 negotiators × 5 h × 45 weeks × 30 % = 1 012.5 h → « ≈ 1 010 h », × 40 € → « ≈ 40 500 € ».
    const started = Date.now();
    await expect.poll(async () => (await figures(page))[7], { timeout: 1_000, intervals: [20] }).toBe("≈1010h");
    expect(Date.now() - started, "count of a change").toBeLessThan(900);
    await expect.poll(async () => (await figures(page))[9]).toBe("≈40500€detempsvaloriséparan");
    // Both sliders at their maximum: the bound of the spec, ≈ 2 030 h and ≈ 81 000 €.
    await time.getByRole("slider", { name: ROI.widgets.time.sliders.hours.label }).focus();
    await page.keyboard.press("End");
    await expect.poll(async () => (await figures(page))[7], { timeout: 1_000 }).toBe("≈2030h");
    await expect.poll(async () => (await figures(page))[9]).toBe("≈81000€detempsvaloriséparan");
  });
});

test("mouvement réduit : état final à l'instant 0, changement instantané", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openHome(page);
  expect(await states(page)).toEqual(["done", "done", "done", "done"]);
  const slider = widget(page, "time").getByRole("slider").first();
  await expect(slider).toBeEnabled();
  await slider.scrollIntoViewIfNeeded();
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  // Reduced motion: the new value at once (no count).
  await expect.poll(async () => (await figures(page))[7], { timeout: 300, intervals: [20] }).toBe("≈340h");
});
