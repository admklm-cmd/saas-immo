import { expect, test, type Page } from "@playwright/test";

import { HERO_TITLE, LANDING_TEXTS } from "@/components/landing-texts";

import { centerSection, contrastFailures, measureContrast } from "./helpers/landing-network";

/**
 * Nanorobots that exchange, and the terminal « humain ⇄ machine », in band 1
 * of the hero (docs/design-system.md §2.11.4 bis, criteria C1–C7, C9–C19; C8
 * is unit-tested in components/landing/hero/nano-exchange.test.ts, C20 lives
 * in e2e/landing-sans-boucle.spec.ts). An illustration: fictitious example,
 * simulation; nothing is sent, nothing is read from the database.
 *
 * No form on this journey: no consent checkbox to check.
 */

const COLD_START = 60_000;
const TERMINAL = LANDING_TEXTS.hero.terminal;
const FIELD = "[data-testid='hero-nanorobots']";
const VIEWPORTS = [
  { width: 1440, height: 900, robots: 64, actors: 16, maxActive: 2 },
  { width: 1024, height: 768, robots: 64, actors: 16, maxActive: 2 },
  { width: 390, height: 844, robots: 40, actors: 8, maxActive: 1 },
] as const;

async function openHome(page: Page): Promise<void> {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: HERO_TITLE })).toBeVisible({ timeout: COLD_START });
}

/** Robots actually displayed in the layer (the phone hides 24 of them). */
function visibleRobots(page: Page, kind?: "actor" | "ambient") {
  return page.locator(`${FIELD} [data-nano-robot${kind ? `='${kind}'` : ""}]`).evaluateAll((nodes) => nodes.filter((node) => node.checkVisibility()).length);
}

/** The transform of every robot, to compare two instants. */
function robotTransforms(page: Page) {
  return page.locator(`${FIELD} [data-nano-robot]`).evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).transform).join("|"));
}

/**
 * One sample of the layer: running exchanges, cobalt points shown (ports and
 * bits merged when they overlap — one point to the eye), actors in an engaged
 * phase and their distance to the texts (`[data-network-quiet]`).
 */
function sampleLayer(page: Page) {
  return page.evaluate((selector) => {
    const field = document.querySelector<HTMLElement>(selector)!;
    const shown = (node: Element) => node.checkVisibility() && Number(getComputedStyle(node).opacity) > 0.05 && Number(getComputedStyle(node.closest("[data-nano-pair]")!).opacity) > 0.05;
    const points: { x: number; y: number }[] = [];
    for (const node of field.querySelectorAll("[data-nano-port], [data-nano-bit]")) {
      if (!shown(node)) continue;
      const box = node.getBoundingClientRect();
      const point = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
      if (!points.some((other) => Math.hypot(other.x - point.x, other.y - point.y) < 5)) points.push(point);
    }
    const quiet = Array.from(document.querySelectorAll<HTMLElement>("[data-testid='hero-stage'] [data-network-quiet]")).map((node) => node.getBoundingClientRect());
    let nearest = Infinity;
    for (const actor of field.querySelectorAll<HTMLElement>("[data-nano-robot='actor']")) {
      if (!["contact", "link", "transfer"].includes(actor.dataset.phase ?? "")) continue;
      const box = actor.getBoundingClientRect();
      for (const rect of quiet) {
        const dx = Math.max(rect.left - box.right, 0, box.left - rect.right);
        const dy = Math.max(rect.top - box.bottom, 0, box.top - rect.bottom);
        nearest = Math.min(nearest, Math.hypot(dx, dy));
      }
    }
    return { active: Number(field.dataset.exchangesActive), cobalt: points.length, nearest };
  }, FIELD);
}

