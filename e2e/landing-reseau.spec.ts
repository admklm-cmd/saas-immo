import { expect, test, type Page } from "@playwright/test";

import { HERO_TITLE } from "@/components/landing-texts";

import {
  canvasPixels,
  canvasSnapshot,
  centerSection,
  contrastFailures,
  instrumentPage,
  litSeen,
  loadEnd,
  measureContrast,
  motionLog,
  rafCalls,
  waitForMotion,
  type LineContrast,
} from "./helpers/landing-network";

/**
 * Neural network behind the landing (docs/design-system.md §2.11.4, plan
 * docs/plans/2026-10-02-landing-motion.md T6): bounded sequences only, no
 * frame at rest, camera tied to the scroll, cost, colours, ink, contrast,
 * phone and hidden tab. Chromium, motion allowed except (f).
 */

const COLD_START = 60_000;
const SECTIONS = ["probleme", "solution", "agents", "controle", "resultat", "final"] as const;

async function openHome(page: Page): Promise<void> {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: HERO_TITLE })).toBeVisible({ timeout: COLD_START });
}

function canvas(page: Page) {
  return page.getByTestId("living-background");
}

/** No frame requested by the page for `window` ms, and the canvas unchanged. */
async function expectStill(page: Page, window = 2_000): Promise<void> {
  const calls = await rafCalls(page);
  const frames = await canvas(page).getAttribute("data-frames");
  const before = await canvasSnapshot(page);
  await page.waitForTimeout(window / 2);
  const middle = await canvasSnapshot(page);
  await page.waitForTimeout(window / 2);
  expect(await rafCalls(page), "requestAnimationFrame calls at rest").toBe(calls);
  expect(await canvas(page).getAttribute("data-frames")).toBe(frames);
  expect(middle === before, "canvas identical 1 s apart").toBe(true);
}

