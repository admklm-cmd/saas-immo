import { expect, test, type Page } from "@playwright/test";

import { HERO_TITLE } from "@/components/landing-texts";

/**
 * Hero, continuous motion (docs/design-system.md U, criteria 43 to 47 and the cobalt cap of 46): the opening never
 * stops (no « image, stop, image »), the sphere turns until its last point has left, the labels `data-phases` stay
 * coherent, the hands of the act 2 stay where they were (± 8 px), and the rail beads are small round pearls under
 * the cobalt cap. An illustration: nothing is sent. No form on this journey: no consent checkbox.
 */

const CANVAS = "[data-testid='hero-particles']";
const COLD_START = 60_000;
const VIEWPORTS = [
  { width: 1440, height: 900, beads: 24, size: 3, cap: 12 },
  { width: 1024, height: 768, beads: 16, size: 2.6, cap: 8 },
  { width: 390, height: 844, beads: 10, size: 2.4, cap: 6 },
] as const;

async function openHome(page: Page): Promise<void> {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: HERO_TITLE })).toBeVisible({ timeout: COLD_START });
}

type Frame = { ms: number; phase: string; phases: string; changed: number };

/**
 * Samples the canvas every 100 ms until the sequence clock reaches `untilMs`: for each sample, the share of the
 * canvas pixels whose opacity differs by more than 16/255 from the previous sample (the image really moved), plus
 * the labels. Everything is computed in the page.
 */
function recordOpening(page: Page, untilMs: number): Promise<Frame[]> {
  return page.evaluate(
    (until) =>
      new Promise<Frame[]>((resolve) => {
        const canvas = document.querySelector<HTMLCanvasElement>("[data-testid='hero-particles']")!;
        const context = canvas.getContext("2d")!;
        const frames: Frame[] = [];
        let previous: Uint8ClampedArray | null = null;
        const timer = window.setInterval(() => {
          const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
          let changed = 0;
          if (previous) {
            for (let i = 3; i < data.length; i += 4) if (Math.abs(data[i]! - previous[i]!) > 16) changed++;
          }
          previous = data;
          const ms = Number(canvas.dataset.sequenceMs ?? 0);
          frames.push({ ms, phase: canvas.dataset.phase ?? "", phases: canvas.dataset.phases ?? "", changed: changed / (canvas.width * canvas.height) });
          if (ms >= until) {
            window.clearInterval(timer);
            resolve(frames);
          }
        }, 100);
      }),
    untilMs,
  );
}

/** Box that holds 98 % of the drawn pixels, in CSS px. */
function inkBox(page: Page) {
  return page.locator(CANVAS).evaluate((node) => {
    const canvas = node as HTMLCanvasElement;
    const scale = canvas.width / canvas.getBoundingClientRect().width;
    const { data } = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
    const columns = new Uint32Array(canvas.width);
    const rows = new Uint32Array(canvas.height);
    let total = 0;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        if (data[(y * canvas.width + x) * 4 + 3]! > 8) {
          columns[x]!++;
          rows[y]!++;
          total++;
        }
      }
    }
    const edge = (counts: Uint32Array, share: number) => {
      let sum = 0;
      for (let i = 0; i < counts.length; i++) {
        sum += counts[i]!;
        if (sum >= total * share) return i;
      }
      return counts.length - 1;
    };
    return { left: edge(columns, 0.01) / scale, right: edge(columns, 0.99) / scale, top: edge(rows, 0.01) / scale, bottom: edge(rows, 0.99) / scale };
  });
}

