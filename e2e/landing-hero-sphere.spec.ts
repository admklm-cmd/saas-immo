import { expect, test, type Page } from "@playwright/test";

import { HERO_TITLE, LANDING_TEXTS } from "@/components/landing-texts";

import { contrastFailures, instrumentPage, measureContrast, rafCalls } from "./helpers/landing-network";

/**
 * New opening of the hero and prompt title (docs/design-system.md T, criteria 23 to 33 and the hero
 * part of 38): a big sphere behind the title, the hand that takes the ball, the two hands whose index
 * fingers almost touch; the title in the command-prompt face with its block cursor. Illustration:
 * fictitious example, simulation; nothing is sent. No form on this journey: no consent checkbox.
 */

const COLD_START = 60_000;
const CANVAS = "[data-testid='hero-particles']";
const VIEWPORTS = [
  { width: 1440, height: 900, sphere: 768, points: 26_000, hands: 14_000, zoneTop: 499 },
  { width: 1024, height: 768, sphere: 640, points: 15_000, hands: 9_000, zoneTop: 392 },
  { width: 390, height: 844, sphere: 350, points: 5_400, hands: 3_600, zoneTop: 540 },
] as const;

async function openHome(page: Page): Promise<void> {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: HERO_TITLE })).toBeVisible({ timeout: COLD_START });
}

/** Waits for the sequence clock of the hero (ms) to reach a value. */
async function atSequence(page: Page, ms: number): Promise<void> {
  await page.waitForFunction(
    (target) => Number(document.querySelector<HTMLElement>("[data-testid='hero-particles']")?.dataset.sequenceMs ?? 0) >= target,
    ms,
    { timeout: 30_000, polling: 25 },
  );
}

const attr = (page: Page, name: string) => page.locator(CANVAS).getAttribute(name);

/** Box that holds 98 % of the drawn pixels (CSS px), and the share of lit pixels of two images (for the rotation test). */
function drawnBox(page: Page) {
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
    const left = edge(columns, 0.01) / scale;
    const right = edge(columns, 0.99) / scale;
    const top = edge(rows, 0.01) / scale;
    const bottom = edge(rows, 0.99) / scale;
    return { left, right, top, bottom, width: right - left, height: bottom - top, total };
  });
}

