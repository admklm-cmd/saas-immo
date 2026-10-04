import { expect, test, type Page } from "@playwright/test";

import { HERO_TITLE, LANDING_TEXTS } from "@/components/landing-texts";

/**
 * The `tech` effect of « décide », title of the control section
 * (docs/design-system.md §2.11.8.2, criteria T2 and T3 of §2.11.8.6): the
 * TechText frame sweeps the letters once at the entry, replays when a mouse
 * enters any word of the title or on a brief tap (§2.11.8.8 L4-C: sweep only,
 * never follow nor drag under a finger), follows a fine pointer, lets a letter
 * be dragged and springs it back; reduced motion gets nothing. Since Lot 4 the
 * word is set in the face of the title (Bricolage 600, upright). The title
 * stays HTML text: its accessible name never changes.
 *
 * No form on this journey: no consent checkbox to check.
 */

const COLD_START = 60_000;
const TITLE = "#control-title";
const NAME = LANDING_TEXTS.control.title;

async function openHome(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: HERO_TITLE })).toBeVisible({ timeout: COLD_START });
}

/** Records, in the page, when the Reveal of the control section enters and when the title changes state. */
async function recordTimeline(page: Page): Promise<void> {
  await page.evaluate((selector) => {
    const title = document.querySelector<HTMLElement>(selector)!;
    const reveal = title.closest(".reveal")!;
    const log: { what: string; at: number }[] = [];
    (window as unknown as { __tech: typeof log }).__tech = log;
    new MutationObserver(() => log.push({ what: `reveal:${reveal.getAttribute("data-reveal")}`, at: performance.now() })).observe(reveal, {
      attributes: true,
      attributeFilter: ["data-reveal"],
    });
    new MutationObserver(() => log.push({ what: `state:${title.dataset.techState}`, at: performance.now() })).observe(title, {
      attributes: true,
      attributeFilter: ["data-tech-state"],
    });
  }, TITLE);
}

async function timeline(page: Page): Promise<{ what: string; at: number }[]> {
  return page.evaluate(() => (window as unknown as { __tech: { what: string; at: number }[] }).__tech);
}

/** Non-transparent pixels of the canvas, and the lowest cobalt pixel (label) in page coordinates. */
async function canvasInk(page: Page): Promise<{ inked: number; cobaltBottom: number | null; cobaltTop: number | null }> {
  return page.locator(`${TITLE} canvas`).evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const context = canvas.getContext("2d");
    if (!context || canvas.width === 0) return { inked: 0, cobaltBottom: null, cobaltTop: null };
    const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
    const rect = canvas.getBoundingClientRect();
    const scale = rect.height / height;
    let inked = 0;
    let bottom = -1;
    let top = Infinity;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (data[i + 3]! === 0) continue;
        inked += 1;
        if (data[i + 3]! > 200 && data[i + 2]! - data[i]! > 80 && data[i + 2]! > 150) {
          bottom = Math.max(bottom, y);
          top = Math.min(top, y);
        }
      }
    }
    return {
      inked,
      cobaltBottom: bottom < 0 ? null : rect.top + (bottom + 1) * scale,
      cobaltTop: top === Infinity ? null : rect.top + top * scale,
    };
  });
}

/** Box of the dark ink (text) of a capture of `clip`, relative to the clip. */
async function inkBox(page: Page, clip: { x: number; y: number; width: number; height: number }) {
  const shot = await page.screenshot({ clip, animations: "allow" });
  return page.evaluate(async (image) => {
    const bitmap = new Image();
    bitmap.src = `data:image/png;base64,${image}`;
    await bitmap.decode();
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d")!;
    context.drawImage(bitmap, 0, 0);
    const { data, width, height } = context.getImageData(0, 0, bitmap.width, bitmap.height);
    let left = Infinity;
    let right = -1;
    let top = Infinity;
    let bottom = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (data[i]! < 90 && data[i + 1]! < 90 && data[i + 2]! < 90) {
          left = Math.min(left, x);
          right = Math.max(right, x);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
        }
      }
    }
    return { left, right, top, bottom };
  }, shot.toString("base64"));
}

async function letterBox(page: Page, index: number) {
  return page.locator(`${TITLE} [data-letter='${index}']`).evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const size = parseFloat(getComputedStyle(node).fontSize);
    // The letter box has no height (line-height 0): the baseline is read from a zero-size probe.
    const probe = document.createElement("span");
    probe.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline";
    node.appendChild(probe);
    const baseline = probe.getBoundingClientRect().top;
    probe.remove();
    return { left: rect.left, right: rect.right, baseline, size };
  });
}

