import { expect, test, type Page } from "@playwright/test";

import { HERO_TITLE, LANDING_TEXTS } from "@/components/landing-texts";
import { APP_TEXTS } from "@/components/texts";

import { instrumentPage } from "./helpers/landing-network";

/**
 * Section « Le contrôle reste humain » (docs/design-system.md §2.11.8.7 L3-C,
 * L3-D, criteria L3-C1 and L3-D1 to L3-D6): a centred title, then two tiles —
 * the chart (who decides) and the timeline of a fictitious dossier (when). The
 * six guard rails stay written in the legends, with no JavaScript and under
 * reduced motion. The timeline plays ONCE: no `data-loop`, no
 * requestAnimationFrame, « 1er contact » validated only once the « Vous »
 * cursor is on it, the mandate always waiting for a human.
 *
 * No form on this journey: no consent checkbox to check.
 */

const COLD_START = 60_000;
const TEXTS = LANDING_TEXTS.control;
const SECTION = "section[data-living-scene='controle']";

async function openHome(page: Page): Promise<void> {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: HERO_TITLE })).toBeVisible({ timeout: COLD_START });
}

async function showGrid(page: Page): Promise<void> {
  await page.getByTestId("control-grid").evaluate((node) => node.scrollIntoView({ block: "center", behavior: "instant" }));
}

/**
 * Counts the requestAnimationFrame calls that do NOT come from the network
 * background: scrolling makes the network follow the scroll (its own frames,
 * tested by `landing-reseau` and `landing-sans-boucle`); the section itself
 * must add none (L3-D4). The caller is read from the stack (dev build, names kept).
 */
async function countRafOutsideNetwork(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const target = window as unknown as { __rafOther: number };
    target.__rafOther = 0;
    const previous = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback: FrameRequestCallback) => {
      if (!/LivingEngine|requestFrame/.test(new Error().stack ?? "")) target.__rafOther += 1;
      return previous(callback);
    };
  });
}

function sectionRafCalls(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __rafOther: number }).__rafOther);
}

/** The six facts as written in the two legends, in order. */
const FACT_LINES = TEXTS.facts.map((fact) => `${fact.title} — ${fact.body}`);
const BY_TILE = [
  [FACT_LINES[0], FACT_LINES[1], FACT_LINES[3]],
  [FACT_LINES[2], FACT_LINES[4], FACT_LINES[5]],
];

async function expectFacts(page: Page): Promise<void> {
  const tiles = page.getByTestId("control-tile");
  for (let index = 0; index < 2; index += 1) {
    const facts = tiles.nth(index).getByTestId("control-fact");
    await expect(facts).toHaveText(BY_TILE[index]!.map((line) => line!));
    for (let line = 0; line < 3; line += 1) await expect(facts.nth(line)).toBeVisible();
  }
}

/** The final state of the timeline (server HTML, reduced motion, end of the play). */
async function expectFinalTimeline(page: Page): Promise<void> {
  const timeline = page.getByTestId("control-timeline");
  await expect(timeline).toHaveAttribute("data-visual-state", "done");
  await expect(timeline.locator("[data-block]")).toHaveCount(11);
  await expect(timeline.locator("[data-block][data-shown='true']")).toHaveCount(11);
  await expect(timeline.locator("[data-block='firstContact']")).toHaveAttribute("data-decision", "validated");
  await expect(timeline.locator("[data-block='mandate']")).toHaveAttribute("data-decision", "pending");
  await expect(page.getByTestId("control-playhead")).toHaveAttribute("data-day", "8.6");
  await expect(timeline.locator("[data-testid='control-file-state'] [data-active]")).toHaveText("Mandat · à confirmer par vous");
  await expect(timeline.locator("[data-cursor='you']")).toHaveAttribute("data-target", "mandate");
}