test.describe("titre en invite de commandes (mouvement réduit)", () => {
  for (const viewport of [...VIEWPORTS, { width: 768, height: 1024 }] as const) {
    test(`${viewport.width} px : police, graisse, lignes, étiquette hors du titre, curseur plein (32, 33)`, async ({ page }) => {
      const fontRequests: string[] = [];
      page.on("request", (request) => {
        const host = new URL(request.url()).hostname;
        if (host.includes("fonts.googleapis.com") || host.includes("fonts.gstatic.com")) fontRequests.push(request.url());
      });
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openHome(page);
      const title = page.getByRole("heading", { level: 1, name: HERO_TITLE });
      const style = await title.evaluate((node) => {
        const computed = getComputedStyle(node);
        const lines = Array.from(node.querySelectorAll("[data-title-line]"), (line) => {
          const rect = line.getBoundingClientRect();
          return { height: rect.height, lineHeight: Number.parseFloat(getComputedStyle(line).lineHeight) };
        });
        return {
          family: computed.fontFamily,
          weight: computed.fontWeight,
          spacing: computed.letterSpacing,
          lines: lines.reduce((sum, line) => sum + Math.round(line.height / line.lineHeight), 0),
          overflow: node.scrollWidth - node.clientWidth,
          page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      expect(style.family.startsWith("Inconsolata") || style.family.includes("Consolas")).toBe(true);
      expect(style.weight).toBe("700");
      expect(style.spacing).toBe("normal");
      // Two visual lines from 40 rem of column (one per author line), four at the most on a phone.
      if (viewport.width >= 768) expect(style.lines).toBe(2);
      else expect(style.lines).toBeLessThanOrEqual(4);
      expect(style.overflow).toBeLessThanOrEqual(0);
      expect(style.page).toBeLessThanOrEqual(0);

      // The tag sits above the title: no overlap at any width.
      const tag = await page.getByTestId("hero-tag").boundingBox();
      const box = await title.boundingBox();
      expect(tag && box && tag.y + tag.height <= box.y + 1).toBe(true);
      await expect(page.getByTestId("hero-tag")).toHaveText(LANDING_TEXTS.hero.tag);

      // The accessible name is the sentence, read once; the cursor is decorative, solid and still.
      await expect(title.locator(".sr-only")).toHaveText(HERO_TITLE);
      const cursor = page.getByTestId("hero-cursor");
      await expect(cursor).toHaveAttribute("aria-hidden", "true");
      expect(await cursor.evaluate((node) => node.getAnimations().length)).toBe(0);
      await expect(cursor).toHaveCSS("opacity", "1");
      // « main » keeps its cobalt underline, under its four letters.
      const mark = await page.locator("[data-accent-mark]").first().evaluate((node) => getComputedStyle(node).backgroundColor);
      expect(mark).toMatch(/^rgb\(\s*(?:[0-9]{1,2}),\s*(?:[0-9]{1,3}),\s*(?:2[0-9]{2})\)$/);
      expect(fontRequests, "requests to the font servers at runtime").toEqual([]);
    });
  }

  test("1440 px : le fichier de la police fait 30 ko au plus, et la page ne décale pas (CLS)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const sizes: number[] = [];
    page.on("response", async (response) => {
      if (/\.woff2(\?|$)/.test(response.url())) sizes.push((await response.body().catch(() => Buffer.alloc(0))).length);
    });
    await page.addInitScript(() => {
      (window as unknown as { __cls: number }).__cls = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) {
          if (!entry.hadRecentInput) (window as unknown as { __cls: number }).__cls += entry.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    });
    await openHome(page);
    await page.waitForTimeout(1_500);
    expect(sizes.length).toBeGreaterThan(0);
    expect(Math.min(...sizes), "smallest font file").toBeLessThanOrEqual(30_000);
    expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThanOrEqual(0.02);
  });

  test("1440 px : image finale fixe, jamais la grande boule, aucun clignotement, aucune case à cocher (30)", async ({ page }) => {
    await instrumentPage(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    const canvas = page.locator(CANVAS);
    await expect(canvas).toHaveAttribute("data-phase", "hands", { timeout: 10_000 });
    await expect(canvas).toHaveAttribute("data-state", "reduced");
    expect(Number(await attr(page, "data-points"))).toBeLessThanOrEqual(14_000);
    expect(Number(await attr(page, "data-skin"))).toBe(0);
    const before = await rafCalls(page);
    const first = await canvas.evaluate((node) => (node as HTMLCanvasElement).toDataURL());
    await page.waitForTimeout(3_000);
    expect(await canvas.evaluate((node) => (node as HTMLCanvasElement).toDataURL())).toBe(first);
    expect(await rafCalls(page)).toBe(before);
    // Nothing moves in the page field either, and the journey has no form: nothing is pre-checked.
    await page.getByTestId("page-dust").evaluate((node) => node.scrollIntoView());
    await page.evaluate(() => window.scrollTo(0, 1_400));
    const field = () => page.getByTestId("page-dust").evaluate((node) => (node as HTMLCanvasElement).toDataURL());
    const still = await field();
    await page.waitForTimeout(3_000);
    expect(await field()).toBe(still);
    await expect(page.getByTestId("page-dust")).toHaveAttribute("data-loop-state", "paused");
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await expect(page.getByTestId("landing-pause")).toHaveCount(0);
  });

  test("cas d'erreur : si les mains ne se chargent pas, la page reste complète et utilisable", async ({ page }) => {
    await page.route(/hands[._-]baked/, (route) => route.abort());
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    await expect(page.getByRole("link", { name: LANDING_TEXTS.actions.estimation }).first()).toBeVisible();
    await expect(page.getByTestId("hero-tag")).toBeVisible();
    await expect(page.getByTestId("hero-cursor")).toBeVisible();
  });
});

test.describe("ouverture : grande boule, main qui prend la boule, raccord (mouvement autorisé)", () => {
  test.use({ reducedMotion: "no-preference" });

  for (const viewport of VIEWPORTS) {
    test(`${viewport.width} px : boule entière et immense, qui tourne, ${viewport.points} points (24, 25, 26)`, async ({ page }) => {
      test.setTimeout(60_000);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openHome(page);
      await atSequence(page, 1_500);
      const first = await drawnBox(page);
      await atSequence(page, 2_500);
      expect(await attr(page, "data-phase")).toBe("sphere");
      const second = await drawnBox(page);
      expect(second.width, "diameter of the sphere").toBeGreaterThanOrEqual(viewport.sphere);
      // Whole in the window: nothing cut at the sides, nor below the fold, at scroll 0.
      expect(second.left).toBeGreaterThanOrEqual(0);
      expect(second.right).toBeLessThanOrEqual(viewport.width);
      const stage = await page.getByTestId("hero-stage").boundingBox();
      expect(second.bottom + (stage?.y ?? 0)).toBeLessThanOrEqual(viewport.height + 2);
      // It turns: the box stays within 3 %, the pixels change.
      expect(Math.abs(second.width - first.width) / second.width).toBeLessThan(0.03);
      const lit = Number(await attr(page, "data-points"));
      expect(lit).toBeGreaterThanOrEqual(viewport.hands);
      expect(lit).toBeLessThanOrEqual(viewport.points);
      // The big sphere has quiet zones in front of the texts.
      expect(Number(await attr(page, "data-quiet"))).toBeGreaterThanOrEqual(2);
      if (viewport.width >= 1024) {
        const h1 = await page.getByRole("heading", { level: 1, name: HERO_TITLE }).boundingBox();
        const buttons = await page.getByTestId("hero-band").getByRole("link", { name: LANDING_TEXTS.actions.estimation }).boundingBox();
        const cx = (second.left + second.right) / 2;
        const cy = (stage?.y ?? 0) + (second.top + second.bottom) / 2;
        const radius = second.width / 2;
        for (const target of [h1, buttons]) {
          expect(Math.hypot(target!.x + target!.width / 2 - cx, target!.y + target!.height / 2 - cy), "centre of the text in the disc").toBeLessThan(radius);
        }
      }
    });
  }

  test("1440 px : la boule tourne vraiment (deux images à 1 s d'écart diffèrent d'au moins 2 %)", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    await atSequence(page, 1_500);
    const read = () =>
      page.locator(CANVAS).evaluate((node) => {
        const canvas = node as HTMLCanvasElement;
        return Array.from(canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data.filter((_, i) => i % 4 === 3));
      });
    const a = await read();
    await atSequence(page, 2_500);
    const b = await read();
    let lit = 0;
    let changed = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i]! > 8 || b[i]! > 8) lit++;
      if (Math.abs(a[i]! - b[i]!) > 16) changed++;
    }
    expect(changed / lit).toBeGreaterThanOrEqual(0.02);
  });

  test("1440 px : phases dans l'ordre aux bornes 3,8 / 6,6 / 8,2 / 10,6 s, jamais de nuage ni de pomme, peau éteinte à 6,6 s (23, 26, 27, 28)", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      const log: { phase: string; ms: number }[] = [];
      (window as unknown as { __phases: typeof log }).__phases = log;
      document.addEventListener("DOMContentLoaded", () => {
        const canvas = document.querySelector<HTMLElement>("[data-testid='hero-particles']")!;
        const note = () => {
          if (log.at(-1)?.phase !== canvas.dataset.phase) log.push({ phase: canvas.dataset.phase!, ms: Number(canvas.dataset.sequenceMs ?? 0) });
        };
        new MutationObserver(note).observe(canvas, { attributes: true, attributeFilter: ["data-phase"] });
        note();
      });
    });
    await openHome(page);
    await expect(page.locator(CANVAS)).toHaveAttribute("data-phase", "to-hand", { timeout: 20_000 });
    await expect(page.locator(CANVAS)).toHaveAttribute("data-phase", "hand", { timeout: 20_000 });
    expect(Number(await attr(page, "data-skin")), "skin points after 6.6 s").toBe(0);
    // The hand holds the ball: a disc of 75 to 115 px, the right-half points in it.
    await atSequence(page, 7_400);
    const [, , radius, part] = (await attr(page, "data-ball"))!.split(",").map(Number);
    expect(radius).toBeGreaterThanOrEqual(75);
    expect(radius).toBeLessThanOrEqual(115);
    expect(part).toBeGreaterThanOrEqual(0.85);
    await expect(page.locator(CANVAS)).toHaveAttribute("data-phase", "hands", { timeout: 20_000 });
    const log = await page.evaluate(() => (window as unknown as { __phases: { phase: string; ms: number }[] }).__phases);
    expect(log.map((entry) => entry.phase)).toEqual(["sphere", "to-hand", "hand", "to-hands", "hands"]);
    // The act 2 is the unchanged one: the cobalt contact point, the tips at their gap of rest.
    await atSequence(page, 10_900);
    const gap = Number(await attr(page, "data-tip-gap-rest"));
    expect(gap).toBeGreaterThan(0);
    expect(Number(await attr(page, "data-points"))).toBe(VIEWPORTS[0].hands);
    expect(Number(await attr(page, "data-quiet")), "no quiet zone on the hands").toBe(0);
  });

  for (const viewport of VIEWPORTS) {
    test(`${viewport.width} px : la zone des mains reste à ± 8 px de sa place du 13/10 (28)`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openHome(page);
      const zone = await page.locator("[data-nano-stage]").boundingBox();
      expect(Math.abs(zone!.y + (await page.evaluate(() => window.scrollY)) - viewport.zoneTop)).toBeLessThanOrEqual(8);
    });
  }

  test("1440 et 390 px : contraste du titre, du sous-titre, de l'étiquette et des boutons pendant toute l'ouverture (29)", async ({ page }) => {
    test.setTimeout(120_000);
    const report: string[] = [];
    for (const viewport of [VIEWPORTS[0], VIEWPORTS[2]]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openHome(page);
      for (const ms of [500, 2_500, 5_000, 7_500, 9_500, 10_900]) {
        await atSequence(page, ms);
        const results = await measureContrast(page);
        report.push(...contrastFailures(results).map((failure) => `${viewport.width} +${ms}: ${failure}`));
        for (const line of results.filter((entry) => entry.role === "title-ink")) {
          if (line.darkest < 7) report.push(`${viewport.width} +${ms}: titre ${line.darkest.toFixed(2)}`);
        }
      }
    }
    expect(report).toEqual([]);
  });

  test("1440 px : la pause du terminal gèle le hero ET le champ de la page, « Reprendre » les relance, le rejeu repart de la boule (31)", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    await expect(page.locator(CANVAS)).toHaveAttribute("data-phase", "hands", { timeout: 20_000 });
    const terminalPause = page.getByTestId("hero-motion-pause");
    await terminalPause.click();
    await expect(page.locator(CANVAS)).toHaveAttribute("data-state", "stopped");
    const heroImage = () => page.locator(CANVAS).evaluate((node) => (node as HTMLCanvasElement).toDataURL());
    const frozen = await heroImage();
    await page.waitForTimeout(1_000);
    expect(await heroImage()).toBe(frozen);
    // The pause is shared: below the hero, the field of the page stays frozen too.
    await page.evaluate(() => window.scrollTo(0, 1_900));
    await expect(page.getByTestId("page-dust")).toHaveAttribute("data-loop-state", "paused");
    const field = () => page.getByTestId("page-dust").evaluate((node) => (node as HTMLCanvasElement).toDataURL());
    const fieldFrozen = await field();
    await page.waitForTimeout(1_000);
    expect(await field()).toBe(fieldFrozen);
    // The fixed button resumes both.
    const fixed = page.getByTestId("landing-pause");
    await expect(fixed).toContainText("Reprendre");
    await fixed.click();
    await expect(page.getByTestId("page-dust")).toHaveAttribute("data-loop-state", "playing");
    await page.waitForTimeout(1_200);
    expect(await field()).not.toBe(fieldFrozen);
    // The replay starts the opening again from the big sphere.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByTestId("landing-replay").click();
    await expect(page.locator(CANVAS)).toHaveAttribute("data-phase", "sphere");
    expect(Number(await attr(page, "data-sequence-ms"))).toBeLessThan(1_500);
  });

  test("1440 px : le curseur clignote quatre fois (4,2 s) puis reste plein, et « Rejouer » le réarme (33)", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    const cursor = page.getByTestId("hero-cursor");
    const timing = await cursor.evaluate((node) => {
      const animation = node.getAnimations()[0]!;
      const t = animation.effect!.getComputedTiming();
      return { iterations: t.iterations, duration: t.duration, delay: t.delay };
    });
    expect(timing).toEqual({ iterations: 4, duration: 1060, delay: 900 });
    await page.waitForTimeout(5_600);
    expect(await cursor.evaluate((node) => node.getAnimations().length)).toBe(0);
    await expect(cursor).toHaveCSS("opacity", "1");
    await page.getByTestId("landing-replay").click();
    expect(await cursor.evaluate((node) => node.getAnimations().length)).toBeGreaterThan(0);
  });

  test("390 px : la grande boule, la main et le raccord ne débordent pas, ni ne bloquent les boutons", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openHome(page);
    await atSequence(page, 2_500);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await expect(page.getByRole("link", { name: LANDING_TEXTS.actions.estimation }).first()).toBeVisible();
    await page.getByRole("link", { name: LANDING_TEXTS.actions.estimation }).first().click();
    await expect(page).toHaveURL(/\/estimation/);
  });
});