test.describe("composition et périmètre (mouvement réduit)", () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.width} px : ${viewport.robots} nanorobots dans la bande 1 du hero, aucun ailleurs, sans lueur (C1, C2, C9)`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openHome(page);
      expect(await visibleRobots(page)).toBe(viewport.robots);
      expect(await visibleRobots(page, "actor")).toBe(viewport.actors);
      // Nowhere outside the hero; the page-wide field is gone.
      await expect(page.locator("[data-nano-robot]:not(#hero [data-nano-robot])")).toHaveCount(0);
      await expect(page.getByTestId("nano-particle-field")).toHaveCount(0);
      await expect(page.getByTestId("living-background")).toHaveCount(0);
      // The layer stops above block A.
      const stage = (await page.getByTestId("hero-stage").boundingBox())!;
      const ecosystem = (await page.getByTestId("hero-ecosystem").boundingBox())!;
      expect(stage.y + stage.height).toBeLessThanOrEqual(ecosystem.y);
      // No glow: no shadow, no filter, on any robot, wire or bit.
      const glows = await page.locator(`${FIELD} [data-nano-robot], ${FIELD} [data-nano-link], ${FIELD} [data-nano-bit], ${FIELD} [data-nano-port]`).evaluateAll((nodes) =>
        nodes.filter((node) => getComputedStyle(node).boxShadow !== "none" || getComputedStyle(node).filter !== "none").length,
      );
      expect(glows).toBe(0);
      // At least one pair takes part in the exchanges (avoidance rule, C4).
      // (the controller measures after hydration: polled, not read once)
      await expect.poll(() => page.locator(`${FIELD} [data-nano-pair][data-active='true']`).count(), { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
    });
  }

  test("mouvement réduit : composition statique, deux paires reliées, terminal complet, aucun bouton pause (C17)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    const field = page.locator(FIELD);
    await expect(field).toHaveAttribute("data-loop-state", "reduced");
    const terminal = page.getByTestId("hero-terminal");
    await expect(terminal).toHaveAttribute("data-terminal-state", "reduced");
    await expect(page.getByTestId("hero-motion-pause")).toHaveCount(0);
    const hidden = await terminal.locator("[aria-hidden='true'] span:not([data-cursor])").evaluateAll((nodes) => nodes.filter((node) => getComputedStyle(node).opacity !== "1").length);
    expect(hidden).toBe(0);
    const linked = await page.locator(`${FIELD} [data-nano-pair]`).evaluateAll((pairs) =>
      pairs.filter((pair) => {
        const actor = pair.querySelector<HTMLElement>("[data-role='a']")!;
        const link = pair.querySelector("[data-nano-link]")!;
        return actor.dataset.phase === "link" && Number(getComputedStyle(link).opacity) > 0;
      }).length,
    );
    expect(linked).toBe(2);
    const before = await robotTransforms(page);
    await page.waitForTimeout(3_000);
    expect(await robotTransforms(page)).toBe(before);
    await expect(field).toHaveAttribute("data-exchanges", "0");
  });
});

test.describe("échanges (mouvement autorisé)", () => {
  test.use({ reducedMotion: "no-preference" });

  for (const viewport of [VIEWPORTS[0], VIEWPORTS[2]]) {
    test(`${viewport.width} px : un échange en 12 s, au plus ${viewport.maxActive} à la fois, ${viewport.maxActive} point(s) cobalt au plus, jamais près d'un texte (C4, C5, C6)`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openHome(page);
      const field = page.locator(FIELD);
      await expect(field).toHaveAttribute("data-loop-state", "playing", { timeout: 10_000 });
      await expect.poll(async () => Number(await field.getAttribute("data-exchanges")), { timeout: 12_000 }).toBeGreaterThanOrEqual(1);
      let worstActive = 0;
      let worstCobalt = 0;
      let nearest = Infinity;
      for (let sample = 0; sample < 120; sample += 1) {
        const state = await sampleLayer(page);
        worstActive = Math.max(worstActive, state.active);
        worstCobalt = Math.max(worstCobalt, state.cobalt);
        nearest = Math.min(nearest, state.nearest);
        await page.waitForTimeout(250);
      }
      expect(worstActive, "exchanges at once").toBeLessThanOrEqual(viewport.maxActive);
      expect(worstCobalt, "cobalt points at once").toBeLessThanOrEqual(viewport.maxActive);
      // 24 px from any text, with 1 px of tolerance for the handshake (scale 1.12).
      expect(nearest, "distance from an engaged actor to a text").toBeGreaterThanOrEqual(23);
      test.info().annotations.push({ type: `échanges ${viewport.width}`, description: `actifs max ${worstActive} · cobalt max ${worstCobalt} · distance min ${nearest.toFixed(1)} px` });
    });
  }

  test("1440 px : contact bord à bord, puis un fil et un bit visibles pendant le transfert (C7)", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    await expect(page.locator(FIELD)).toHaveAttribute("data-loop-state", "playing", { timeout: 10_000 });
    // An in-page sampler on every frame: the smallest distance between the centres during « contact »,
    // and whether a wire and a bit were both shown during « transfer ».
    const result = await page.evaluate(
      (selector) =>
        new Promise<{ contact: number; size: number; transfer: boolean }>((resolve) => {
          const field = document.querySelector<HTMLElement>(selector)!;
          let contact = Infinity;
          let size = 0;
          let transfer = false;
          const started = performance.now();
          const tick = () => {
            for (const pair of field.querySelectorAll<HTMLElement>("[data-nano-pair]")) {
              const a = pair.querySelector<HTMLElement>("[data-role='a']")!;
              const b = pair.querySelector<HTMLElement>("[data-role='b']")!;
              if (a.dataset.phase === "contact") {
                const boxA = a.getBoundingClientRect();
                const boxB = b.getBoundingClientRect();
                size = a.offsetWidth;
                contact = Math.min(contact, Math.hypot(boxA.left + boxA.width / 2 - (boxB.left + boxB.width / 2), boxA.top + boxA.height / 2 - (boxB.top + boxB.height / 2)));
              }
              if (a.dataset.phase === "transfer") {
                const link = Number(getComputedStyle(pair.querySelector("[data-nano-link]")!).opacity);
                const bit = Number(getComputedStyle(pair.querySelector("[data-nano-bit]")!).opacity);
                if (link > 0 && bit > 0) transfer = true;
              }
            }
            if ((transfer && contact < Infinity) || performance.now() - started > 20_000) resolve({ contact, size, transfer });
            else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }),
      FIELD,
    );
    expect(result.transfer, "wire and bit shown during the transfer").toBe(true);
    expect(result.contact, "centres in contact").toBeLessThanOrEqual(result.size + 1);
  });

  test("hors écran puis onglet caché : en pause, puis reprise (C3, C18)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    const field = page.locator(FIELD);
    await expect(field).toHaveAttribute("data-loop-state", "playing", { timeout: 10_000 });
    await centerSection(page, "probleme");
    await expect(field).toHaveAttribute("data-loop-state", "paused", { timeout: 1_000 });
    const paused = await robotTransforms(page);
    await page.waitForTimeout(1_000);
    expect(await robotTransforms(page), "frozen off screen").toBe(paused);

    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect(field).toHaveAttribute("data-loop-state", "playing", { timeout: 1_000 });
    const setVisibility = (state: "hidden" | "visible") =>
      page.evaluate((value) => {
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => value });
        document.dispatchEvent(new Event("visibilitychange"));
      }, state);
    await setVisibility("hidden");
    await expect(field).toHaveAttribute("data-loop-state", "paused");
    await setVisibility("visible");
    await expect(field).toHaveAttribute("data-loop-state", "playing");
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

  test("bouton pause : au clavier après « Espace agence », fige les nanorobots et finit le texte ; « reprendre » relance (C16)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    const field = page.locator(FIELD);
    await expect(field).toHaveAttribute("data-loop-state", "playing", { timeout: 10_000 });
    await page.getByTestId("hero-band").getByRole("link", { name: LANDING_TEXTS.actions.signIn }).focus();
    await page.keyboard.press("Tab");
    const pause = page.getByRole("button", { name: TERMINAL.pause.pauseName });
    await expect(pause).toBeFocused();
    await expect(pause).toHaveCSS("outline-style", "solid");
    await expect(pause).toHaveCSS("outline-color", "rgb(36, 87, 255)");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("hero-terminal")).toHaveAttribute("data-terminal-state", "done");
    await expect(field).toHaveAttribute("data-loop-state", "stopped");
    const frozen = await robotTransforms(page);
    await page.waitForTimeout(1_000);
    expect(await robotTransforms(page)).toBe(frozen);
    const resume = page.getByRole("button", { name: TERMINAL.pause.resumeName });
    await expect(resume).toBeFocused();
    await resume.click();
    await expect(field).toHaveAttribute("data-loop-state", "playing");
    await expect(page.getByRole("button", { name: TERMINAL.pause.pauseName })).toBeVisible();
    await expect(page.getByTestId("hero-terminal")).toHaveAttribute("data-terminal-state", "done");
  });

  test("« Rejouer les animations » : le terminal recommence à la ligne 1, les échanges ne repartent pas de zéro (C19)", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHome(page);
    const terminal = page.getByTestId("hero-terminal");
    await expect(terminal).toHaveAttribute("data-terminal-state", "done", { timeout: 15_000 });
    const field = page.locator(FIELD);
    const exchanges = Number(await field.getAttribute("data-exchanges"));
    expect(exchanges).toBeGreaterThanOrEqual(1);
    await page.getByTestId("landing-replay").click();
    await expect(terminal).toHaveAttribute("data-terminal-state", "typing");
    const firstChar = terminal.locator("[data-line-kind] > span:last-child > span:not([data-cursor])").first();
    await expect(firstChar).toHaveCSS("opacity", "0");
    expect(Number(await field.getAttribute("data-exchanges"))).toBeGreaterThanOrEqual(exchanges);
    await expect(terminal).toHaveAttribute("data-terminal-state", "done", { timeout: 15_000 });
  });
});

