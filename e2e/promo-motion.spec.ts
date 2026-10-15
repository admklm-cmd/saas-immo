import { expect, test, type Page } from "@playwright/test";

/**
 * `/dev/promo` — the promo video page (docs/motion/promo-2026-10.md). A development tool: no sign-in,
 * no consent box in this journey (nothing is collected). The page must render the same image for the
 * same time, whatever happened before (`window.__promo.seek`), because the export relies on it.
 * That the page answers 404 in production is covered by `app/dev/promo/guard.test.ts`.
 */

type Fingerprint = { base: string; marks: string; text: string };

async function openStage(page: Page, query: string) {
  await page.goto(`/dev/promo?${query}`);
  await page.waitForFunction(() => Boolean(window.__promo));
  await page.evaluate(() => window.__promo!.ready);
}

/** Everything that is drawn at the current time: both canvases and the visible texts. */
async function fingerprint(page: Page, ms: number): Promise<Fingerprint> {
  return page.evaluate((time) => {
    window.__promo!.seek(time);
    const canvases = Array.from(document.querySelectorAll<HTMLCanvasElement>(".promo-stage canvas"));
    const stage = document.querySelector<HTMLElement>(".promo-stage")!;
    const text = Array.from(stage.querySelectorAll<HTMLElement>("[data-promo]"))
      .map((element) => `${element.dataset.promo}:${element.style.opacity}:${element.style.transform}:${element.textContent}`)
      .join("|");
    return { base: canvases[0]!.toDataURL(), marks: canvases[1]!.toDataURL(), text };
  }, ms);
}

test("exposes a deterministic seek on the 16:9 stage", async ({ page }) => {
  await openStage(page, "format=16x9&t=0");
  const size = await page.locator(".promo-stage").boundingBox();
  expect(size?.width).toBe(1920);
  expect(size?.height).toBe(1080);
  expect(await page.evaluate(() => window.__promo!.durationMs)).toBe(33_000);

  const first = await fingerprint(page, 15_400);
  const start = await fingerprint(page, 0);
  const again = await fingerprint(page, 15_400);
  expect(again).toEqual(first);
  expect(first.base).not.toEqual(start.base);

  const contact = await fingerprint(page, 29_700);
  expect(await fingerprint(page, 29_700)).toEqual(contact);
  expect(await fingerprint(page, 15_400)).toEqual(first);
});

test("tells the story in the expected order", async ({ page }) => {
  await openStage(page, "format=16x9&t=0");
  const visibleTexts = async (ms: number) =>
    page.evaluate((time) => {
      window.__promo!.seek(time);
      return Array.from(document.querySelectorAll<HTMLElement>(".promo-stage [data-promo]"))
        .filter((element) => Number(element.style.opacity || "0") > 0.5)
        .map((element) => (element.textContent ?? "").replace(/ /g, " "))
        .join(" ");
    }, ms);
  expect(await visibleTexts(2000)).toContain("Chaque demande compte.");
  expect(await visibleTexts(8000)).toContain("Ascend les rassemble.");
  expect(await visibleTexts(14_500)).toContain("exemple fictif — simulation");
  expect(await visibleTexts(19_000)).toContain("restent les vôtres.");
  expect(await visibleTexts(19_000)).toContain("envoi simulé — aucun message réel");
  expect(await visibleTexts(25_000)).toContain("Vous gardez la vue.");
  expect(await visibleTexts(25_000)).toContain("exemple fictif");
  expect(await visibleTexts(33_000)).toContain("Ascend Strategy");
  expect(await visibleTexts(33_000)).toContain("Prototype — exemple fictif");
});

test("renders the 9:16 stage at the exact size", async ({ page }) => {
  await openStage(page, "format=9x16&t=33000");
  const size = await page.locator(".promo-stage").boundingBox();
  expect(size?.width).toBe(1080);
  expect(size?.height).toBe(1920);
  expect(await page.evaluate(() => window.__promo!.format)).toBe("9x16");
});

test("falls back safely on wrong parameters", async ({ page }) => {
  await openStage(page, "format=bogus&t=999999");
  expect(await page.evaluate(() => window.__promo!.format)).toBe("16x9");
  // A time past the end is clamped to the last image: the final card is on screen.
  await expect(page.locator('.promo-stage [data-promo="sig-0"]')).toHaveCSS("opacity", "1");
});

test("shows the final card and a play button in the free preview under reduced motion", async ({ page }) => {
  await page.goto("/dev/promo?format=16x9");
  await expect(page.locator('.promo-stage[data-ready="true"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Lire" })).toBeEnabled();
  await expect(page.locator('.promo-stage [data-promo="sig-0"]')).toHaveCSS("opacity", "1");
});
