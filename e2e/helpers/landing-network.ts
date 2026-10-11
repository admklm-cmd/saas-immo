import { type Page } from "@playwright/test";

/**
 * Helpers of the landing motion tests (docs/design-system.md §2.11.4,
 * §2.11.4 bis, §2.11.7). Everything is measured in the page itself: no image
 * library is needed. The former network canvas is gone: what is left counts the
 * frames requested by the page and measures the contrast of the texts.
 */

type Instrumented = Window & { __rafCalls: number };

/** Init script: counts EVERY call to requestAnimationFrame made by the page. */
export async function instrumentPage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const target = window as unknown as Instrumented;
    target.__rafCalls = 0;
    const original = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback: FrameRequestCallback) => {
      target.__rafCalls += 1;
      return original(callback);
    };
  });
}

export function rafCalls(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as Instrumented).__rafCalls);
}

/** Puts the middle of a section at the middle of the viewport (instant scroll). */
export async function centerSection(page: Page, scene: string): Promise<void> {
  await page.locator(`section[data-living-scene='${scene}']`).evaluate((section) => {
    const box = section.getBoundingClientRect();
    const top = box.top + window.scrollY + Math.min(box.height, window.innerHeight * 1.2) / 2 - window.innerHeight / 2;
    window.scrollTo({ top, behavior: "instant" });
  });
}

export type LineContrast = {
  text: string;
  size: number;
  role: "title-ink" | "title-subtle" | "small" | "large";
  darkest: number;
  median: number;
};

const HIDE_TEXT = `
  main *, main *::before, main *::after { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; caret-color: transparent !important; }
  main svg text, main svg tspan { fill: transparent !important; }
  main [data-accent-mark], main [data-accent-frame] { visibility: hidden !important; }
`;

/**
 * Contrast of every line of text posed outside a card in the viewport
 * (docs/design-system.md §2.11.4, method of e2e/voiles-lisibilite.spec.ts):
 * the text is made transparent, the viewport captured, and the darkest and
 * median pixels under each line are compared with the text colour.
 */
export async function measureContrast(page: Page): Promise<LineContrast[]> {
  const lines = await page.evaluate(() => {
    const main = document.querySelector("main");
    if (!main) return [];
    const found: { text: string; color: string; size: number; weight: number; title: boolean; rects: [number, number, number, number][] }[] = [];
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    const width = window.innerWidth;
    const height = window.innerHeight;
    // The sticky header covers the top of the page: what is under it is not seen.
    const top = Math.max(0, document.querySelector("body > div header, header")?.getBoundingClientRect().bottom ?? 0);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.trim();
      const element = node.parentElement;
      if (!text || !element || element.closest(".sr-only")) continue;
      if (!element.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      // A card: an ancestor with a background of opacity ≥ 0.85.
      let card = false;
      for (let current: Element | null = element; current && current !== main; current = current.parentElement) {
        const channels = getComputedStyle(current).backgroundColor.match(/[\d.]+/g);
        if (channels && (channels.length === 3 || Number(channels[3]) >= 0.85)) {
          card = true;
          break;
        }
      }
      if (card) continue;
      const style = getComputedStyle(element);
      const color = element instanceof SVGElement ? style.fill : style.color;
      const range = document.createRange();
      range.selectNodeContents(node);
      const rects: [number, number, number, number][] = [];
      for (const rect of range.getClientRects()) {
        const x0 = Math.max(0, Math.floor(rect.left));
        const y0 = Math.max(Math.ceil(top), Math.floor(rect.top));
        const x1 = Math.min(width, Math.ceil(rect.right));
        const y1 = Math.min(height, Math.ceil(rect.bottom));
        if (x1 - x0 >= 4 && y1 - y0 >= 4) rects.push([x0, y0, x1, y1]);
      }
      if (rects.length === 0) continue;
      found.push({
        text: text.slice(0, 40),
        color,
        size: Number.parseFloat(style.fontSize),
        weight: Number.parseFloat(style.fontWeight),
        title: Boolean(element.closest("h1, h2, [data-testid='editorial-title-visual']")),
        rects,
      });
    }
    return found;
  });
  if (lines.length === 0) return [];

  await page.addStyleTag({ content: HIDE_TEXT }).then((handle) => handle.evaluate((node) => (node as Element).setAttribute("data-hide-text", "")));
  const shot = await page.screenshot({ animations: "allow" });
  await page.evaluate(() => document.querySelector("[data-hide-text]")?.remove());

  return page.evaluate(
    async ({ image, lines: items }) => {
      // A data: image (allowed by the img-src of the CSP; fetch would be blocked by connect-src).
      const bitmap = new Image();
      bitmap.src = `data:image/png;base64,${image}`;
      await bitmap.decode();
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext("2d")!;
      context.drawImage(bitmap, 0, 0);
      const { data, width } = context.getImageData(0, 0, bitmap.width, bitmap.height);
      const linear = (value: number) => {
        const c = value / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      const luminance = (r: number, g: number, b: number) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
      const results = [];
      for (const item of items) {
        const channels = (item.color.match(/[\d.]+/g) ?? ["0", "0", "0"]).map(Number);
        const ink = luminance(channels[0]!, channels[1]!, channels[2]!);
        const large = item.size >= 24 || (item.size >= 18.66 && item.weight >= 700);
        const isInk = channels[0] === 24 && channels[1] === 24 && channels[2] === 27;
        const role = item.title && large ? (isInk ? "title-ink" : "title-subtle") : large ? "large" : "small";
        const values: number[] = [];
        for (const [x0, y0, x1, y1] of item.rects) {
          for (let y = y0; y < y1; y++) {
            for (let x = x0; x < x1; x++) {
              const at = (y * width + x) * 4;
              values.push(luminance(data[at]!, data[at + 1]!, data[at + 2]!));
            }
          }
        }
        values.sort((a, b) => a - b);
        const ratio = (background: number) => (Math.max(background, ink) + 0.05) / (Math.min(background, ink) + 0.05);
        results.push({
          text: item.text,
          size: item.size,
          role,
          darkest: ratio(values[0]!),
          median: ratio(values[Math.floor(values.length / 2)]!),
        });
      }
      return results;
    },
    { image: shot.toString("base64"), lines },
  ) as Promise<LineContrast[]>;
}

/** Thresholds of §2.11.4: small ≥ 4.5; ink titles ≥ 7; subtle title lines ≥ 3 (darkest) and ≥ 4.5 (median). */
export function contrastFailures(results: LineContrast[]): string[] {
  const failures: string[] = [];
  for (const line of results) {
    const fail =
      (line.role === "small" && line.darkest < 4.5) ||
      (line.role === "large" && line.darkest < 3) ||
      (line.role === "title-ink" && line.darkest < 7) ||
      (line.role === "title-subtle" && (line.darkest < 3 || line.median < 4.5));
    if (fail) failures.push(`${line.role} « ${line.text} » ${line.darkest.toFixed(2)} / ${line.median.toFixed(2)}`);
  }
  return failures;
}
