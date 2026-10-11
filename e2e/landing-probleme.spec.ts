import { expect, test, type Page } from "@playwright/test";

import { LANDING_TEXTS } from "@/components/landing-texts";
import { CAUSE_EVENTS, PROBLEM_EVENTS } from "@/components/landing/problem/problem-scene";

/**
 * Landing, section « Le problème »: the illustration (mandates progress,
 * administrative events accumulate, progression plateaus) and its four causes,
 * linked both ways. Desktop 1440×900 and mobile 390×844. The suite runs in
 * reduced motion (playwright.config.ts): the final state is shown at once. One
 * group opts back into real motion to check the end of the sequence.
 *
 * This journey collects no personal data: there is no consent box to check.
 */

const COLD_START = 60_000;
const PROBLEM = LANDING_TEXTS.problem;
const VIEWPORTS = [
  { name: "ordinateur", viewport: { width: 1440, height: 900 } },
  { name: "mobile", viewport: { width: 390, height: 844 } },
] as const;

async function openProblem(page: Page) {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  const section = page.locator("section[data-living-scene='probleme']");
  await expect(section.getByRole("heading", { level: 2, name: PROBLEM.title })).toBeVisible({ timeout: COLD_START });
  const system = section.getByTestId("problem-system");
  await system.scrollIntoViewIfNeeded();
  return { section, system };
}

function eventsOf(page: Page, cause: keyof typeof CAUSE_EVENTS) {
  return PROBLEM_EVENTS.filter((event) => CAUSE_EVENTS[cause].includes(event.kind)).map((event) =>
    page.locator(`[data-testid='problem-event'][data-event-id='${event.id}']`),
  );
}

/** Kinds of the words currently visible on the chart. */
function visibleKinds(page: Page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll("[data-testid='problem-event-label']"))
      .filter((slot) => getComputedStyle(slot).visibility === "visible")
      .map((slot) => slot.getAttribute("data-event-kind"))
      .sort(),
  );
}

/** The words visible on the chart: readable (≥ 12 px), inside the scene, never on top of each other or of the name of the gap. */
async function expectCleanWords(page: Page) {
  const boxes = await page.evaluate(() => {
    const box = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
      };
    };
    const scene = document.querySelector("[data-testid='blocker-chart-scene']");
    const capacity = document.querySelector("[data-testid='problem-capacity']");
    const words = Array.from(document.querySelectorAll("[data-testid='problem-event-label']"))
      .filter((slot) => getComputedStyle(slot).visibility === "visible")
      .map((slot) => {
        const chip = slot.firstElementChild ?? slot;
        return {
          kind: slot.getAttribute("data-event-kind"),
          size: parseFloat(getComputedStyle(chip).fontSize),
          ...box(chip),
        };
      });
    return {
      scene: scene ? box(scene) : null,
      capacity: capacity ? box(capacity) : null,
      words,
    };
  });
  expect(boxes.words.length).toBeGreaterThan(0);
  const overlap = (
    a: (typeof boxes.words)[number] | NonNullable<typeof boxes.capacity>,
    b: NonNullable<typeof boxes.capacity>,
  ) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  for (const [index, word] of boxes.words.entries()) {
    expect(word.size, word.kind ?? "").toBeGreaterThanOrEqual(12);
    if (boxes.scene) {
      expect(word.left, word.kind ?? "").toBeGreaterThanOrEqual(boxes.scene.left - 0.5);
      expect(word.right, word.kind ?? "").toBeLessThanOrEqual(boxes.scene.right + 0.5);
    }
    if (boxes.capacity) expect(overlap(word, boxes.capacity), word.kind ?? "").toBe(false);
    for (const other of boxes.words.slice(index + 1))
      expect(overlap(word, other), `${word.kind} / ${other.kind}`).toBe(false);
  }
  return boxes.words.map((word) => word.kind);
}

