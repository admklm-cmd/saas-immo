import { expect, test, type Page } from "@playwright/test";

import { BRAND } from "@/components/brand";
import { HERO_TITLE, LANDING_TEXTS } from "@/components/landing-texts";

/**
 * Brand wordmark (BRAND.shortName) signing the landing final panel (adapted from React Bits
 * TechText, docs/design-system.md §2.11.3): plain HTML at rest, a sweep played
 * once, decorative (`aria-hidden`), never blocking the scroll, no overflow.
 */

const COLD_START = 60_000;
const FINAL = LANDING_TEXTS.final;

async function openHome(page: Page): Promise<void> {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: HERO_TITLE })).toBeVisible({ timeout: COLD_START });
}

test("mouvement réduit : le mot de marque en HTML, sans canvas, décoratif, hors du nom accessible du panneau", async ({ page }) => {
  await openHome(page);
  const wordmark = page.getByTestId("tech-wordmark");
  await wordmark.scrollIntoViewIfNeeded();
  await expect(wordmark).toBeVisible();
  await expect(wordmark).toHaveText(FINAL.wordmark);
  await expect(wordmark).toHaveAttribute("aria-hidden", "true");
  await expect(wordmark.locator("canvas")).toHaveCount(0);
  expect(await wordmark.evaluate((node) => getComputedStyle(node).touchAction)).toContain("pan-y");

  // The final section is named by its title only; the wordmark is never announced there.
  const section = page.locator("section[data-living-scene='final']");
  const name = await section.evaluate((node) => document.getElementById(node.getAttribute("aria-labelledby") ?? "")?.textContent ?? "");
  expect(name).not.toContain(BRAND.shortName);
  await expect(page.getByRole("region", { name: new RegExp(BRAND.shortName) })).toHaveCount(0);
  // The real name stays readable elsewhere (header logo).
  await expect(page.getByRole("link", { name: BRAND.name }).first()).toBeAttached();
  // The guard rails of the panel are untouched.
  await expect(section).toContainText(FINAL.note);
});

test("cas dégradé : sans JavaScript, le mot est là, plein, sans canvas", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, reducedMotion: "no-preference" });
  const page = await context.newPage();
  await openHome(page);
  const wordmark = page.getByTestId("tech-wordmark");
  await expect(wordmark).toHaveText(FINAL.wordmark);
  await expect(wordmark.locator("canvas")).toHaveCount(0);
  await expect(wordmark.locator("[data-letter]").first()).toHaveCSS("visibility", "visible");
  await context.close();
});