test.describe("section contrôle — titre centré (L3-C1)", () => {
  for (const width of [1440, 1024, 390]) {
    test(`${width} px : sur-titre, lignes du titre et paragraphe centrés (± 2 px)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await openHome(page);
      const section = page.locator(SECTION);
      await section.evaluate((node) => node.scrollIntoView({ block: "start", behavior: "instant" }));
      const title = page.locator("#control-title");
      await expect(title).toHaveAttribute("data-title-align", "center");
      await expect(title).toHaveAttribute("data-accent-effect", "tech");
      const offsets = await section.evaluate((node, body) => {
        const box = node.getBoundingClientRect();
        const centre = box.left + box.width / 2;
        const middle = (rect: { left: number; right: number }) => Math.abs((rect.left + rect.right) / 2 - centre);
        const textBox = (element: Element) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          const rects = Array.from(range.getClientRects());
          return { left: Math.min(...rects.map((rect) => rect.left)), right: Math.max(...rects.map((rect) => rect.right)) };
        };
        const overline = node.querySelector("[data-testid='overline']")!.parentElement!.getBoundingClientRect();
        const lines = Array.from(node.querySelectorAll("#control-title [data-title-line]")).map((line) => middle(textBox(line)));
        const paragraph = Array.from(node.querySelectorAll("p")).find((element) => element.textContent === body)!;
        return { overline: middle(overline), lines, paragraph: middle(textBox(paragraph)) };
      }, TEXTS.body);
      expect(offsets.lines).toHaveLength(2);
      expect(offsets.overline, "overline").toBeLessThanOrEqual(2);
      for (const offset of offsets.lines) expect(offset, "title line").toBeLessThanOrEqual(2);
      expect(offsets.paragraph, "paragraph").toBeLessThanOrEqual(2);
    });
  }
});

test.describe("section contrôle — deux tuiles (L3-D1, L3-D2, L3-D6)", () => {
  for (const viewport of [
    { width: 1440, columns: 2 },
    { width: 1280, columns: 2 },
    { width: 1024, columns: 1 },
    { width: 390, columns: 1 },
    { width: 360, columns: 1 },
  ]) {
    test(`${viewport.width} px : ${viewport.columns} colonne(s), six garde-fous écrits, aucun débordement`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: 900 });
      await openHome(page);
      await showGrid(page);
      // No old card: the grid holds two tiles only.
      await expect(page.locator(`${SECTION} [data-testid='control-grid'] > li`)).toHaveCount(2);
      const tiles = page.getByTestId("control-tile");
      await expect(tiles).toHaveCount(2);
      const boxes = await tiles.evaluateAll((nodes) =>
        nodes.map((node) => {
          const article = node.querySelector("article")!;
          const box = article.getBoundingClientRect();
          return { x: Math.round(box.left), y: Math.round(box.top), w: Math.round(box.width), radius: getComputedStyle(article).borderTopLeftRadius };
        }),
      );
      const separators = await page.locator(`${SECTION} [data-testid='control-separator']`).evaluateAll(
        (nodes) => nodes.filter((node) => node.getBoundingClientRect().height > 0 && getComputedStyle(node).display !== "none").length,
      );
      if (viewport.columns === 2) {
        expect(boxes[0]!.y).toBe(boxes[1]!.y);
        expect(boxes[1]!.x).toBeGreaterThan(boxes[0]!.x);
        expect(separators, "three separators").toBe(3);
      } else {
        expect(boxes[0]!.x).toBe(boxes[1]!.x);
        expect(boxes[1]!.y).toBeGreaterThan(boxes[0]!.y);
        for (const box of boxes) expect(box.w).toBeLessThanOrEqual(720);
        expect(separators).toBe(0);
      }
      for (const box of boxes) expect(box.radius).toBe("24px");
      await expectFacts(page);
      // No scroll in the frames (overflow hidden), and every drawn piece — scene, blocks,
      // cursors and their labels, playhead — inside its frame.
      const overflow = await page.evaluate(() => {
        const visuals = Array.from(document.querySelectorAll<HTMLElement>("[data-testid='control-timeline'], [data-testid='control-team']"));
        const outside: string[] = [];
        let scrollable = 0;
        for (const visual of visuals) {
          const frame = visual.parentElement!;
          if (getComputedStyle(frame).overflowX !== "hidden") scrollable += 1;
          const box = frame.getBoundingClientRect();
          const pieces = visual.querySelectorAll<HTMLElement>("[data-block], [data-cursor] span, [data-testid='control-playhead'] span, [data-team-role], [data-testid='control-team-kill-switch'], [data-testid='control-team-you']");
          for (const piece of Array.from(pieces)) {
            const rect = piece.getBoundingClientRect();
            if (rect.width === 0 || getComputedStyle(piece).opacity === "0") continue;
            if (rect.left < box.left - 0.5 || rect.right > box.right + 0.5 || rect.top < box.top - 0.5 || rect.bottom > box.bottom + 0.5) {
              outside.push(piece.dataset.block ?? piece.dataset.teamRole ?? piece.textContent ?? piece.className);
            }
          }
        }
        return { document: document.documentElement.scrollWidth - document.documentElement.clientWidth, scrollable, outside };
      });
      expect(overflow).toEqual({ document: 0, scrollable: 0, outside: [] });
      console.log(`contrôle ${viewport.width}: tiles ${boxes.map((box) => box.w).join(" / ")} px`);
    });
  }

  test("organigramme : cinq rôles avec icônes, badge vérifié, coupe-circuit, aucune photo (L3-D3)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    await showGrid(page);
    const team = page.getByTestId("control-team");
    await expect(team).toHaveAttribute("role", "img");
    await expect(team).toHaveAttribute("aria-label", TEXTS.tiles.team.visualLabel);
    const roles = team.locator("[data-team-role]");
    await expect(roles).toHaveCount(5);
    for (let index = 0; index < 5; index += 1) await expect(roles.nth(index).locator("svg")).toHaveCount(1);
    await expect(page.getByTestId("control-team-verified")).toBeVisible();
    await expect(page.getByTestId("control-team-kill-switch")).toHaveText(TEXTS.tiles.team.killSwitch);
    await expect(page.locator(`${SECTION} img`)).toHaveCount(0);
  });

  test("frise : badge « Simulation · Exemple fictif », libellés des blocs entiers ≥ 440 px, aucun pixel rouge ni orange (L3-D6)", async ({ page }) => {
    test.setTimeout(90_000);
    for (const width of [1440, 1280, 1024, 390, 360]) {
      await page.setViewportSize({ width, height: 900 });
      await openHome(page);
      await showGrid(page);
      const label = page.getByTestId("control-fictive");
      await expect(label).toHaveCount(1);
      await expect(label).toContainText(APP_TEXTS.states.simulation);
      await expect(label).toContainText(TEXTS.tiles.timeline.fictive);
      await expect(page.getByTestId("control-tile").nth(1).getByTestId("control-fictive")).toHaveCount(1);
      const labels = await page.getByTestId("control-zone").evaluate((zone) => ({
        zone: zone.getBoundingClientRect().width,
        blocks: Array.from(zone.querySelectorAll<HTMLElement>("[data-block]")).map((block) => {
          const shown = Array.from(block.querySelectorAll<HTMLElement>("span")).filter(
            (span) => getComputedStyle(span).display !== "none" && span.textContent?.trim() && getComputedStyle(span).opacity !== "0",
          );
          const inner = block.clientWidth - 8;
          return {
            key: block.dataset.block,
            visible: shown.length > 0,
            width: Math.max(0, ...shown.map((span) => span.getBoundingClientRect().width)),
            clipped: shown.some((span) => span.getBoundingClientRect().width > inner + 0.5),
          };
        }),
      }));
      console.log(`contrôle ${width}: zone ${Math.round(labels.zone)} px; labels ${labels.blocks.map((block) => `${block.key} ${block.width.toFixed(1)}`).join(", ")}`);
      if (labels.zone >= 440) {
        expect(labels.blocks.filter((block) => !block.visible).map((block) => block.key), `${width}: labels shown`).toEqual([]);
        expect(labels.blocks.filter((block) => block.clipped).map((block) => block.key), `${width}: labels whole`).toEqual([]);
      } else {
        expect(labels.blocks.filter((block) => block.visible).map((block) => block.key), `${width}: no label`).toEqual([]);
      }
    }
    // Colour: no red, no orange pixel in the section (1440, final state).
    await page.setViewportSize({ width: 1440, height: 1200 });
    await openHome(page);
    await showGrid(page);
    const png = await page.getByTestId("control-grid").screenshot();
    const warm = await page.evaluate(async (base64) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      let count = 0;
      for (let index = 0; index < data.length; index += 4) {
        const [r, g, b] = [data[index]!, data[index + 1]!, data[index + 2]!];
        if (r > 150 && r - b > 60 && r - g > 30) count += 1;
      }
      return count;
    }, png.toString("base64"));
    expect(warm, "red or orange pixels").toBe(0);
  });
});

test.describe("section contrôle — état final immédiat", () => {
  test("mouvement réduit : frise terminée à l'instant 0, organigramme sans animation (L3-D3, L3-D5)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    await showGrid(page);
    await expectFinalTimeline(page);
    await expectFacts(page);
    const running = await page.locator(SECTION).evaluate((node) => node.getAnimations({ subtree: true }).length);
    expect(running).toBe(0);
  });

  test("sans JavaScript : garde-fous écrits et état final de la frise (L3-D2, L3-D5)", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await openHome(page);
    await expectFacts(page);
    await expectFinalTimeline(page);
    await expect(page.locator("[data-loop]")).toHaveCount(1);
    await context.close();
  });
});

test.describe("section contrôle en mouvement (L3-D3, L3-D4)", () => {
  test.use({ reducedMotion: "no-preference" });

  test("frise jouée une fois : idle → playing → done, « 1er contact » validé après l'arrivée du curseur, mandat en attente, aucune rAF", async ({ page }) => {
    test.setTimeout(90_000);
    await instrumentPage(page);
    await countRafOutsideNetwork(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      const log: { what: string; at: number; dx?: number; dy?: number }[] = [];
      (window as unknown as { __ctl: typeof log }).__ctl = log;
      const watch = () => {
        const timeline = document.querySelector<HTMLElement>("[data-testid='control-timeline']");
        if (!timeline) return void setTimeout(watch, 50);
        new MutationObserver((records) => {
          for (const record of records) {
            const node = record.target as HTMLElement;
            if (record.attributeName === "data-visual-state" && node === timeline) log.push({ what: `state:${timeline.dataset.visualState}`, at: performance.now() });
            if (record.attributeName === "data-decision" && node.dataset.decision === "validated") {
              const cursor = timeline.querySelector<HTMLElement>("[data-cursor='you'] > span")!.getBoundingClientRect();
              const block = node.getBoundingClientRect();
              log.push({ what: `validated:${node.dataset.block}`, at: performance.now(), dx: cursor.left - (block.left + block.width / 2), dy: cursor.top - (block.top + block.height / 2) });
            }
          }
        }).observe(timeline, { attributes: true, subtree: true, attributeFilter: ["data-visual-state", "data-decision"] });
      };
      document.addEventListener("DOMContentLoaded", watch);
    });
    await openHome(page);
    const timeline = page.getByTestId("control-timeline");
    // Not seen yet: the initial state.
    await expect(timeline).toHaveAttribute("data-visual-state", "idle");
    await expect(timeline.locator("[data-block][data-shown='true']")).toHaveCount(0);
    await expect(page.getByTestId("control-playhead")).toHaveAttribute("data-day", "0");

    // First the control scene with the timeline still below the fold: the network settles (its own
    // requestAnimationFrame calls end), then the timeline comes on screen within the same scene.
    await page.locator(SECTION).evaluate((node) => window.scrollTo({ top: node.getBoundingClientRect().top + window.scrollY - 400, behavior: "instant" }));
    const canvas = page.getByTestId("living-background");
    await expect(canvas).toHaveAttribute("data-scene", "controle", { timeout: 10_000 });
    await expect(canvas).toHaveAttribute("data-motion", "settled", { timeout: 15_000 });
    await expect(timeline).toHaveAttribute("data-visual-state", "idle");
    const calls = await sectionRafCalls(page);
    await showGrid(page);
    await expect(timeline).toHaveAttribute("data-visual-state", "playing", { timeout: 2_000 });
    await expect(canvas).toHaveAttribute("data-scene", "controle");
    await expect(timeline.locator("[data-block='firstContact']")).toHaveAttribute("data-decision", "pending");
    await expect(timeline).toHaveAttribute("data-visual-state", "done", { timeout: 5_000 });
    expect(await sectionRafCalls(page), "requestAnimationFrame calls (outside the network) while the timeline plays").toBe(calls);

    const log = await page.evaluate(() => (window as unknown as { __ctl: { what: string; at: number; dx?: number; dy?: number }[] }).__ctl);
    const playing = log.find((entry) => entry.what === "state:playing")!.at;
    const done = log.find((entry) => entry.what === "state:done")!.at;
    console.log(`contrôle: play measured ${Math.round(done - playing)} ms`);
    expect(done - playing).toBeLessThanOrEqual(4_200);
    const validated = log.filter((entry) => entry.what.startsWith("validated:"));
    expect(validated.map((entry) => entry.what)).toEqual(["validated:firstContact"]);
    console.log(`contrôle: cursor on « 1er contact » at validation dx ${validated[0]!.dx!.toFixed(1)} dy ${validated[0]!.dy!.toFixed(1)}`);
    expect(Math.abs(validated[0]!.dx!)).toBeLessThanOrEqual(4);
    expect(Math.abs(validated[0]!.dy!)).toBeLessThanOrEqual(4);
    await expectFinalTimeline(page);

    // Nothing changes afterwards: no replay, no loop, no infinite animation.
    const snapshot = () =>
      timeline.evaluate((node) => ({
        state: node.getAttribute("data-visual-state"),
        step: node.getAttribute("data-step"),
        shown: node.querySelectorAll("[data-shown='true']").length,
        day: node.querySelector("[data-testid='control-playhead']")!.getAttribute("data-day"),
      }));
    const end = await snapshot();
    await page.waitForTimeout(10_000);
    expect(await snapshot()).toEqual(end);
    await expect(page.locator("[data-loop]")).toHaveCount(1);
    const infinite = await page.evaluate(() =>
      document.getAnimations().filter((animation) => animation.effect?.getComputedTiming().iterations === Infinity).length,
    );
    expect(infinite).toBe(0);
  });

  test("organigramme : animations finies ≤ 2 000 ms après l'entrée de la tuile (L3-D3)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    const tile = page.getByTestId("control-tile").first();
    await showGrid(page);
    await expect(tile.locator("[data-reveal='entering']")).toHaveCount(1, { timeout: 2_000 });
    const started = Date.now();
    await expect
      .poll(() => tile.evaluate((node) => node.getAnimations({ subtree: true }).length), { timeout: 3_000, intervals: [100] })
      .toBe(0);
    const elapsed = Date.now() - started;
    console.log(`contrôle: chart animations over after ≈ ${elapsed} ms`);
    expect(elapsed).toBeLessThanOrEqual(2_000);
  });
});