/** Centre of the first visual word of the title (« L'IA »), far from « décide ». */
async function firstWord(page: Page): Promise<{ x: number; y: number }> {
  const box = (await page.locator(`${TITLE} [data-title-word]`).first().boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function waitForIdle(page: Page, timeout = 4_000): Promise<void> {
  await expect(page.locator(TITLE)).toHaveAttribute("data-tech-state", "idle", { timeout });
}

/** The arrival has painted (frames counted) and is over (idle again). */
async function waitForArrival(page: Page): Promise<void> {
  await expect(page.locator(TITLE)).toHaveAttribute("data-tech-frames", /\d+/, { timeout: 6_000 });
  await waitForIdle(page);
}

test.describe("titre « décide » : effet tech (1440, souris)", () => {
  test.use({ reducedMotion: "no-preference" });

  test("arrivée : balayage 760 ms après l'entrée, repos ≤ 2 400 ms, canvas vide, lettres HTML, étiquette sous le cadre (T2)", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    await page.mouse.move(2, 450);
    const title = page.locator(TITLE);
    await expect(title).toHaveAttribute("data-accent-effect", "tech");
    await expect(page.getByRole("heading", { level: 2, name: NAME })).toHaveCount(1);
    await recordTimeline(page);

    await title.scrollIntoViewIfNeeded();
    await expect(title).toHaveAttribute("data-tech-state", "sweep", { timeout: 3_000 });
    // While the frame is on the first letters: the label is UNDER the frame, above the paragraph.
    await page.waitForTimeout(120);
    const during = await canvasInk(page);
    const word = await letterBox(page, 0);
    const paragraph = await page.getByText(LANDING_TEXTS.control.body).boundingBox();
    expect(during.inked, "painting during the sweep").toBeGreaterThan(0);
    expect(during.cobaltBottom, "label drawn").not.toBeNull();
    expect(during.cobaltBottom!, "label above the paragraph").toBeLessThan(paragraph!.y);
    expect(during.cobaltBottom!, "label below the baseline of the word").toBeGreaterThan(word.baseline);
    // Only the effect is painted while active; the letters hold their place.
    await expect(page.locator(`${TITLE} [data-letter='5']`)).toHaveCSS("visibility", "hidden");

    await waitForIdle(page);
    const log = await timeline(page);
    const entered = log.find((entry) => entry.what === "reveal:entering")!.at;
    const sweep = log.find((entry) => entry.what === "state:sweep")!.at;
    const idle = log.filter((entry) => entry.what === "state:idle").at(-1)!.at;
    expect(sweep - entered, `sweep start ${Math.round(sweep - entered)} ms after the entry`).toBeGreaterThanOrEqual(660);
    expect(sweep - entered).toBeLessThanOrEqual(860);
    expect(idle - entered, `rest ${Math.round(idle - entered)} ms after the entry`).toBeLessThanOrEqual(2_400);
    console.log(`décide: sweep start +${Math.round(sweep - entered)} ms, rest +${Math.round(idle - entered)} ms after the entry`);

    // L4-C: the word is in the face of the title (Bricolage 600, upright, same size).
    const face = await page.locator(`${TITLE} [data-accent]`).evaluate((node) => {
      const style = getComputedStyle(node);
      const line = getComputedStyle(node.closest("[data-title-line]")!);
      return { family: style.fontFamily, style: style.fontStyle, weight: style.fontWeight, ratio: parseFloat(style.fontSize) / parseFloat(line.fontSize) };
    });
    expect(face.family.split(",")[0]).toMatch(/Bricolage/);
    expect(face.style).toBe("normal");
    expect(face.weight).toBe("600");
    expect(Math.abs(face.ratio - 1)).toBeLessThanOrEqual(0.005);

    // At rest: empty canvas, HTML letters visible, name unchanged.
    expect((await canvasInk(page)).inked).toBe(0);
    for (let index = 0; index < 6; index++) await expect(page.locator(`${TITLE} [data-letter='${index}']`)).toHaveCSS("visibility", "visible");
    await expect(page.getByRole("heading", { level: 2, name: NAME })).toHaveCount(1);
    expect(await page.locator("[data-accent-effect='tech']").count()).toBe(1);
  });

  test("lettres peintes = lettres HTML (≤ 1 px), largeur du mot (≤ 2 px), boîte de ligne (≤ 0,5 px), coût d'une image", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    await page.mouse.move(2, 450);
    const title = page.locator(TITLE);
    await title.scrollIntoViewIfNeeded();
    await waitForArrival(page);

    // The last letter « e », plain ink in HTML at rest…
    const e = await letterBox(page, 5);
    const clip = { x: Math.floor(e.left - 10), y: Math.floor(e.baseline - e.size), width: Math.ceil(e.right - e.left + 20), height: Math.ceil(e.size * 1.2) };
    const html = await inkBox(page, clip);
    // …then painted by the canvas, at the start of a replay (the frame is on « d », far from « e »).
    const start = await firstWord(page);
    await page.mouse.move(start.x, start.y);
    await expect(title).toHaveAttribute("data-tech-state", "sweep");
    const painted = await inkBox(page, clip);
    await expect(page.locator(`${TITLE} [data-letter='5']`)).toHaveCSS("visibility", "hidden");
    for (const edge of ["left", "right", "top", "bottom"] as const) {
      expect(Math.abs(painted[edge] - html[edge]), `« e » ${edge}: html ${html[edge]} / canvas ${painted[edge]}`).toBeLessThanOrEqual(1);
    }
    await page.mouse.move(2, 450);
    await waitForIdle(page);
    const cost = Number(await title.getAttribute("data-tech-cost"));
    expect(cost, `cost of the last painted frame: ${cost} ms`).toBeLessThanOrEqual(2);

    // Word width and line box: letters as inline-blocks (kerning off) vs plain inline text.
    const geometry = await page.evaluate((selector) => {
      const accent = document.querySelector<HTMLElement>(`${selector} [data-accent]`)!;
      const word = accent.querySelector<HTMLElement>("[data-tech-accent]")!;
      const line = accent.closest("[data-title-line]") as HTMLElement;
      const letters = Array.from(accent.querySelectorAll<HTMLElement>("[data-letter]"));
      const split = { width: word.getBoundingClientRect().width, line: line.getBoundingClientRect().height };
      letters.forEach((node) => {
        node.style.display = "inline";
        node.style.fontKerning = "auto";
      });
      const plain = { width: word.getBoundingClientRect().width, line: line.getBoundingClientRect().height };
      letters.forEach((node) => node.removeAttribute("style"));
      return { split, plain };
    }, TITLE);
    console.log(`décide: width ${geometry.split.width.toFixed(2)} px split / ${geometry.plain.width.toFixed(2)} px plain`);
    expect(Math.abs(geometry.split.width - geometry.plain.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(geometry.split.line - geometry.plain.line)).toBeLessThanOrEqual(0.5);
  });

  test("rejeu au survol, suivi du pointeur, lettre tirée plafonnée puis ressort (T3)", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    await page.mouse.move(2, 450);
    const title = page.locator(TITLE);
    await title.scrollIntoViewIfNeeded();
    await waitForArrival(page);
    await page.waitForTimeout(100);

    // Replay: the pointer enters the FIRST word of the title, far from « décide », then leaves.
    const entry = await firstWord(page);
    await page.mouse.move(entry.x, entry.y);
    await expect(title).toHaveAttribute("data-accent-replay", "running");
    await expect(title).toHaveAttribute("data-accent-replays", "1");
    await page.waitForTimeout(100);
    await expect(title).toHaveAttribute("data-tech-state", "sweep");
    await page.mouse.move(2, 450);
    await expect(title).toHaveAttribute("data-tech-state", "idle", { timeout: 1_700 });
    await expect(title).not.toHaveAttribute("data-accent-replay", "running");
    expect((await canvasInk(page)).inked).toBe(0);
    // The CSS controller never touched it.
    await expect(title).not.toHaveAttribute("data-accent-played");

    // Back in at once: cooldown (800 ms), no replay.
    await page.mouse.move(entry.x, entry.y);
    await page.waitForTimeout(100);
    await expect(title).toHaveAttribute("data-accent-replays", "1");
    await page.mouse.move(2, 450);
    await page.waitForTimeout(900);

    // Follow: on the word, the frame and the dashed outline follow the pointer.
    const c = await letterBox(page, 2);
    const cx = (c.left + c.right) / 2;
    const cy = c.baseline - c.size * 0.25;
    await page.mouse.move(cx, cy, { steps: 4 });
    await expect(title).toHaveAttribute("data-tech-state", /follow|sweep/);
    await expect(title).toHaveAttribute("data-tech-state", "follow", { timeout: 1_000 });
    // Centred title (§2.11.8.7 L3-C): the frame reaches full cobalt a few frames after the
    // switch to `follow` (measured between 50 and 200 ms at 1440), not on the same frame.
    await expect.poll(async () => (await canvasInk(page)).cobaltTop, { message: "frame drawn", timeout: 500, intervals: [16] }).not.toBeNull();

    // Drag « c » 80 px to the right: capped at 0.6 em.
    await page.mouse.down();
    await page.mouse.move(cx + 80, cy, { steps: 8 });
    await expect(title).toHaveAttribute("data-tech-state", "drag");
    const offset = Number(await title.getAttribute("data-tech-offset"));
    expect(offset, `dragged ${offset} px`).toBeGreaterThan(10);
    expect(offset).toBeLessThanOrEqual(0.6 * c.size);
    // Release: the spring brings it home (< 0.5 px) in ≤ 700 ms.
    await page.mouse.up();
    const released = Date.now();
    await expect.poll(async () => Number(await title.getAttribute("data-tech-offset")), { timeout: 900, intervals: [16] }).toBeLessThan(0.5);
    expect(Date.now() - released, "spring settle").toBeLessThanOrEqual(850);
    await page.mouse.move(2, 450);
    await waitForIdle(page);
    expect((await canvasInk(page)).inked).toBe(0);
    await expect(page.getByRole("heading", { level: 2, name: NAME })).toHaveCount(1);
  });
});