test.describe("avec animations", () => {
  test.use({ reducedMotion: "no-preference", viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await instrumentPage(page);
  });

  test("(a, b, e, g, h) arrivée : idle → sequence → settled ≤ 6 s, puis immobile, sans cobalt, encre dans la bande", async ({ page }) => {
    await openHome(page);
    await waitForMotion(page, "settled", 15_000);
    const log = await motionLog(page);
    const states = log.map((entry) => entry.state);
    expect(states).toContain("sequence");
    expect(states.indexOf("sequence")).toBeLessThan(states.lastIndexOf("settled"));
    const settledAt = log.findLast((entry) => entry.state === "settled")!.at;
    const sinceLoad = settledAt - (await loadEnd(page));
    test.info().annotations.push({ type: "settled après le chargement (ms)", description: sinceLoad.toFixed(0) });
    expect(sinceLoad).toBeLessThanOrEqual(6_000);
    await expect(canvas(page)).toHaveAttribute("data-sequences", "arrivee");
    expect(await litSeen(page), "cores lit during the cascade").toBeGreaterThan(0);
    await expect(canvas(page)).toHaveAttribute("data-nodes", "34");

    // (e) cost of the arrival frames (camera drifting: the network is repainted each frame).
    const p95 = Number(await canvas(page).getAttribute("data-frame-ms-p95"));
    test.info().annotations.push({ type: "p95 arrivée (ms)", description: String(p95) });
    expect(p95).toBeGreaterThan(0);
    expect(p95).toBeLessThanOrEqual(4);

    // (b) no loop: 1 s after settled, no frame for 2 s and an identical canvas.
    await page.waitForTimeout(1_000);
    await expectStill(page);
    await expect(canvas(page)).toHaveAttribute("data-signals", "0");
    await expect(canvas(page)).toHaveAttribute("data-lit", "0");

    // (g) no cobalt at rest; (h) ink within the band.
    const pixels = await canvasPixels(page);
    test.info().annotations.push({ type: "encre 1440 (%)", description: (pixels.ink * 100).toFixed(2) });
    expect(pixels.cobalt).toBe(0);
    expect(pixels.ink).toBeGreaterThanOrEqual(0.012);
    expect(pixels.ink).toBeLessThanOrEqual(0.022);
  });

  test("(c) sections : une salve à la première entrée, jamais rejouée, posée ≤ 4 s puis immobile", async ({ page }) => {
    test.setTimeout(180_000);
    await openHome(page);
    await waitForMotion(page, "settled", 15_000);

    for (const scene of SECTIONS) {
      await centerSection(page, scene);
      await expect(canvas(page)).toHaveAttribute("data-scene", scene, { timeout: 5_000 });
      const entered = Date.now();
      await expect(canvas(page)).toHaveAttribute("data-sequences", new RegExp(`(^|,)${scene}(,|$)`));
      await waitForMotion(page, "settled", 4_000);
      test.info().annotations.push({ type: `settled ${scene} (ms)`, description: String(Date.now() - entered) });
      await expectStill(page);
    }
    const played = (await canvas(page).getAttribute("data-sequences"))!.split(",");
    expect(played).toEqual(["arrivee", ...SECTIONS]);

    // Back on a section already played: nothing is replayed.
    await centerSection(page, "probleme");
    await expect(canvas(page)).toHaveAttribute("data-scene", "probleme", { timeout: 5_000 });
    await waitForMotion(page, "settled", 4_000);
    expect((await canvas(page).getAttribute("data-sequences"))!.split(",")).toEqual(played);
    await expect(canvas(page)).toHaveAttribute("data-signals", "0");
  });

  test("(d, e) caméra : bouge pendant le défilement, se pose ≤ 1,2 s après, puis plus aucune image", async ({ page }) => {
    await openHome(page);
    await waitForMotion(page, "settled", 15_000);
    await page.evaluate(() => {
      const target = window as unknown as { __lastScroll: number };
      target.__lastScroll = 0;
      window.addEventListener("scroll", () => (target.__lastScroll = performance.now()), { passive: true });
    });
    const frames = Number(await canvas(page).getAttribute("data-frames"));
    // A gesture within the hero: the scene stays « hero », only the camera moves.
    await page.mouse.move(700, 450);
    const logged = (await motionLog(page)).length;
    for (let step = 0; step < 6; step++) {
      await page.mouse.wheel(0, 50);
      await page.waitForTimeout(40);
    }
    await waitForMotion(page, "settled", 3_000);
    // The camera moved with the gesture (and only then).
    expect((await motionLog(page)).slice(logged).map((entry) => entry.state)).toContain("camera");
    expect(Number(await canvas(page).getAttribute("data-frames"))).toBeGreaterThan(frames);
    await expect(canvas(page)).toHaveAttribute("data-scene", "hero");
    const log = await motionLog(page);
    const settledAt = log.findLast((entry) => entry.state === "settled")!.at;
    const lastScroll = await page.evaluate(() => (window as unknown as { __lastScroll: number }).__lastScroll);
    test.info().annotations.push({ type: "caméra posée après le dernier défilement (ms)", description: (settledAt - lastScroll).toFixed(0) });
    expect(settledAt - lastScroll).toBeLessThanOrEqual(1_200);
    const p95 = Number(await canvas(page).getAttribute("data-frame-ms-p95"));
    test.info().annotations.push({ type: "p95 caméra en mouvement (ms)", description: String(p95) });
    expect(p95).toBeLessThanOrEqual(4);
    await page.mouse.move(-10, -10);
    await expectStill(page);
  });

  test("(k) onglet caché pendant l'arrivée : au retour, réseau posé, aucune impulsion", async ({ page }) => {
    await openHome(page);
    await waitForMotion(page, "sequence", 10_000);
    await page.waitForTimeout(600);
    const setHidden = (hidden: boolean) =>
      page.evaluate((value) => {
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (value ? "hidden" : "visible") });
        Object.defineProperty(document, "hidden", { configurable: true, get: () => value });
        document.dispatchEvent(new Event("visibilitychange"));
      }, hidden);
    await setHidden(true);
    await waitForMotion(page, "hidden", 2_000);
    await page.waitForTimeout(500);
    await setHidden(false);
    await waitForMotion(page, "settled", 1_000);
    await expect(canvas(page)).toHaveAttribute("data-signals", "0");
    await expect(canvas(page)).toHaveAttribute("data-lit", "0");
    expect((await canvasPixels(page)).cobalt).toBe(0);
    await expectStill(page);
    await expect(canvas(page)).toHaveAttribute("data-sequences", "arrivee");
  });

  test("(i) contraste des textes hors carte : pendant l'arrivée et au repos, 1440 et 390", async ({ page }) => {
    test.setTimeout(240_000);
    const report: string[] = [];
    let worst: Record<string, number> = {};
    const record = (label: string, results: LineContrast[]) => {
      for (const line of results) {
        worst[line.role] = Math.min(worst[line.role] ?? Infinity, line.darkest);
        if (line.role === "title-subtle") worst["title-subtle-median"] = Math.min(worst["title-subtle-median"] ?? Infinity, line.median);
      }
      report.push(...contrastFailures(results).map((failure) => `${label}: ${failure}`));
    };

    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
    ]) {
      worst = {};
      await page.setViewportSize(viewport);
      await openHome(page);
      await waitForMotion(page, "sequence", 10_000);
      for (const instant of [400, 1_400, 2_400]) {
        await page.waitForTimeout(instant === 400 ? 400 : 1_000);
        record(`${viewport.width} arrivée +${instant}`, await measureContrast(page));
      }
      await waitForMotion(page, "settled", 10_000);
      record(`${viewport.width} hero`, await measureContrast(page));
      for (const scene of SECTIONS) {
        await centerSection(page, scene);
        await expect(canvas(page)).toHaveAttribute("data-scene", scene, { timeout: 5_000 });
        await waitForMotion(page, "settled", 6_000);
        // Section reveals and title effects end within 2.5 s.
        await page.waitForTimeout(2_600);
        record(`${viewport.width} ${scene}`, await measureContrast(page));
      }
      test.info().annotations.push({
        type: `contraste minimal ${viewport.width}`,
        description: Object.entries(worst)
          .map(([role, value]) => `${role} ${value.toFixed(2)}`)
          .join(" · "),
      });
    }
    expect(report).toEqual([]);
  });
});

