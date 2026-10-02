import { expect, test, type Page } from "@playwright/test";

import { HERO_TITLE, LANDING_TEXTS } from "@/components/landing-texts";

/**
 * Block C — the final « process » panel (docs/design-system.md §2.11.8.5,
 * criteria C1–C5 of §2.11.8.6): black panel, centred white title without
 * effect, paragraph, two actions, note, then a carousel of the seven steps
 * that never moves on its own (arrows, keyboard, mouse drag, click on a
 * neighbour), computed progress, polite announcement, AA contrasts on the
 * black, reduced motion = still drawings at their final state.
 *
 * The suite runs in reduced motion (playwright.config.ts); the motion group
 * opts back in.
 */

const COLD_START = 60_000;
const TEXTS = LANDING_TEXTS.final;

async function openHome(page: Page): Promise<void> {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: HERO_TITLE })).toBeVisible({ timeout: COLD_START });
}

async function showCarousel(page: Page): Promise<void> {
  await page.getByTestId("process-carousel").evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
}

/**
 * Time from « playing » to « done » of the drawing of `step`, measured in the
 * page (50 ms polling), from the moment it is called.
 */
async function playDuration(page: Page, step: string): Promise<number> {
  const selector = `[data-testid='process-visual'][data-step='${step}']`;
  const state = (wanted: string) => `document.querySelector("${selector}")?.getAttribute("data-visual-state") === "${wanted}"`;
  await page.waitForFunction(state("playing"), null, { polling: 50, timeout: 5_000 });
  const started = await page.evaluate(() => performance.now());
  await page.waitForFunction(state("done"), null, { polling: 50, timeout: 5_000 });
  return (await page.evaluate(() => performance.now())) - started;
}

const activeStep = (page: Page) => page.getByTestId("process-carousel").getAttribute("data-active-step");

/** Distance between the centre of the active card and the centre of the track (px). */
async function activeOffset(page: Page): Promise<number> {
  return page.getByTestId("process-track").evaluate((track) => {
    const card = track.querySelector<HTMLElement>("[data-active]")!;
    const a = card.getBoundingClientRect();
    const t = track.getBoundingClientRect();
    return Math.abs(a.left + a.width / 2 - (t.left + t.width / 2));
  });
}

