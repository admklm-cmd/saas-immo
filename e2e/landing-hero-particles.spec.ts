import { expect, test, type Page } from "@playwright/test";

import { HERO_TITLE, LANDING_TEXTS } from "@/components/landing-texts";

import { centerSection, contrastFailures, instrumentPage, measureContrast, rafCalls } from "./helpers/landing-network";

/**
 * Hero particle metamorphosis and terminal « humain ⇄ machine » (docs/design-system.md §2.11.4 ter,
 * criteria O1 to O13; the terminal criteria C10 to C16 and C19 of §2.11.4 bis are kept). The
 * background of band 1 is ONE canvas: a cloud that becomes a ball, an apple, then the two hands of
 * « La Création d'Adam »; played once, then the final image stays alive. An illustration: fictitious
 * example, simulation; nothing is sent, nothing is read from the database.
 *
 * No form on this journey: no consent checkbox to check.
 */

const COLD_START = 60_000;
const TERMINAL = LANDING_TEXTS.hero.terminal;
const CANVAS = "[data-testid='hero-particles']";
const VIEWPORTS = [
  { width: 1440, height: 900, points: 14_000 },
  { width: 1024, height: 768, points: 9_000 },
  { width: 390, height: 844, points: 4_200 },
] as const;

async function openHome(page: Page): Promise<void> {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: HERO_TITLE })).toBeVisible({ timeout: COLD_START });
}

/** Exact content of the canvas (what the engine drew), to compare two instants. */
function canvasPixels(page: Page): Promise<string> {
  return page.locator(CANVAS).evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL());
}

/** Number of cobalt pixels in the canvas, and the box they span (device pixels). */
function cobalt(page: Page) {
  return page.locator(CANVAS).evaluate((node) => {
    const canvas = node as HTMLCanvasElement;
    const { data } = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
    let count = 0;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -1;
    let y1 = -1;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3]! > 200 && data[i + 2]! > 200 && data[i]! < 90 && data[i + 1]! < 130) {
        const x = (i / 4) % canvas.width;
        const y = Math.floor(i / 4 / canvas.width);
        count++;
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
    }
    return { count, width: x1 - x0 + 1, height: y1 - y0 + 1 };
  });
}