async function expectHighlighted(page: Page, cause: keyof typeof CAUSE_EVENTS) {
  for (const event of eventsOf(page, cause)) await expect(event).toHaveAttribute("data-highlighted", "true");
  await expect(page.locator("[data-testid='problem-event'][data-highlighted='true']")).toHaveCount(
    eventsOf(page, cause).length,
  );
}

for (const { name, viewport } of VIEWPORTS) {
  test.describe(`section problème (${name})`, () => {
    test.use({ viewport });

    test("affiche la scène, ses repères et les quatre causes, sans aucun chiffre", async ({ page }) => {
      const { section } = await openProblem(page);
      const chart = section.getByTestId("blocker-chart");
      await expect(chart.getByTestId("blocker-chart-label")).toBeVisible();
      await expect(chart.getByTestId("blocker-chart-label")).toHaveText(PROBLEM.chart.label);
      const scene = chart.getByRole("img");
      await expect(scene).toBeVisible();
      await expect(scene).toHaveAccessibleDescription(PROBLEM.chart.description);
      expect(await scene.textContent()).not.toMatch(/\d/);
      await expect(section.getByTestId("problem-capacity")).toBeVisible();
      await expect(section.getByTestId("problem-capacity")).toHaveText(PROBLEM.chart.capacity);
      await expect(section.getByTestId("problem-event")).toHaveCount(PROBLEM_EVENTS.length);
      // At rest only a few words are shown, on one lane; the others come with their cause.
      const restKinds = PROBLEM_EVENTS.filter(
        (event) => event.label === "rest" || (event.label === "wide" && viewport.width >= 640),
      ).map((event) => event.kind);
      expect((await expectCleanWords(page)).sort()).toEqual([...restKinds].sort());
      const causes = section.getByRole("list", {
        name: PROBLEM.chart.causesLabel,
      });
      for (const symptom of PROBLEM.symptoms) await expect(causes).toContainText(symptom.title);
      // The page never scrolls sideways.
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    });

    test("chaque cause montre les mots de ses événements, lisibles et sans chevauchement", async ({ page }) => {
      const { section } = await openProblem(page);
      for (const symptom of PROBLEM.symptoms) {
        const button = section.getByRole("button", { name: symptom.title });
        await button.click();
        await expect(button).toHaveAttribute("aria-pressed", "true");
        const kinds = CAUSE_EVENTS[symptom.key];
        for (const kind of kinds) {
          await expect(section.locator(`[data-testid='problem-event-label'][data-event-kind='${kind}']`)).toBeVisible();
        }
        // Once the other words have faded out, only the words of the cause remain.
        await expect.poll(() => visibleKinds(page)).toEqual([...kinds].sort());
        expect((await expectCleanWords(page)).sort()).toEqual([...kinds].sort());
        await button.click();
        await expect(button).toHaveAttribute("aria-pressed", "false");
      }
    });

    test("survoler une cause marque ses événements, et l'inverse", async ({ page }) => {
      const { section, system } = await openProblem(page);
      const dossiers = section.locator("[data-testid='problem-cause'][data-cause='dossiers']");
      await dossiers.hover();
      await expect(system).toHaveAttribute("data-active-cause", "dossiers");
      await expectHighlighted(page, "dossiers");
      await expect(section.locator("[data-testid='problem-event-label'][data-event-kind='dossier']")).toHaveAttribute(
        "data-highlighted",
        "true",
      );

      // Leaving the system clears the highlight.
      await page.mouse.move(2, 2);
      await expect(system).not.toHaveAttribute("data-active-cause", /.+/);

      // Hovering the word of an event points back at its cause.
      await section.locator("[data-testid='problem-event-label'][data-event-kind='suivi']").hover();
      await expect(section.locator("[data-testid='problem-cause'][data-cause='suivi']")).toHaveAttribute(
        "data-highlighted",
        "true",
      );
    });

    test("au clavier, le focus d'une cause produit le même effet, Échap libère une cause épinglée", async ({
      page,
    }) => {
      const { section, system } = await openProblem(page);
      const first = section.getByRole("button", {
        name: PROBLEM.symptoms[0].title,
      });
      await first.focus();
      await expectHighlighted(page, "relances");
      await page.keyboard.press("Tab");
      await expect(section.getByRole("button", { name: PROBLEM.symptoms[1].title })).toBeFocused();
      await expectHighlighted(page, "dossiers");

      await page.keyboard.press("Enter");
      await expect(section.getByRole("button", { name: PROBLEM.symptoms[1].title })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await page.keyboard.press("Escape");
      await expect(section.getByRole("button", { name: PROBLEM.symptoms[1].title })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
      await expect(system).toHaveAttribute("data-active-cause", "dossiers"); // still focused
    });

    test("mouvement réduit : l'état final est affiché immédiatement", async ({ page }) => {
      const { section } = await openProblem(page);
      const curve = section.getByTestId("problem-curve");
      expect(await curve.evaluate((node) => getComputedStyle(node).strokeDashoffset)).toMatch(/^0(px)?$/);
      const lastEvent = section.locator(`[data-event-id='${PROBLEM_EVENTS.at(-1)?.id}'] > g`);
      expect(await lastEvent.evaluate((node) => getComputedStyle(node).opacity)).toBe("1");
      expect(await section.getByTestId("problem-capacity").evaluate((node) => getComputedStyle(node).opacity)).toBe(
        "1",
      );
    });
  });
}

test("mobile : toucher une cause l'épingle (aucun survol sur écran tactile)", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  const { section, system } = await openProblem(page);
  const doublons = section.getByRole("button", {
    name: "Doublons entre conseillers",
  });
  await doublons.tap();
  await expect(doublons).toHaveAttribute("aria-pressed", "true");
  await expect(system).toHaveAttribute("data-active-cause", "doublons");
  await expectHighlighted(page, "doublons");
  await context.close();
});

test("cas dégradé : sans JavaScript, la scène complète et les causes restent lisibles", async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  const section = page.locator("section[data-living-scene='probleme']");
  await section.getByTestId("problem-system").scrollIntoViewIfNeeded();
  await expect(section.getByTestId("blocker-chart-label")).toHaveText(PROBLEM.chart.label);
  await expect(section.getByTestId("problem-capacity")).toBeVisible();
  for (const event of PROBLEM_EVENTS.filter((item) => item.label === "rest" || item.label === "wide")) {
    await expect(section.locator(`[data-testid='problem-event-label'][data-event-kind='${event.kind}']`)).toBeVisible();
  }
  for (const symptom of PROBLEM.symptoms)
    await expect(section.getByRole("button", { name: symptom.title })).toBeVisible();
  await context.close();
});