test.describe("accessibilité et cas dégradé", () => {
  test("figure nommée, lignes masquées, liste lue une fois (C11, C12)", async ({ page }) => {
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
  });

  test("cas d'erreur : sans JavaScript, les 8 lignes sont dans le HTML et toutes visibles à 13 s ; aucun bouton pause (C10)", async ({ browser }) => {
    test.setTimeout(60_000);
    const context = await browser.newContext({ javaScriptEnabled: false, reducedMotion: "no-preference" });
    const page = await context.newPage();
    await openHome(page);
    const lines = page.locator("[data-testid='hero-terminal'] [aria-hidden='true'] > div");
    await expect(lines).toHaveCount(8);
    const expected = TERMINAL.lines.map((line) => (line.kind === "comment" ? line.text : `${line.from}${TERMINAL.arrow}${line.to}${line.content}`));
    expect(await lines.evaluateAll((nodes) => nodes.map((node) => node.textContent))).toEqual(expected);
    await expect(page.getByTestId("hero-motion-pause")).toHaveCount(0);
    await page.waitForTimeout(13_000);
    const hidden = await page.locator("[data-testid='hero-terminal'] [aria-hidden='true'] span:not([data-cursor])").evaluateAll((nodes) => nodes.filter((node) => getComputedStyle(node).opacity !== "1").length);
    expect(hidden).toBe(0);
    // The nanorobots are drawn still, at rest or linked.
    await expect(page.locator(FIELD)).toHaveAttribute("data-loop-state", "paused");
    await context.close();
  });
});