test.describe("composition et périmètre (mouvement réduit)", () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.width} px : image finale immédiate, ${viewport.points} points, aucune puce ni image de fond (O3, O8, O12)`, async ({ page }) => {
      await instrumentPage(page);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openHome(page);
      const canvas = page.locator(CANVAS);
      await expect(canvas).toHaveAttribute("data-phase", "hands", { timeout: 10_000 });
      await expect(canvas).toHaveAttribute("data-state", "reduced");
      const points = Number(await canvas.getAttribute("data-points"));
      expect(points).toBeGreaterThanOrEqual(viewport.points * 0.75);
      expect(points).toBeLessThanOrEqual(viewport.points);
      await expect(canvas).toHaveAttribute("aria-hidden", "true");
      await expect(canvas).toHaveCSS("pointer-events", "none");
      // The old chips and the fixed image are gone; the stage is opaque white.
      await expect(page.locator("[data-nano-robot]")).toHaveCount(0);
      await expect(page.getByTestId("hero-nanorobots")).toHaveCount(0);
      await expect(page.getByTestId("particle-handoff-background")).toHaveCount(0);
      await expect(page.getByTestId("network-atmosphere")).toHaveCount(0);
      await expect(page.getByTestId("hero-stage")).toHaveCSS("background-color", "rgb(255, 255, 255)");
      // The only canvases of the page: the hero and the small dust.
      await expect(page.locator("canvas")).toHaveCount(2);
      await expect(page.getByTestId("page-dust")).toHaveAttribute("aria-hidden", "true");
      // Still: no frame requested and the same pixels 3 s later; no pause button; the terminal is complete.
      const calls = await rafCalls(page);
      const first = await canvasPixels(page);
      await page.waitForTimeout(3_000);
      expect(await canvasPixels(page)).toBe(first);
      expect(await rafCalls(page), "requestAnimationFrame calls under reduced motion").toBe(calls);
      await expect(page.getByTestId("hero-motion-pause")).toHaveCount(0);
      await expect(page.getByTestId("hero-terminal")).toHaveAttribute("data-terminal-state", "reduced");
      // The contact point: one small cobalt square, nothing else cobalt (O4).
      const contact = await cobalt(page);
      expect(contact.count).toBeGreaterThan(0);
      expect(contact.width).toBeLessThanOrEqual(8);
      expect(contact.height).toBeLessThanOrEqual(8);
    });
  }

  test("1440 px : le titre, le sous-titre et les actions sont utilisables, sans case de consentement (O2)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    const hero = page.getByTestId("hero-band");
    await expect(hero.getByRole("link", { name: LANDING_TEXTS.actions.estimation })).toHaveAttribute("href", "/estimation");
    await expect(hero.getByRole("link", { name: LANDING_TEXTS.actions.signIn })).toHaveAttribute("href", "/connexion");
    await expect(page.getByRole("checkbox")).toHaveCount(0);
  });
});

test.describe("métamorphose (mouvement autorisé)", () => {
  test.use({ reducedMotion: "no-preference" });

  test("1440 px : grande boule, une vague vers les mains, mains, dans l'ordre, une seule fois, puis l'image reste (O1, O6, 23)", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    // Records every change of phase, with the time since the first observed state.
    await page.addInitScript(() => {
      const log: { phase: string; at: number }[] = [];
      (window as unknown as { __phases: typeof log }).__phases = log;
      document.addEventListener("DOMContentLoaded", () => {
        const canvas = document.querySelector<HTMLElement>("[data-testid='hero-particles']")!;
        let origin = 0;
        const note = () => {
          const now = performance.now();
          if (log.length === 0) origin = now;
          if (log.at(-1)?.phase !== canvas.dataset.phase) log.push({ phase: canvas.dataset.phase!, at: now - origin });
        };
        new MutationObserver(note).observe(canvas, { attributes: true, attributeFilter: ["data-phase"] });
        note();
      });
    });
    await openHome(page);
    const canvas = page.locator(CANVAS);
    await expect(canvas).toHaveAttribute("data-state", "playing");
    await expect(canvas).toHaveAttribute("data-phase", "hands", { timeout: 20_000 });
    const log = await page.evaluate(() => (window as unknown as { __phases: { phase: string; at: number }[] }).__phases);
    // U.5(c): without the held ball (HELD_ENABLED false) the labels are sphere, to-hands, hands.
    expect(log.map((entry) => entry.phase)).toEqual(["sphere", "to-hands", "hands"]);
    // The durations of the schedule between phases (the first entry is the first observed state, before the first frame: the clock is read from the first transition).
    const expected = [0, 3_000, 10_600];
    for (let index = 2; index < log.length; index++) {
      const measured = log[index]!.at - log[1]!.at;
      const wanted = expected[index]! - expected[1]!;
      expect(Math.abs(measured - wanted), `${log[index]!.phase} at ${Math.round(measured)} ms, expected ${wanted}`).toBeLessThanOrEqual(450);
    }
    test.info().annotations.push({ type: "phases (ms)", description: log.map((entry) => `${entry.phase} ${Math.round(entry.at)}`).join(" · ") });
    // No loop of the metamorphosis: the phase and the clock stop on the final image.
    // The clock stops at the end of the sequence + the 300 ms of the contact point.
    await expect(canvas).toHaveAttribute("data-sequence-ms", "10900");
    const clock = await canvas.getAttribute("data-sequence-ms");
    await page.waitForTimeout(3_000);
    await expect(canvas).toHaveAttribute("data-phase", "hands");
    expect(await canvas.getAttribute("data-sequence-ms")).toBe(clock);
  });

  for (const viewport of VIEWPORTS) {
    test(`${viewport.width} px : ${viewport.points} points au plus, p95 d'intervalle d'image mesuré, un seul point cobalt à l'arrivée (O3, O4, O11)`, async ({ page }) => {
      test.setTimeout(60_000);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const session = await page.context().newCDPSession(page);
      // The phone is measured with the processor slowed ×4 (docs/design-system.md §2.11.4 ter G).
      if (viewport.width < 768) await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await page.goto("/");
      await page.evaluate(() => {
        const intervals: number[] = [];
        (window as unknown as { __iv: number[] }).__iv = intervals;
        let last = 0;
        const loop = (now: number) => {
          if (last) intervals.push(now - last);
          last = now;
          requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
      });
      const canvas = page.locator(CANVAS);
      await expect(canvas).toHaveAttribute("data-phase", "hands", { timeout: 40_000 });
      const points = Number(await canvas.getAttribute("data-points"));
      expect(points).toBeGreaterThanOrEqual(viewport.points * 0.4);
      expect(points).toBeLessThanOrEqual(viewport.points);
      const p95 = await page.evaluate(() => {
        const sorted = [...(window as unknown as { __iv: number[] }).__iv].slice(5).sort((a, b) => a - b);
        return sorted[Math.floor(sorted.length * 0.95)]!;
      });
      // Spec: ≤ 17 ms at 1440, ≤ 34 ms at 390 with CPU × 4; a small margin for a loaded machine.
      const limit = viewport.width >= 1280 ? 20 : 36;
      test.info().annotations.push({ type: `p95 ${viewport.width}`, description: `${p95.toFixed(1)} ms, ${points} points` });
      expect(p95, `p95 of the frame interval at ${viewport.width}`).toBeLessThanOrEqual(limit);
      expect(Number(await canvas.getAttribute("data-frame-p95"))).toBeGreaterThan(0);
      // Pause: the final image, still, then exactly one cobalt contact point (nothing else cobalt).
      await page.getByRole("button", { name: TERMINAL.pause.pauseName }).click();
      await expect(canvas).toHaveAttribute("data-state", "stopped");
      const contact = await cobalt(page);
      expect(contact.count).toBeGreaterThan(0);
      expect(contact.width).toBeLessThanOrEqual(8);
      expect(contact.height).toBeLessThanOrEqual(8);
    });
  }

  test("l'estimation est utilisable dès l'image 0 et pendant la transition (O2)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const link = page.getByTestId("hero-band").getByRole("link", { name: LANDING_TEXTS.actions.estimation });
    await expect(link).toBeVisible({ timeout: COLD_START });
    await expect(page.getByRole("heading", { level: 1, name: HERO_TITLE })).toBeVisible();
    await expect(page.locator(CANVAS)).toHaveAttribute("data-phase", "sphere", { timeout: 10_000 });
    await link.click();
    await expect(page).toHaveURL(/\/estimation$/);
  });

  test("lisible à chaque phase et à chaque largeur : titre, sous-titre, actions au-dessus des seuils de contraste (O10)", async ({ page }) => {
    test.setTimeout(180_000);
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openHome(page);
      const canvas = page.locator(CANVAS);
      for (const phase of ["sphere", "to-hands", "hands"]) {
        await expect(canvas).toHaveAttribute("data-phase", phase, { timeout: 30_000 });
        expect(contrastFailures(await measureContrast(page)), `${viewport.width} ${phase}`).toEqual([]);
      }
    }
  });

  test("pause : au clavier, fige la dernière image au pixel près ; « reprendre » ne rejoue pas la métamorphose (O7)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    const canvas = page.locator(CANVAS);
    await expect(canvas).toHaveAttribute("data-state", "playing", { timeout: 10_000 });
    await page.getByTestId("hero-band").getByRole("link", { name: LANDING_TEXTS.actions.signIn }).focus();
    await page.keyboard.press("Tab");
    const pause = page.getByRole("button", { name: TERMINAL.pause.pauseName });
    await expect(pause).toBeFocused();
    await expect(pause).toHaveCSS("outline-style", "solid");
    await expect(pause).toHaveCSS("outline-color", "rgb(36, 87, 255)");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("hero-terminal")).toHaveAttribute("data-terminal-state", "done");
    await expect(canvas).toHaveAttribute("data-state", "stopped");
    await expect(canvas).toHaveAttribute("data-phase", "hands");
    const frozen = await canvasPixels(page);
    await page.waitForTimeout(1_000);
    expect(await canvasPixels(page), "the same pixels 1 s later").toBe(frozen);
    const resume = page.getByRole("button", { name: TERMINAL.pause.resumeName });
    await expect(resume).toBeFocused();
    await resume.click();
    await expect(canvas).toHaveAttribute("data-state", "playing");
    await expect(canvas).toHaveAttribute("data-phase", "hands");
    await expect(page.getByRole("button", { name: TERMINAL.pause.pauseName })).toBeVisible();
  });

  test("hors écran puis onglet caché : aucune image demandée, reprise au même instant (O7)", async ({ page }) => {
    test.setTimeout(60_000);
    await instrumentPage(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    const canvas = page.locator(CANVAS);
    await expect(canvas).toHaveAttribute("data-state", "playing", { timeout: 10_000 });
    await centerSection(page, "probleme");
    await expect(canvas).toHaveAttribute("data-state", "paused", { timeout: 1_000 });
    const clock = await canvas.getAttribute("data-sequence-ms");
    const calls = await rafCalls(page);
    await page.waitForTimeout(1_500);
    expect(await rafCalls(page), "requestAnimationFrame calls while off screen").toBe(calls);
    expect(await canvas.getAttribute("data-sequence-ms")).toBe(clock);

    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect(canvas).toHaveAttribute("data-state", "playing", { timeout: 1_000 });
    const setVisibility = (state: "hidden" | "visible") =>
      page.evaluate((value) => {
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => value });
        document.dispatchEvent(new Event("visibilitychange"));
      }, state);
    await setVisibility("hidden");
    await expect(canvas).toHaveAttribute("data-state", "paused");
    const hiddenClock = await canvas.getAttribute("data-sequence-ms");
    await page.waitForTimeout(600);
    expect(await canvas.getAttribute("data-sequence-ms")).toBe(hiddenClock);
    await setVisibility("visible");
    await expect(canvas).toHaveAttribute("data-state", "playing");
  });

  test("« Rejouer les animations » : le canvas repart de la grande boule avec le terminal, qui recommence à la ligne 1 (O9, C19)", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    const terminal = page.getByTestId("hero-terminal");
    const canvas = page.locator(CANVAS);
    await expect(canvas).toHaveAttribute("data-phase", "hands", { timeout: 20_000 });
    await expect(terminal).toHaveAttribute("data-terminal-state", "done", { timeout: 15_000 });
    await page.getByTestId("landing-replay").click();
    await expect(canvas).toHaveAttribute("data-phase", "sphere", { timeout: 2_000 });
    expect(Number(await canvas.getAttribute("data-sequence-ms"))).toBeLessThan(1_500);
    await expect(terminal).toHaveAttribute("data-terminal-state", "typing");
    const firstChar = terminal.locator("[data-line-kind] > span:last-child > span:not([data-cursor])").first();
    await expect(firstChar).toHaveCSS("opacity", "0");
    await expect(canvas).toHaveAttribute("data-phase", "hands", { timeout: 20_000 });
    await expect(terminal).toHaveAttribute("data-terminal-state", "done", { timeout: 15_000 });
  });
});