test.describe("avec animations", () => {
  test.use({
    reducedMotion: "no-preference",
    viewport: { width: 1440, height: 900 },
  });

  test("la courbe se trace, les événements s'accumulent, puis la scène reste dans son état final", async ({ page }) => {
    const { section } = await openProblem(page);
    const reveal = section.locator(".reveal").filter({ has: page.getByTestId("problem-system") });
    await expect(reveal).toHaveAttribute("data-reveal", "entering");
    const lastEvent = section.locator(`[data-event-id='${PROBLEM_EVENTS.at(-1)?.id}'] > g`);
    // The sequence lasts about five seconds; then everything is in place.
    await expect
      .poll(async () => lastEvent.evaluate((node) => getComputedStyle(node).opacity), { timeout: 10_000 })
      .toBe("1");
    await expect
      .poll(async () => section.getByTestId("problem-capacity").evaluate((node) => getComputedStyle(node).opacity), {
        timeout: 10_000,
      })
      .toBe("1");
    const curve = section.getByTestId("problem-curve");
    expect(await curve.evaluate((node) => getComputedStyle(node).strokeDashoffset)).toMatch(/^0(px)?$/);
    await expect(section.locator("[data-testid='problem-cause']").last()).toHaveCSS("opacity", "1");
  });
});
