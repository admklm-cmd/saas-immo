import { expect, test, type Page } from "@playwright/test";

import { HERO_TITLE, LANDING_TEXTS } from "@/components/landing-texts";

import { contrastFailures, instrumentPage, measureContrast, rafCalls } from "./helpers/landing-network";

/**
 * Hero, second animation « les index qui veulent se toucher » and the raised composition
 * (docs/design-system.md §2.11.4 ter S, criteria 15 to 22, and T criterion 24). The opening (big sphere, held ball, hands) is
 * played once; then the two index fingers reach towards each other, almost touch, withdraw and rest,
 * in a cycle of 7.2 s that never stops. An illustration: nothing is sent, nothing is read from the
 * database. No form on this journey: no consent checkbox to check.
 */

const CANVAS = "[data-testid='hero-particles']";
const TERMINAL = LANDING_TEXTS.hero.terminal;
const SHOTS = "test-results/hero-morph";
const VIEWPORTS = [
  { width: 1440, height: 900, name: "1440", reach: 20, robots: 12, robotSize: 9 },
  { width: 1024, height: 768, name: "1024", reach: 10, robots: 8, robotSize: 8 },
  { width: 390, height: 844, name: "390", reach: 5, robots: 6, robotSize: 7 },
] as const;

type Sample = { at: number; phase: string; act: string; step: string; cycle: number; gap: number; robots: number; cobalt: number; sequence: number; frameStep: number };

async function openHome(page: Page): Promise<void> {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: HERO_TITLE })).toBeVisible({ timeout: 60_000 });
}

const canvasPixels = (page: Page) => page.locator(CANVAS).evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL());

/**
 * Samples the attributes of the canvas every 50 ms for `ms`, and the interval between animation
 * frames; returns both. Everything is read in the page (no network, no image library).
 */
async function record(page: Page, ms: number): Promise<{ samples: Sample[]; intervals: number[] }> {
  return page.evaluate(
    (duration) =>
      new Promise<{ samples: Sample[]; intervals: number[] }>((resolve) => {
        const canvas = document.querySelector<HTMLElement>("[data-testid='hero-particles']")!;
        const samples: Sample[] = [];
        const intervals: number[] = [];
        const start = performance.now();
        let last = 0;
        const read = (): Sample => ({
          at: performance.now() - start,
          phase: canvas.dataset.phase ?? "",
          act: canvas.dataset.act ?? "",
          step: canvas.dataset.liveStep ?? "",
          cycle: Number(canvas.dataset.liveCycle ?? 0),
          gap: Number(canvas.dataset.tipGap ?? 0),
          robots: Number(canvas.dataset.robots ?? 0),
          cobalt: Number(canvas.dataset.cobalt ?? 0),
          sequence: Number(canvas.dataset.sequenceMs ?? 0),
          frameStep: Number(canvas.dataset.liveFrameStep ?? 1),
        });
        const frame = (now: number) => {
          if (last) intervals.push(now - last);
          last = now;
          samples.push(read());
          if (now - start < duration) requestAnimationFrame(frame);
          else resolve({ samples, intervals });
        };
        requestAnimationFrame(frame);
      }),
    ms,
  );
}

function percentile(values: readonly number[], share: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))]!;
}

/** Bounding box (viewport px) of the drawn points: the 1 % of the outermost ink on each side is ignored. */
function inkBox(page: Page) {
  return page.locator(CANVAS).evaluate((node) => {
    const canvas = node as HTMLCanvasElement;
    const { data, width, height } = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
    const rows = new Float64Array(height);
    const columns = new Float64Array(width);
    let total = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3]! > 20) {
          rows[y]! += 1;
          columns[x]! += 1;
          total += 1;
        }
      }
    }
    const trim = (counts: Float64Array) => {
      let low = 0;
      let seen = 0;
      while (low < counts.length && seen + counts[low]! < total * 0.01) seen += counts[low++]!;
      let high = counts.length - 1;
      seen = 0;
      while (high > 0 && seen + counts[high]! < total * 0.01) seen += counts[high--]!;
      return [low, high] as const;
    };
    const [top, bottom] = trim(rows);
    const [left, right] = trim(columns);
    const box = canvas.getBoundingClientRect();
    const scale = canvas.width / box.width;
    return { top: box.top + top / scale, bottom: box.top + (bottom + 1) / scale, left: box.left + left / scale, right: box.left + (right + 1) / scale };
  });
}