test.describe("terminal « humain ⇄ machine » (mouvement autorisé)", () => {
  test.use({ reducedMotion: "no-preference" });

  test("frappe une fois : ligne 1 masquée à 1 s, complète à 13 s, hauteur fixe, hors des textes (C13, C14)", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    // Sampled by the page itself at 1 000 ms after the navigation start.
    await page.addInitScript(() => {
      const probe = () => {
        // The first character of the content of line 1.
        const char = document.querySelector<HTMLElement>("[data-testid='hero-terminal'] [data-line-kind] > span:last-child > span:not([data-cursor])");
        (window as unknown as { __at1s: string | null }).__at1s = char ? getComputedStyle(char).opacity : null;
      };
      document.addEventListener("DOMContentLoaded", () => window.setTimeout(probe, Math.max(0, 1_000 - performance.now())));
    });
    await openHome(page);
    const terminal = page.getByTestId("hero-terminal");
    await expect.poll(() => page.evaluate(() => (window as unknown as { __at1s: string | null }).__at1s), { timeout: 5_000 }).toBe("0");
    await expect(terminal).toHaveAttribute("data-terminal-state", "typing");
    const typingHeight = (await terminal.boundingBox())!.height;
    await expect(terminal).toHaveAttribute("data-terminal-state", "done", { timeout: 13_000 });
    const hidden = await terminal.locator("[aria-hidden='true'] span:not([data-cursor])").evaluateAll((nodes) => nodes.filter((node) => getComputedStyle(node).opacity !== "1").length);
    expect(hidden, "every character shown").toBe(0);
    const box = (await terminal.boundingBox())!;
    expect(Math.abs(box.height - typingHeight), "no layout shift while typing").toBeLessThanOrEqual(0.5);
    expect(box.height).toBe(160);
    // Clear of the title, the subtitle, the actions and the proofs.
    const others = await page.locator("[data-testid='hero-band'] [data-network-quiet]:not([data-testid='hero-terminal'])").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().toJSON()));
    for (const other of others) {
      const overlaps = box.x < other.right && box.x + box.width > other.left && box.y < other.bottom && box.y + box.height > other.top;
      expect(overlaps, "terminal overlaps a text block").toBe(false);
    }
  });

  test("contraste ≥ 4,5:1 sous chaque ligne du terminal, 1440 et 390 (C15)", async ({ page }) => {
    test.setTimeout(90_000);
    for (const viewport of [VIEWPORTS[0], VIEWPORTS[2]]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openHome(page);
      const terminal = page.getByTestId("hero-terminal");
      await expect(terminal).toHaveAttribute("data-terminal-state", "done", { timeout: 15_000 });
      await terminal.evaluate((node) => node.scrollIntoView({ block: "center", behavior: "instant" }));
      await page.waitForTimeout(300);
      expect(contrastFailures(await measureContrast(page)), `${viewport.width}`).toEqual([]);
    }
  });
});