test("(f) mouvement réduit : pose fixe, aucun cobalt, rien ne bouge au défilement, aucune image demandée", async ({ page }) => {
  await instrumentPage(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await openHome(page);
  await waitForMotion(page, "reduced", 5_000);
  // Never anything else than « reduced ».
  expect((await motionLog(page)).every((entry) => entry.state === "reduced")).toBe(true);
  await expect(canvas(page)).toHaveAttribute("data-frames", "1");
  const pixels = await canvasPixels(page);
  expect(pixels.cobalt).toBe(0);
  expect(pixels.ink).toBeGreaterThan(0.005);
  const calls = await rafCalls(page);
  const before = await canvasSnapshot(page);
  await centerSection(page, "agents");
  await page.waitForTimeout(1_500);
  expect(await canvasSnapshot(page)).toBe(before);
  expect(await rafCalls(page)).toBe(calls);
  await expect(canvas(page)).toHaveAttribute("data-sequences", "");
  await expect(canvas(page)).toHaveAttribute("data-motion", "reduced");
});

test.describe("téléphone", () => {
  test.use({ reducedMotion: "no-preference", viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });

  test("(j, h) 20 neurones, définition plafonnée à 1,5, encre dans la bande", async ({ page }) => {
    await instrumentPage(page);
    await openHome(page);
    await expect(canvas(page)).toHaveAttribute("data-nodes", "20");
    const ratio = await canvas(page).evaluate((element) => (element as HTMLCanvasElement).width / window.innerWidth);
    expect(ratio).toBeLessThanOrEqual(1.5);
    await waitForMotion(page, "settled", 15_000);
    const pixels = await canvasPixels(page);
    test.info().annotations.push({ type: "encre 390 (%)", description: (pixels.ink * 100).toFixed(2) });
    expect(pixels.cobalt).toBe(0);
    expect(pixels.ink).toBeGreaterThanOrEqual(0.008);
    expect(pixels.ink).toBeLessThanOrEqual(0.02);
    await page.waitForTimeout(1_000);
    await expectStill(page);
  });
});