test.describe("bloc C — panneau final « processus »", () => {
  test("C1 : panneau noir arrondi, titre centré blanc sans effet, ordre titre → paragraphe → actions → note → flèches → piste", async ({ page }) => {
    for (const width of [1440, 1024, 390, 360]) {
      await page.setViewportSize({ width, height: 900 });
      await openHome(page);
      const panel = page.getByTestId("final-panel");
      await expect(panel).toHaveCSS("background-color", "rgb(10, 10, 11)");
      await expect(panel).toHaveCSS("border-radius", width >= 640 ? "32px" : "24px");
      const title = page.locator("#final-title");
      await expect(title).toHaveCSS("color", "rgb(250, 250, 250)");
      await expect(title).not.toHaveAttribute("data-accent-effect");
      await expect(title.locator("canvas, [data-accent-frame], [data-accent-mark]")).toHaveCount(0);
      const geometry = await panel.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const centre = box.left + box.width / 2;
        const lines = Array.from(element.querySelectorAll<HTMLElement>("#final-title [data-title-line]")).map((line) => {
          const range = document.createRange();
          range.selectNodeContents(line);
          const rects = Array.from(range.getClientRects());
          const left = Math.min(...rects.map((rect) => rect.left));
          const right = Math.max(...rects.map((rect) => rect.right));
          return Math.abs((left + right) / 2 - centre);
        });
        const top = (selector: string) => (element.querySelector(selector) as HTMLElement).getBoundingClientRect().top;
        const actions = element.querySelector("[data-testid='final-actions']") as HTMLElement;
        return {
          lines,
          order: [
            top("#final-title"),
            top("[data-testid='final-body']"),
            (actions.firstElementChild as HTMLElement).getBoundingClientRect().top,
            (actions.lastElementChild as HTMLElement).getBoundingClientRect().top,
            top("[data-testid='process-previous']"),
            top("[data-testid='process-track']"),
          ],
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      for (const offset of geometry.lines) expect(offset, `${width}: line centre`).toBeLessThanOrEqual(2);
      for (let index = 1; index < geometry.order.length; index += 1) {
        expect(geometry.order[index]!, `${width}: order ${index}`).toBeGreaterThan(geometry.order[index - 1]!);
      }
      expect(geometry.overflow, `${width}: page overflow`).toBeLessThanOrEqual(0);
      await expect(page.getByTestId("final-actions").getByRole("link", { name: LANDING_TEXTS.actions.estimation })).toHaveAttribute("href", "/estimation");
      await expect(page.getByTestId("final-actions").getByRole("link", { name: LANDING_TEXTS.actions.signIn })).toHaveAttribute("href", "/connexion");
      await expect(page.getByTestId("final-actions").locator("p")).toHaveText(TEXTS.note);
    }
  });

  test("C1 : contrastes AA mesurés sur le noir (couleurs calculées)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    await showCarousel(page);
    const ratios = await page.getByTestId("final-panel").evaluate((panel) => {
      type Rgba = [number, number, number, number];
      const parse = (value: string): Rgba => {
        const parts = value.match(/[\d.]+/g)!.map(Number);
        return [parts[0]!, parts[1]!, parts[2]!, parts[3] ?? 1];
      };
      const over = (top: Rgba, bottom: Rgba): Rgba => [
        top[0] * top[3] + bottom[0] * (1 - top[3]),
        top[1] * top[3] + bottom[1] * (1 - top[3]),
        top[2] * top[3] + bottom[2] * (1 - top[3]),
        1,
      ];
      const luminance = ([r, g, b]: Rgba) =>
        [r, g, b]
          .map((channel) => channel / 255)
          .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
          .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index]!, 0);
      const ratio = (a: Rgba, b: Rgba) => {
        const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
        return Math.round(((high + 0.05) / (low + 0.05)) * 10) / 10;
      };
      /** Background actually under an element: its own and its ancestors' fills, composed over the panel. */
      const backdrop = (element: Element): Rgba => {
        const layers: Rgba[] = [];
        for (let node: Element | null = element; node && node !== panel.parentElement; node = node.parentElement) {
          const fill = parse(getComputedStyle(node).backgroundColor);
          if (fill[3] > 0) layers.push(fill);
          if (node === panel) break;
        }
        return layers.reverse().reduce<Rgba>((under, layer) => over(layer, under), [255, 255, 255, 1]);
      };
      const text = (selector: string) => {
        const element = panel.querySelector(selector)!;
        return ratio(over(parse(getComputedStyle(element).color), backdrop(element)), backdrop(element));
      };
      const active = "[data-testid='process-card'][data-active]";
      return {
        title: text("#final-title [data-title-line]"),
        paragraph: text("[data-testid='final-body']"),
        note: text("[data-testid='final-actions'] > p"),
        cardTitle: text(`${active} h3`),
        cardBody: text(`${active} p`),
        pill: text(`${active} > span`),
        percent: text("[data-testid='process-percent']"),
        arrow: text("[data-testid='process-next']"),
        fill: ratio(parse(getComputedStyle(panel.querySelector("[data-testid='process-carousel'] [style*='--progress']")!).backgroundColor), [10, 10, 11, 1]),
      };
    });
    expect(ratios.title).toBeGreaterThanOrEqual(19);
    expect(ratios.paragraph).toBeGreaterThanOrEqual(7);
    expect(ratios.note).toBeGreaterThanOrEqual(7);
    expect(ratios.cardTitle).toBeGreaterThanOrEqual(15);
    expect(ratios.cardBody).toBeGreaterThanOrEqual(7);
    expect(ratios.pill).toBeGreaterThanOrEqual(10);
    expect(ratios.percent).toBeGreaterThanOrEqual(7);
    expect(ratios.arrow).toBeGreaterThanOrEqual(15);
    expect(ratios.fill).toBeGreaterThanOrEqual(3);
    console.log("block C contrasts", JSON.stringify(ratios));
  });

  test("C2 : carte 1 et 14 % au départ ; flèches, clavier (← → Origine Fin), clic sur une voisine ; annonce polie", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    await showCarousel(page);
    // Scoped: the agents carousel has its own « Étape précédente / suivante » buttons.
    const region = page.getByRole("region", { name: TEXTS.carousel.label });
    const previous = region.getByRole("button", { name: TEXTS.carousel.previous });
    const next = region.getByRole("button", { name: TEXTS.carousel.next });
    const percent = page.getByTestId("process-percent");
    const live = page.getByTestId("process-live");

    expect(await activeStep(page)).toBe("0");
    await expect(percent).toHaveText("14 %");
    await expect(previous).toHaveAttribute("aria-disabled", "true");
    await expect(live).toHaveText("");
    expect(await activeOffset(page)).toBeLessThanOrEqual(1);

    await next.click();
    expect(await activeStep(page)).toBe("1");
    await expect(percent).toHaveText("29 %");
    await expect(live).toHaveText(`Étape 2 sur 7 : Qualification · Hugo. ${TEXTS.steps[1].body}`);
    await expect(previous).not.toHaveAttribute("aria-disabled");
    expect(await activeOffset(page)).toBeLessThanOrEqual(1);

    const track = page.getByTestId("process-track");
    await track.focus();
    await page.keyboard.press("ArrowRight");
    expect(await activeStep(page)).toBe("2");
    await page.keyboard.press("ArrowLeft");
    expect(await activeStep(page)).toBe("1");
    await page.keyboard.press("End");
    expect(await activeStep(page)).toBe("6");
    await expect(percent).toHaveText("100 %");
    await expect(next).toHaveAttribute("aria-disabled", "true");
    expect(await activeOffset(page)).toBeLessThanOrEqual(1);
    await page.keyboard.press("Home");
    expect(await activeStep(page)).toBe("0");

    // A neighbour: one click makes it active.
    await page.locator("[data-testid='process-card'][data-step='hugo']").click();
    expect(await activeStep(page)).toBe("1");
    await expect(page.locator("[data-testid='process-card'][data-step='hugo']")).toHaveAttribute("aria-label", "Étape 2 sur 7 : Qualification · Hugo");
    // Inactive cards are hidden from assistive technology.
    await expect(page.locator("[data-testid='process-card'][aria-hidden='true']")).toHaveCount(6);
  });

  test("clavier : ordre de tabulation actions → flèches → piste, focus visible", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    await page.getByTestId("final-actions").getByRole("link", { name: LANDING_TEXTS.actions.signIn }).focus();
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("process-previous")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("process-next")).toBeFocused();
    await expect(page.getByTestId("process-next")).toHaveCSS("outline-style", "solid");
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("process-track")).toBeFocused();
    const ring = await page.locator("[data-testid='process-card'][data-active]").evaluate((card) => getComputedStyle(card).boxShadow);
    expect(ring).toContain("rgb(36, 87, 255)");
  });

  test("C4 : mouvement réduit — tous les visuels « done » à l'instant 0, aucun glissement", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    await showCarousel(page);
    const states = await page.getByTestId("process-visual").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-visual-state")));
    expect(states).toEqual(Array(7).fill("done"));
    await expect(page.locator("[data-testid='process-visual'][data-run]")).toHaveCount(0);
    const animations = await page.getByTestId("process-carousel").evaluate((element) =>
      element.getAnimations({ subtree: true }).filter((animation) => !/^simulation-/.test((animation as CSSAnimation).animationName ?? "")).length,
    );
    expect(animations).toBe(0);
    await page.getByTestId("process-next").click();
    // No glide: the track is already on the new card when the click returns.
    expect(await activeOffset(page)).toBeLessThanOrEqual(1);
    await expect(page.locator("[data-testid='process-visual'][data-step='hugo']")).toHaveAttribute("data-visual-state", "done");
  });

  test("C5 : 390 et 360 — carte ≤ largeur − 48 px, flèches ≥ 44 × 44, aucun débordement", async ({ page }) => {
    for (const width of [390, 360]) {
      await page.setViewportSize({ width, height: 844 });
      await openHome(page);
      await showCarousel(page);
      const card = await page.locator("[data-testid='process-card']").first().boundingBox();
      expect(card!.width, `${width}: card`).toBeLessThanOrEqual(width - 48);
      for (const id of ["process-previous", "process-next"]) {
        const arrow = await page.getByTestId(id).boundingBox();
        expect(arrow!.width, `${width}: ${id} width`).toBeGreaterThanOrEqual(44);
        expect(arrow!.height, `${width}: ${id} height`).toBeGreaterThanOrEqual(44);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
      expect(await activeOffset(page)).toBeLessThanOrEqual(1);
    }
  });

  test("cas dégradé : sans JavaScript, la première carte est au centre et toutes les étapes sont dans le HTML", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto("/", { timeout: COLD_START });
    await expect(page.getByTestId("process-card")).toHaveCount(7);
    await expect(page.locator("[data-testid='process-card'][data-active]")).toHaveAttribute("data-step", "lea");
    expect(await activeOffset(page)).toBeLessThanOrEqual(1);
    await expect(page.getByTestId("final-actions").getByRole("link", { name: LANDING_TEXTS.actions.estimation })).toBeVisible();
    await context.close();
  });

  test.describe("avec mouvement", () => {
    test.use({ reducedMotion: "no-preference" });

    test("C3 : la carte 1 joue une fois à l'arrivée, puis rien ne bouge seul pendant 10 s", async ({ page }) => {
      test.setTimeout(60_000);
      await page.setViewportSize({ width: 1440, height: 900 });
      await openHome(page);
      await page.mouse.move(2, 2);
      // Not seen yet: the first drawing waits on its first frame.
      await expect(page.locator("[data-testid='process-visual'][data-step='lea']")).toHaveAttribute("data-visual-state", "idle");
      await showCarousel(page);
      expect(await playDuration(page, "lea"), "card 1 done").toBeLessThanOrEqual(2_600);
      const before = await page.getByTestId("process-track").evaluate((track) => track.scrollLeft);
      await page.waitForTimeout(10_000);
      expect(await activeStep(page), "no autoplay").toBe("0");
      expect(await page.getByTestId("process-track").evaluate((track) => track.scrollLeft)).toBe(before);
      await expect(page.locator("[data-testid='process-visual'][data-visual-state='playing']")).toHaveCount(0);
    });

    test("C3 : « Étape suivante » rejoue le visuel de la carte devenue active (≤ 2,6 s), glissement centré", async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await openHome(page);
      await showCarousel(page);
      const duration = playDuration(page, "hugo");
      await page.getByTestId("process-next").click();
      expect(await duration).toBeLessThanOrEqual(2_600);
      await expect.poll(() => activeOffset(page)).toBeLessThanOrEqual(1);
      // Back with « previous »: card 1 replays (a gesture of the user).
      await page.getByTestId("process-previous").click();
      await expect(page.locator("[data-testid='process-visual'][data-step='lea']")).toHaveAttribute("data-visual-state", "playing");
    });

    test("C2 : glisser la piste de 200 px vers la gauche à la souris amène la carte suivante, sans sélectionner par erreur", async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await openHome(page);
      await showCarousel(page);
      const box = (await page.locator("[data-testid='process-card'][data-active]").boundingBox())!;
      const y = box.y + box.height / 2;
      const x = box.x + box.width / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      // A hand-speed drag (25 px every 50 ms, ≈ 0.5 px/ms): the momentum of useTrackPhysics carries it to the next stop.
      for (let step = 1; step <= 8; step += 1) {
        if (step > 1) await page.waitForTimeout(50);
        await page.mouse.move(x - step * 25, y);
      }
      await page.mouse.up();
      await expect.poll(() => activeStep(page), { timeout: 3_000 }).toBe("1");
      await expect.poll(() => activeOffset(page), { timeout: 3_000 }).toBeLessThanOrEqual(1);
      // The release did not click the card under the pointer into something else.
      expect(await activeStep(page)).toBe("1");
    });
  });
});