test.describe("accessibilité et cas dégradé", () => {
  test("figure nommée, lignes masquées, liste lue une fois ; le canvas est hors de l'arbre d'accessibilité (C11, C12)", async ({ page }) => {
    await openHome(page);
    const figure = page.getByRole("figure", { name: TERMINAL.title });
    await expect(figure).toBeVisible();
    await expect(figure.getByRole("listitem")).toHaveText([...TERMINAL.srLines]);
    // « fiche créée » is exposed once (the static list); the visible lines are aria-hidden.
    const exposed = await page.locator("[data-testid='hero-terminal']").evaluate((node) => {
      const copy = node.cloneNode(true) as HTMLElement;
      copy.querySelectorAll("[aria-hidden='true']").forEach((hidden) => hidden.remove());
      return (copy.textContent?.match(/fiche créée/g) ?? []).length;
    });
    expect(exposed).toBe(1);
    await expect(page.locator("[data-testid='hero-terminal'] [aria-live]")).toHaveCount(0);
    await expect(page.locator(CANVAS)).toHaveAttribute("aria-hidden", "true");
    await expect(page.locator(CANVAS)).not.toHaveAttribute("tabindex", /.*/);
  });

  test("cas d'erreur : sans JavaScript, l'image finale est posée en fond, les 8 lignes sont dans le HTML et visibles à 13 s ; aucun bouton pause (C10)", async ({ browser }) => {
    test.setTimeout(60_000);
    const context = await browser.newContext({ javaScriptEnabled: false, reducedMotion: "no-preference" });
    const page = await context.newPage();
    await openHome(page);
    const poster = page.locator("[data-testid='hero-stage'] img[src*='hands-poster']");
    await expect(poster).toBeVisible();
    expect(await poster.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    const lines = page.locator("[data-testid='hero-terminal'] [aria-hidden='true'] > div");
    await expect(lines).toHaveCount(8);
    const expected = TERMINAL.lines.map((line) => (line.kind === "comment" ? line.text : `${line.from}${TERMINAL.arrow}${line.to}${line.content}`));
    expect(await lines.evaluateAll((nodes) => nodes.map((node) => node.textContent))).toEqual(expected);
    await expect(page.getByTestId("hero-motion-pause")).toHaveCount(0);
    await page.waitForTimeout(13_000);
    const hidden = await page.locator("[data-testid='hero-terminal'] [aria-hidden='true'] span:not([data-cursor])").evaluateAll((nodes) => nodes.filter((node) => getComputedStyle(node).opacity !== "1").length);
    expect(hidden).toBe(0);
    await context.close();
  });
});

test.describe("fond du reste de la page", () => {
  test.use({ reducedMotion: "no-preference" });

  test("poussière discrète : un canvas inerte fixe derrière le contenu, sous le fond blanc du hero, sans image d'animation (O12)", async ({ page }) => {
    await instrumentPage(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    const dust = page.getByTestId("page-dust");
    // The opaque hero covers the whole window: nothing is drawn behind it (docs T.6); the field starts once the hero is gone.
    await expect(dust).toHaveAttribute("data-loop-state", "paused");
    await expect(dust).toHaveCSS("position", "fixed");
    await expect(dust).toHaveCSS("pointer-events", "none");
    const stageAbove = await page.evaluate(() => {
      const dustNode = document.querySelector("[data-testid='page-dust']")!;
      const stage = document.querySelector("[data-testid='hero-stage']")!;
      return Boolean(dustNode.compareDocumentPosition(stage) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(stageAbove, "the hero stage paints after (above) the dust").toBe(true);
    await expect(page.getByTestId("hero-stage")).toHaveCSS("background-color", "rgb(255, 255, 255)");
    // The dust moves on a timer, not on animation frames: once the hero is off screen, the page requests none.
    await centerSection(page, "probleme");
    await expect(page.locator(CANVAS)).toHaveAttribute("data-state", "paused", { timeout: 1_000 });
    await expect(dust).toHaveAttribute("data-loop-state", "playing");
    await page.waitForTimeout(500);
    const calls = await rafCalls(page);
    await page.waitForTimeout(1_500);
    expect(await rafCalls(page), "requestAnimationFrame calls with the dust moving").toBe(calls);
  });
});