test("aucun débordement du panneau ni du document (1440 / 1024 / 390 / 360)", async ({ page }) => {
  for (const width of [1440, 1024, 390, 360]) {
    await page.setViewportSize({ width, height: 900 });
    await openHome(page);
    const report = await page.getByTestId("tech-wordmark").evaluate((node) => {
      const panel = node.closest(".\\@container") as HTMLElement;
      const box = node.getBoundingClientRect();
      const inner = panel.getBoundingClientRect();
      const padding = parseFloat(getComputedStyle(panel).paddingRight);
      return {
        fontSize: parseFloat(getComputedStyle(node).fontSize),
        right: box.right,
        limit: inner.right - padding,
        documentOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    });
    test.info().annotations.push({ type: `wordmark @ ${width}`, description: `${report.fontSize.toFixed(1)} px` });
    expect(report.documentOverflow, `document @ ${width}`).toBe(false);
    expect(report.right, `wordmark @ ${width}`).toBeLessThanOrEqual(report.limit + 0.5);
    expect(report.fontSize).toBeGreaterThanOrEqual(64);
    expect(report.fontSize).toBeLessThanOrEqual(240);
  }
});

test.describe("avec mouvement", () => {
  test.use({ reducedMotion: "no-preference" });

  test("balayage joué une fois (idle → sweep → idle en ≤ 4 s), canvas vide au repos", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    const wordmark = page.getByTestId("tech-wordmark");
    await expect(wordmark.getByTestId("tech-wordmark-canvas")).toHaveCount(1);
    type Log = { state: string; at: number }[];
    // Record every state the wordmark goes through, timed in the page; then bring it on screen.
    await page.mouse.move(0, 0);
    await wordmark.evaluate((node) => {
      const log: Log = [{ state: node.getAttribute("data-wordmark-state") ?? "", at: performance.now() }];
      (window as unknown as { __wordmarkLog: Log }).__wordmarkLog = log;
      new MutationObserver(() => log.push({ state: node.getAttribute("data-wordmark-state") ?? "", at: performance.now() })).observe(node, {
        attributes: true,
        attributeFilter: ["data-wordmark-state"],
      });
      // Entering = first time 60 % on screen (docs §2.11.3), timed like the states.
      const entry = new IntersectionObserver(
        (entries) => {
          if (!entries.some((item) => item.intersectionRatio >= 0.6)) return;
          log.push({ state: "entered", at: performance.now() });
          entry.disconnect();
        },
        { threshold: 0.6 },
      );
      entry.observe(node);
      node.scrollIntoView({ block: "center" });
    });
    await expect(wordmark).toHaveAttribute("data-wordmark-state", "sweep", { timeout: 4_000 });
    await expect(wordmark).toHaveAttribute("data-wordmark-state", "idle", { timeout: 4_000 });
    const log = await page.evaluate(() => (window as unknown as { __wordmarkLog: Log }).__wordmarkLog);
    const entered = log.find((entry) => entry.state === "entered")?.at ?? 0;
    const sweep = log.find((entry) => entry.state === "sweep");
    const done = log.find((entry) => entry.state === "idle" && sweep && entry.at > sweep.at);
    expect(sweep && done).toBeTruthy();
    const startMs = Math.round((sweep?.at ?? 0) - entered);
    const sweepMs = Math.round((done?.at ?? 0) - (sweep?.at ?? 0));
    const totalMs = Math.round((done?.at ?? 0) - entered);
    test.info().annotations.push({ type: "sweep", description: `starts ${startMs} ms after entering, lasts ${sweepMs} ms, idle at ${totalMs} ms` });
    expect(sweepMs).toBeLessThanOrEqual(1_650);
    expect(totalMs).toBeLessThanOrEqual(4_000);

    // At rest: HTML letters visible, canvas cleared, no frame drawn any more.
    const frames = await wordmark.getAttribute("data-wordmark-frames");
    expect(Number(frames)).toBeGreaterThan(0);
    await page.waitForTimeout(2_500);
    expect(await wordmark.getAttribute("data-wordmark-frames")).toBe(frames);
    const states = (await page.evaluate(() => (window as unknown as { __wordmarkLog: Log }).__wordmarkLog)).map((entry) => entry.state);
    expect(states.filter((state) => state === "sweep")).toHaveLength(1);
    expect(states.filter((state) => state !== "entered").at(-1)).toBe("idle");
    await expect(wordmark.locator("[data-letter]").first()).toHaveCSS("visibility", "visible");
    const blank = await wordmark.getByTestId("tech-wordmark-canvas").evaluate((node) => {
      const canvas = node as HTMLCanvasElement;
      const data = canvas.getContext("2d")?.getImageData(0, 0, canvas.width, canvas.height).data;
      return data ? data.every((value) => value === 0) : true;
    });
    expect(blank).toBe(true);

    // Leaving and coming back never replays the sweep.
    await page.evaluate(() => window.scrollTo(0, 0));
    await wordmark.evaluate((node) => node.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(3_000);
    expect(await wordmark.getAttribute("data-wordmark-frames")).toBe(frames);
  });

  test("survol à la souris : la lettre passe en contour, puis tout revient au plein en sortant", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    const wordmark = page.getByTestId("tech-wordmark");
    await wordmark.evaluate((node) => node.scrollIntoView({ block: "center" }));
    // Let the one-time sweep play first: the pointer then has the word to itself.
    await expect(wordmark).toHaveAttribute("data-wordmark-state", "sweep", { timeout: 4_000 });
    await expect(wordmark).toHaveAttribute("data-wordmark-state", "idle", { timeout: 4_000 });
    const letter = wordmark.locator("[data-letter='2']");
    const box = await letter.boundingBox();
    if (!box) throw new Error("no letter box");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
    await expect(wordmark).toHaveAttribute("data-wordmark-state", "active");
    await expect(letter).toHaveCSS("visibility", "hidden");
    await page.mouse.move(5, 5, { steps: 4 });
    await expect(wordmark).toHaveAttribute("data-wordmark-state", "idle", { timeout: 2_000 });
    await expect(letter).toHaveCSS("visibility", "visible");
  });

  test("téléphone : le défilement n'est jamais bloqué sur le mot", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
      reducedMotion: "no-preference",
    });
    const page = await context.newPage();
    await openHome(page);
    const wordmark = page.getByTestId("tech-wordmark");
    await wordmark.evaluate((node) => node.scrollIntoView({ block: "center" }));
    expect(await wordmark.evaluate((node) => getComputedStyle(node).touchAction)).toBe("pan-y pinch-zoom");
    // A touch move that starts on the word is never cancelled by the page.
    const prevented = await wordmark.evaluate((node) => {
      let cancelled = false;
      const listener = (event: Event) => {
        cancelled = event.defaultPrevented;
      };
      window.addEventListener("touchmove", listener);
      const rect = node.getBoundingClientRect();
      const touch = new Touch({ identifier: 1, target: node, clientX: rect.left + 20, clientY: rect.top + 20 });
      node.dispatchEvent(new TouchEvent("touchstart", { touches: [touch], bubbles: true, cancelable: true }));
      node.dispatchEvent(new TouchEvent("touchmove", { touches: [touch], bubbles: true, cancelable: true }));
      window.removeEventListener("touchmove", listener);
      return cancelled;
    });
    expect(prevented).toBe(false);
    // A short tap on a letter shows the frame, then the word is back to rest.
    const letter = wordmark.locator("[data-letter='0']");
    await letter.tap();
    await expect(wordmark).toHaveAttribute("data-wordmark-state", /active|idle/);
    await expect(wordmark).toHaveAttribute("data-wordmark-state", "idle", { timeout: 6_000 });
    await context.close();
  });
});