/** Number of separate cobalt marks in the canvas (connected pixels), the contact square counting for one. */
function cobaltMarks(page: Page) {
  return page.locator(CANVAS).evaluate((node) => {
    const canvas = node as HTMLCanvasElement;
    const { data, width, height } = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
    const isCobalt = (index: number) => data[index * 4 + 3]! > 90 && data[index * 4 + 2]! > 150 && data[index * 4]! < 120 && data[index * 4 + 1]! < 150;
    const seen = new Uint8Array(width * height);
    let marks = 0;
    for (let start = 0; start < width * height; start++) {
      if (seen[start] || !isCobalt(start)) continue;
      marks++;
      const stack = [start];
      seen[start] = 1;
      while (stack.length) {
        const at = stack.pop()!;
        const x = at % width;
        for (const next of [at - 1, at + 1, at - width, at + width]) {
          if (next < 0 || next >= width * height || seen[next] || !isCobalt(next)) continue;
          if (Math.abs((next % width) - x) > 1) continue;
          seen[next] = 1;
          stack.push(next);
        }
      }
    }
    return marks;
  });
}

test.describe("grande boule et boule tenue, entières dans la fenêtre (critère 24)", () => {
  test.use({ reducedMotion: "no-preference" });

  for (const viewport of VIEWPORTS.slice(0, 2)) {
    test(`${viewport.width} x ${viewport.height} : la grande boule est entière dans la fenêtre, la boule tenue sous les boutons, sans défiler`, async ({ page }) => {
      test.setTimeout(60_000);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openHome(page);
      const canvas = page.locator(CANVAS);
      const buttons = await page.getByTestId("hero-band").getByRole("link", { name: LANDING_TEXTS.actions.signIn }).boundingBox();
      for (const phase of ["sphere", "hand"] as const) {
        await expect(canvas).toHaveAttribute("data-phase", phase, { timeout: 30_000 });
        // In the steady phase, once the solid has reached its place.
        await page.waitForTimeout(700);
        const box = await inkBox(page);
        expect(await page.evaluate(() => window.scrollY), "no scrolling is needed").toBe(0);
        expect(box.left, `${phase}: nothing cut on the left`).toBeGreaterThanOrEqual(0);
        expect(box.right, `${phase}: nothing cut on the right`).toBeLessThanOrEqual(viewport.width);
        if (phase === "sphere") {
          // The big sphere goes behind the title and the buttons: only the window limits it.
          expect(box.bottom, "sphere: bottom of the drawing inside the window").toBeLessThanOrEqual(viewport.height + 2);
        } else {
          expect(box.top, `hand: top of the drawing under the buttons (${buttons!.y + buttons!.height})`).toBeGreaterThanOrEqual(buttons!.y + buttons!.height + 4);
          expect(box.bottom, "hand: bottom of the drawing inside the window").toBeLessThanOrEqual(viewport.height - 8);
        }
        await page.screenshot({ path: `${SHOTS}/${phase === "sphere" ? "grande-boule" : "main-boule"}-${viewport.name}.png` });
      }
    });
  }
});