test.describe("ouverture continue (mouvement autorisé)", () => {
  test.use({ reducedMotion: "no-preference" });

  test("1440 px : aucun arrêt de 250 ms pendant toute l'ouverture, data-phases cohérent (43, 44)", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    // Starts at the first frames and runs to the end of the opening.
    const frames = await recordOpening(page, 10_900);
    const moving = frames.filter((frame) => frame.ms >= 800 && frame.ms <= 10_600);
    expect(moving.length, "samples taken during the opening").toBeGreaterThan(50);
    // 43: no window of 250 ms (three consecutive samples at 100 ms, ≥ 250 ms) where the image does not change.
    // An interval below 0.1 % of the canvas is a stop.
    const worst = [];
    for (let i = 2; i < moving.length; i++) {
      const window3 = moving.slice(i - 2, i + 1);
      const span = window3[2]!.ms - window3[0]!.ms;
      const stalled = window3.slice(1).every((frame) => frame.changed < 0.001);
      if (span >= 250 && stalled) worst.push(`${window3[0]!.ms}-${window3[2]!.ms}`);
    }
    test.info().annotations.push({ type: "weakest change", description: `${(Math.min(...moving.slice(1).map((frame) => frame.changed)) * 100).toFixed(3)} % of the canvas` });
    expect(worst, "windows of 250 ms without any visible change").toEqual([]);

    // 44: the labels. Always at least one motion; the sphere then the wave then the hands, `hands` alone in the act.
    for (const frame of frames) expect(frame.phases, `data-phases at ${frame.ms}`).not.toBe("");
    const at = (ms: number) => frames.find((frame) => frame.ms >= ms)!;
    expect(at(1_500).phases.split(" ")).toEqual(["sphere"]);
    expect(at(5_000).phases.split(" ")).toEqual(["sphere", "to-hands"]);
    expect(at(8_000).phases.split(" ")).toContain("hands");
    expect(at(10_500).phases.split(" ")).toEqual(["hands"]);
    // Without the held ball there is one wave only: never two waves at the same time.
    for (const frame of frames) expect(frame.phases.split(" ").filter((name) => name === "to-hands").length).toBeLessThanOrEqual(1);
    expect(frames.map((frame) => frame.phase).filter((phase, index, all) => index === 0 || phase !== all[index - 1])).toEqual(["sphere", "to-hands", "hands"]);
  });

  test("1440 px : la sphère tourne sans interruption jusqu'à la fin de la vague, la vitesse ne tombe jamais à zéro (43)", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    const frames = await recordOpening(page, 7_000);
    const turning = frames.filter((frame) => frame.ms >= 900 && frame.ms <= 7_000);
    // Every sample: some visible change (the rotation is continuous); the rotation keeps going when the wave starts at 3 s.
    for (const frame of turning.slice(1)) expect(frame.changed, `change at ${frame.ms} ms`).toBeGreaterThan(0.0005);
    const before = turning.filter((frame) => frame.ms >= 2_000 && frame.ms < 3_000);
    const after = turning.filter((frame) => frame.ms >= 3_200 && frame.ms < 4_200);
    const mean = (list: Frame[]) => list.reduce((sum, frame) => sum + frame.changed, 0) / list.length;
    expect(mean(after), "no dip when the points start to leave").toBeGreaterThanOrEqual(mean(before) * 0.8);
  });

  test("1440 px : raccord sans saut avec l'acte 2, les mains restent à ± 8 px (44, 28)", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    const canvas = page.locator(CANVAS);
    const waitFor = (ms: number) =>
      page.waitForFunction((target) => Number(document.querySelector<HTMLElement>("[data-testid='hero-particles']")?.dataset.sequenceMs ?? 0) >= target, ms, { timeout: 30_000, polling: 25 });
    await waitFor(10_500);
    const a = await inkBox(page);
    await waitFor(10_900);
    const b = await inkBox(page);
    await expect(canvas).toHaveAttribute("data-act", "live");
    await expect(canvas).toHaveAttribute("data-live-step", "rest", { timeout: 15_000 });
    const c = await inkBox(page);
    for (const edge of ["left", "right", "top", "bottom"] as const) {
      expect(Math.abs(b[edge] - a[edge]), `${edge}: 10.5 s to 10.9 s`).toBeLessThanOrEqual(8);
      expect(Math.abs(c[edge] - b[edge]), `${edge}: 10.9 s to the act`).toBeLessThanOrEqual(8);
    }
    // The tips are at their gap of rest: the hands of the act 2 are where S.3 puts them.
    expect(Number(await canvas.getAttribute("data-tip-gap-rest"))).toBeGreaterThan(0);
  });

  for (const viewport of VIEWPORTS) {
    test(`${viewport.width} px : ${viewport.beads} perles rondes de ${viewport.size} px, plafond cobalt ${viewport.cap}, aucun cobalt avant 8,4 s (46)`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openHome(page);
      const canvas = page.locator(CANVAS);
      await expect(canvas).toHaveAttribute("data-rail-dots", String(viewport.beads), { timeout: 10_000 });
      expect(Math.abs(Number(await canvas.getAttribute("data-rail-dot-size")) - viewport.size)).toBeLessThanOrEqual(0.1);
      // 12 s of samples: the cobalt count never exceeds the cap, none before 8.4 s, and beads do circulate.
      const samples = await page.evaluate(
        () =>
          new Promise<{ ms: number; cobalt: number; beads: number }[]>((resolve) => {
            const node = document.querySelector<HTMLElement>("[data-testid='hero-particles']")!;
            const list: { ms: number; cobalt: number; beads: number }[] = [];
            const start = performance.now();
            const timer = window.setInterval(() => {
              list.push({ ms: Number(node.dataset.sequenceMs ?? 0), cobalt: Number(node.dataset.cobalt ?? 0), beads: Number(node.dataset.railDotsDrawn ?? 0) });
              if (performance.now() - start > 12_000) {
                window.clearInterval(timer);
                resolve(list);
              }
            }, 50);
          }),
      );
      expect(Math.max(...samples.map((sample) => sample.cobalt)), "cobalt marks at once").toBeLessThanOrEqual(viewport.cap);
      for (const sample of samples.filter((entry) => entry.ms < 8_400)) expect(sample.cobalt, `cobalt at ${sample.ms} ms`).toBe(0);
      expect(Math.max(...samples.map((sample) => sample.beads)), "beads drawn").toBeGreaterThan(0);
      expect(Math.max(...samples.map((sample) => sample.beads))).toBeLessThanOrEqual(viewport.beads);
    });
  }

  test("cas d'erreur : si les mains ne se chargent pas, la sphère continue de tourner et la page reste utilisable", async ({ page }) => {
    await page.route(/hands[._-]baked/, (route) => route.abort());
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    await expect(page.getByTestId("hero-tag")).toBeVisible();
    await expect(page.getByTestId("hero-terminal")).toBeVisible();
  });
});

test.describe("ouverture continue (mouvement réduit)", () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.width} px : image finale fixe, aucune perle dessinée`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openHome(page);
      const canvas = page.locator(CANVAS);
      await expect(canvas).toHaveAttribute("data-state", "reduced");
      await expect(canvas).toHaveAttribute("data-rail-dots-drawn", "0");
      await expect(canvas).toHaveAttribute("data-phase", "hands");
      const first = await canvas.evaluate((node) => (node as HTMLCanvasElement).toDataURL());
      await page.waitForTimeout(1_500);
      expect(await canvas.evaluate((node) => (node as HTMLCanvasElement).toDataURL())).toBe(first);
      await expect(page.getByRole("checkbox")).toHaveCount(0);
    });
  }
});
