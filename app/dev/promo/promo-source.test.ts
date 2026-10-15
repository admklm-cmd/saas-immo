import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { layoutOf } from "./promo-format";
import { PROMO_TEXTS } from "./promo-texts";

const FOLDER = __dirname;
const sources = readdirSync(FOLDER)
  .filter((name) => /\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts"))
  .map((name) => ({ name, text: readFileSync(join(FOLDER, name), "utf8") }));

describe("promo scene source (criteria 4, 8, 9)", () => {
  // The forbidden calls are assembled so that this file never matches itself.
  const forbidden = [["Date", "now"], ["performance", "now"], ["Math", "random"]].map(([object, method]) => `${object}.${method}`);

  it.each(forbidden)("never calls %s", (call) => {
    for (const source of sources) expect(source.text, source.name).not.toContain(call);
  });

  it("uses requestAnimationFrame only in the free preview of the stage", () => {
    for (const source of sources) {
      if (source.name === "PromoStage.tsx") continue;
      expect(source.text, source.name).not.toContain("requestAnimationFrame");
    }
  });

  it("uses no orange or red, no filter and no glow", () => {
    for (const source of sources) {
      expect(source.text, source.name).not.toMatch(/--color-(danger|warning|orange|red)/);
      expect(source.text, source.name).not.toMatch(/\b(blur|drop-shadow|shadowBlur)\b/);
    }
  });

  it("keeps the wording out of the scene code", () => {
    const scene = sources.filter((source) => /^promo-(draw|points|scene|dom)\.ts$/.test(source.name));
    for (const source of scene) {
      expect(source.text, source.name).not.toContain(PROMO_TEXTS.title1);
      expect(source.text, source.name).not.toContain("exemple fictif");
    }
  });
});

describe("9:16 safe zones (criterion 6)", () => {
  const layout = layoutOf("9x16");
  const top = layout.safeTop;
  const bottom = layout.height - layout.safeBottom;

  it("keeps every text anchor out of the top 250 px and the bottom 340 px", () => {
    const ys = [
      layout.title1.y,
      layout.title2.y,
      layout.main4.y,
      layout.title5.y,
      layout.window.y,
      layout.terminal.y,
      layout.rail.start.y - layout.station.icon / 2,
      layout.rail.end.y + layout.station.icon / 2,
      layout.mention.y,
      layout.logo.center.y - layout.logo.height / 2,
    ];
    for (const y of ys) {
      expect(y).toBeGreaterThanOrEqual(top);
      expect(y).toBeLessThanOrEqual(bottom);
    }
    expect(layout.terminal.y + 3 * layout.terminal.lineHeight + layout.terminal.noteGap + layout.terminal.noteFont).toBeLessThanOrEqual(bottom);
    expect(layout.window.y + layout.window.h).toBeLessThanOrEqual(bottom);
    expect(layout.signature.y + layout.signature.lineHeight).toBeLessThanOrEqual(bottom);
  });

  it("keeps the side margins and the minimum text sizes", () => {
    expect(layout.margin).toBeGreaterThanOrEqual(72);
    expect(layout.window.x).toBeGreaterThanOrEqual(72);
    expect(layout.window.x + layout.window.w).toBeLessThanOrEqual(layout.width - 72);
    expect(layout.main4.x + layout.main4.width / 2).toBeLessThanOrEqual(layout.width - 72);
    expect(layout.terminal.font).toBeGreaterThanOrEqual(30);
    for (const size of [layout.mention.font, layout.fictionNote.font, layout.mandateNote.font, layout.terminal.noteFont]) expect(size).toBeGreaterThanOrEqual(22);
  });
});