test.describe("seconde animation (mouvement autorisé)", () => {
  test.use({ reducedMotion: "no-preference" });

  for (const viewport of VIEWPORTS) {
    test(`${viewport.width} px : acte 2 identifiable, index qui s'approchent sans se toucher, robots visibles, deux marques cobalt au plus, budget tenu (critères 15 à 18, 20, 21)`, async ({ page }) => {
      test.setTimeout(120_000);
      await instrumentPage(page);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const session = await page.context().newCDPSession(page);
      // The phone is measured with the processor slowed ×4 (docs/design-system.md §2.11.4 ter G).
      if (viewport.width < 768) await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await openHome(page);
      const canvas = page.locator(CANVAS);
      await expect(canvas).toHaveAttribute("data-act", "intro");
      await expect(canvas).toHaveAttribute("data-act", "live", { timeout: 40_000 });
      const sequence = Number(await canvas.getAttribute("data-sequence-ms"));
      expect(sequence, "the act begins at the end of the opening (10 600 ms ± 150, then the clock stops at 10 900)").toBeGreaterThanOrEqual(10_450);
      const rest = Number(await canvas.getAttribute("data-tip-gap-rest"));
      const near = Number(await canvas.getAttribute("data-tip-gap-near"));
      expect(near, "nearest gap: 1 % of the width of the hands, never under 3 px").toBeGreaterThanOrEqual(3);
      expect(rest - near, `the gap closes by at least ${viewport.reach} px`).toBeGreaterThanOrEqual(viewport.reach);

      // 24 s: three full cycles (the act of one phase lasts 7.2 s).
      const { samples, intervals } = await record(page, 24_000);
      test.info().annotations.push({ type: `gap ${viewport.name}`, description: `rest ${rest} px, nearest ${near} px` });

      // 15: the steps come in order, then the number of the cycle grows; 18: nothing goes back.
      const steps = samples.map((sample) => sample.step).filter((step, index, all) => index === 0 || step !== all[index - 1]);
      const order = ["approach", "contact", "retreat", "rest"];
      const first = steps.indexOf("approach");
      expect(first, "the approach is seen").toBeGreaterThanOrEqual(0);
      const wanted = [...order, ...order, ...order].slice(order.indexOf(steps[0]!));
      expect(steps.slice(0, 9)).toEqual(wanted.slice(0, Math.min(9, steps.length)));
      expect(samples.at(-1)!.cycle, "the number of the cycle grows").toBeGreaterThanOrEqual(2);
      expect(samples.every((sample) => sample.phase === "hands" && sample.act === "live"), "after the hands, the phase and the act never change").toBe(true);
      // The cycle: 7.2 s between two increments of the cycle number.
      const starts = samples.filter((sample, index) => index > 0 && sample.cycle !== samples[index - 1]!.cycle).map((sample) => sample.at);
      expect(starts.length).toBeGreaterThanOrEqual(2);
      expect(Math.abs((starts[1]! - starts[0]!) / 1000 - 7.2), "cycle 7.2 s ± 0.2").toBeLessThanOrEqual(0.25);

      // 16: the gap, measured in CSS px.
      const gaps = (step: string) => samples.filter((sample) => sample.step === step && sample.gap > 0).map((sample) => sample.gap);
      const atRest = gaps("rest").slice(Math.floor(gaps("rest").length / 2));
      const atContact = gaps("contact");
      expect(atRest.length).toBeGreaterThan(0);
      expect(atContact.length).toBeGreaterThan(0);
      for (const value of atRest) expect(Math.abs(value - rest), "rest gap").toBeLessThanOrEqual(4);
      for (const value of atContact) {
        expect(Math.abs(value - near), "contact gap").toBeLessThanOrEqual(3);
        expect(value, "the fingers never touch").toBeGreaterThanOrEqual(3);
      }
      expect(Math.min(...samples.map((sample) => sample.gap).filter((gap) => gap > 0)), "never below 3 px").toBeGreaterThanOrEqual(3);
      expect(Math.max(...atRest) - Math.min(...atContact), `gap varies by at least ${viewport.reach} px`).toBeGreaterThanOrEqual(viewport.reach);

      // 17: robots drawn (the median over the whole act, a robot being invisible for a moment while it changes rail).
      const robots = samples.map((sample) => sample.robots);
      expect(percentile(robots, 0.5), `${viewport.robots} robots drawn at least (median)`).toBeGreaterThanOrEqual(viewport.robots);
      test.info().annotations.push({ type: `robots ${viewport.name}`, description: `median ${percentile(robots, 0.5)}, min ${Math.min(...robots)}, max ${Math.max(...robots)}, size ${viewport.robotSize} px` });

      // 20: at most two cobalt marks at once (the contact point and one of port, bit, ring).
      expect(Math.max(...samples.map((sample) => sample.cobalt)), "cobalt marks drawn at once").toBeLessThanOrEqual(2);
      expect(Math.max(...samples.map((sample) => sample.cobalt))).toBeGreaterThanOrEqual(1);
      expect(await cobaltMarks(page), "separate cobalt blobs in the pixels").toBeLessThanOrEqual(2);

      // 21: budget. p95 of the interval between frames; at 1440 the work stays at 60 frames/s.
      const p95 = percentile(intervals.slice(5), 0.95);
      const frameMs = Number(await canvas.getAttribute("data-frame-ms"));
      const step = samples.at(-1)!.frameStep;
      test.info().annotations.push({ type: `budget ${viewport.name}`, description: `p95 ${p95.toFixed(1)} ms, work p75 ${frameMs.toFixed(2)} ms, ${step === 1 ? "60" : "30"} images/s` });
      const limit = viewport.width >= 1280 ? 20 : 36;
      expect(p95, `p95 of the frame interval at ${viewport.width}`).toBeLessThanOrEqual(limit);
      if (viewport.width >= 1280) expect(step, "60 frames/s kept at 1440").toBe(1);
      expect(Number(await canvas.getAttribute("data-points"))).toBeLessThanOrEqual(14_000);
      const dpr = await page.evaluate(() => (document.querySelector("canvas") as HTMLCanvasElement).width / document.querySelector("canvas")!.getBoundingClientRect().width);
      expect(dpr, "pixel ratio").toBeLessThanOrEqual(1.5);
    });
  }

  test("1440 px : trois instants de l'acte 2 en image (index éloignés, presque contact, recul)", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    const canvas = page.locator(CANVAS);
    await expect(canvas).toHaveAttribute("data-act", "live", { timeout: 40_000 });
    for (const [step, name] of [
      ["rest", "mains-eloignes"],
      ["contact", "mains-presque-contact"],
      ["retreat", "mains-recul"],
    ] as const) {
      await expect(canvas).toHaveAttribute("data-live-step", step, { timeout: 10_000 });
      await page.screenshot({ path: `${SHOTS}/${name}-1440.png` });
    }
  });

  test("1024 et 390 px : les mains à l'instant du presque contact, en image", async ({ page }) => {
    test.setTimeout(90_000);
    for (const viewport of VIEWPORTS.slice(1)) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openHome(page);
      const canvas = page.locator(CANVAS);
      await expect(canvas).toHaveAttribute("data-act", "live", { timeout: 40_000 });
      await expect(canvas).toHaveAttribute("data-live-step", "rest", { timeout: 10_000 });
      await page.screenshot({ path: `${SHOTS}/mains-eloignes-${viewport.name}.png` });
      await expect(canvas).toHaveAttribute("data-live-step", "contact", { timeout: 10_000 });
      await page.screenshot({ path: `${SHOTS}/mains-presque-contact-${viewport.name}.png` });
    }
  });

  test("390 px : la grande boule et la boule tenue, entières, en image (critère 24)", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await openHome(page);
    const canvas = page.locator(CANVAS);
    const box = await page.getByTestId("hero-band").getByRole("link", { name: LANDING_TEXTS.actions.signIn }).boundingBox();
    for (const phase of ["sphere", "hand"] as const) {
      await expect(canvas).toHaveAttribute("data-phase", phase, { timeout: 30_000 });
      await page.waitForTimeout(700);
      const ink = await inkBox(page);
      if (phase === "hand") expect(ink.top, "under the buttons").toBeGreaterThanOrEqual(box!.y + box!.height + 4);
      expect(ink.bottom, "inside the window").toBeLessThanOrEqual(844 - 8 + (phase === "sphere" ? 10 : 0));
      expect(ink.left).toBeGreaterThanOrEqual(0);
      expect(ink.right).toBeLessThanOrEqual(390);
      await page.screenshot({ path: `${SHOTS}/${phase === "sphere" ? "grande-boule" : "main-boule"}-390.png` });
    }
  });

  test("pause : l'acte 2 est gelé à l'image de repos, identique au pixel près ; « reprendre » repart du début du cycle (critère 19, S.9)", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    const canvas = page.locator(CANVAS);
    await expect(canvas).toHaveAttribute("data-live-step", "contact", { timeout: 40_000 });
    await page.getByRole("button", { name: TERMINAL.pause.pauseName }).click();
    await expect(canvas).toHaveAttribute("data-state", "stopped");
    await expect(canvas).toHaveAttribute("data-live-step", "rest");
    const frozen = await canvasPixels(page);
    await page.waitForTimeout(1_000);
    expect(await canvasPixels(page), "the same pixels 1 s later").toBe(frozen);
    expect(Number(await canvas.getAttribute("data-tip-gap")), "the gap is the rest gap").toBeCloseTo(Number(await canvas.getAttribute("data-tip-gap-rest")), 0);
    expect(await cobaltMarks(page), "only the fixed cobalt square").toBe(1);
    await page.getByRole("button", { name: TERMINAL.pause.resumeName }).click();
    await expect(canvas).toHaveAttribute("data-state", "playing");
    await expect(canvas).toHaveAttribute("data-live-step", "approach", { timeout: 4_000 });
    await expect(canvas).toHaveAttribute("data-phase", "hands");
  });

  test("hors écran : aucune image demandée ; la boucle reprend au même instant du cycle (S.9)", async ({ page }) => {
    test.setTimeout(60_000);
    await instrumentPage(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    const canvas = page.locator(CANVAS);
    await expect(canvas).toHaveAttribute("data-live-step", "retreat", { timeout: 40_000 });
    await page.locator("section[data-living-scene='probleme']").evaluate((section) => section.scrollIntoView({ behavior: "instant", block: "center" }));
    await expect(canvas).toHaveAttribute("data-state", "paused", { timeout: 1_000 });
    const step = await canvas.getAttribute("data-live-step");
    const calls = await rafCalls(page);
    await page.waitForTimeout(1_500);
    expect(await rafCalls(page), "frames requested while off screen").toBe(calls);
    expect(await canvas.getAttribute("data-live-step"), "the cycle waits where it was").toBe(step);
  });
});