test("tactile (390 × 844) : un toucher bref rejoue le balayage seul (jamais suivi ni glisser), un glisser fait défiler la page (L4-C4)", async ({ browser }) => {
  test.setTimeout(90_000);
  const context = await browser.newContext({ reducedMotion: "no-preference", viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await openHome(page);
  const title = page.locator(TITLE);
  await title.scrollIntoViewIfNeeded();
  await waitForArrival(page);
  await page.evaluate((selector) => {
    const node = document.querySelector<HTMLElement>(selector)!;
    const states: string[] = [];
    (window as unknown as { __states: string[] }).__states = states;
    new MutationObserver(() => states.push(node.dataset.techState ?? "")).observe(node, { attributes: true, attributeFilter: ["data-tech-state"] });
  }, TITLE);
  const before = Number((await title.getAttribute("data-accent-replays")) ?? 0);
  // A tap on the accented word: the sweep, then rest.
  const word = (await page.locator(`${TITLE} [data-accent]`).boundingBox())!;
  await page.touchscreen.tap(word.x + word.width / 2, word.y + word.height / 2);
  await expect(title).toHaveAttribute("data-tech-state", "sweep", { timeout: 1_000 });
  await expect.poll(async () => Number((await title.getAttribute("data-accent-replays")) ?? 0)).toBe(before + 1);
  await waitForIdle(page);
  const states = await page.evaluate(() => (window as unknown as { __states: string[] }).__states);
  expect(states.filter((state) => state === "follow" || state === "drag"), "never follow nor drag under a finger").toEqual([]);
  expect((await canvasInk(page)).inked).toBe(0);

  // A vertical drag of 200 px started on a word: the page scrolls, nothing replays.
  await page.waitForTimeout(900);
  const first = (await page.locator(`${TITLE} [data-title-word]`).first().boundingBox())!;
  const x = first.x + first.width / 2;
  const y = Math.min(first.y + first.height / 2, 800);
  const scrollBefore = await page.evaluate(() => window.scrollY);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let step = 1; step <= 10; step++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y - step * 20 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.scrollY) - scrollBefore, "the page scrolled").toBeGreaterThan(50);
  expect(Number((await title.getAttribute("data-accent-replays")) ?? 0)).toBe(before + 1);
  // The title never blocks the scroll.
  expect(await title.evaluate((node) => getComputedStyle(node).touchAction)).toBe("auto");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await context.close();
});

test("mouvement réduit : le mot en HTML, aucun canvas, aucun rejeu (cas d'erreur : rien ne dépend de l'effet)", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openHome(page);
  const title = page.locator(TITLE);
  await title.scrollIntoViewIfNeeded();
  await expect(title.locator("canvas")).toHaveCount(0);
  await expect(title.locator("[data-letter]")).toHaveText(["d", "é", "c", "i", "d", "e"]);
  const box = (await title.boundingBox())!;
  const start = await firstWord(page);
  await page.mouse.move(start.x, start.y);
  await page.mouse.move(box.x + box.width - 20, box.y + box.height - 20, { steps: 5 });
  await page.waitForTimeout(200);
  await expect(title).not.toHaveAttribute("data-accent-replays");
  await expect(title).toHaveAttribute("data-tech-state", "idle");
  await expect(page.getByRole("heading", { level: 2, name: NAME })).toBeVisible();
});