test.describe("seconde animation (mouvement réduit)", () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.width} px : image de repos immobile, robots posés, aucune image demandée (critère 19, S.9)`, async ({ page }) => {
      await instrumentPage(page);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openHome(page);
      const canvas = page.locator(CANVAS);
      await expect(canvas).toHaveAttribute("data-state", "reduced");
      await expect(canvas).toHaveAttribute("data-act", "live");
      await expect(canvas).toHaveAttribute("data-live-step", "rest");
      const calls = await rafCalls(page);
      const first = await canvasPixels(page);
      await page.waitForTimeout(1_500);
      expect(await canvasPixels(page)).toBe(first);
      expect(await rafCalls(page), "requestAnimationFrame calls under reduced motion").toBe(calls);
      expect(Number(await canvas.getAttribute("data-tip-gap"))).toBeCloseTo(Number(await canvas.getAttribute("data-tip-gap-rest")), 0);
      expect(await canvas.getAttribute("data-robots")).toBe("4");
      expect(await cobaltMarks(page)).toBe(1);
      await page.screenshot({ path: `${SHOTS}/mouvement-reduit-${viewport.name}.png` });
    });
  }
});

test.describe("lisibilité du texte pendant l'acte 2 (critère 22)", () => {
  test.use({ reducedMotion: "no-preference" });

  test("contraste ≥ 4,5:1 sous le titre, le sous-titre et les boutons au presque contact et au repos (1440, 1024, 390)", async ({ page }) => {
    test.setTimeout(180_000);
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openHome(page);
      const canvas = page.locator(CANVAS);
      await expect(canvas).toHaveAttribute("data-act", "live", { timeout: 40_000 });
      for (const step of ["contact", "rest"]) {
        await expect(canvas).toHaveAttribute("data-live-step", step, { timeout: 12_000 });
        expect(contrastFailures(await measureContrast(page)), `${viewport.width} ${step}`).toEqual([]);
      }
    }
  });
});
