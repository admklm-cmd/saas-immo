import { describe, expect, it } from "vitest";

import type { BakedHands } from "@/components/landing/hero/particles/hands-data";
import baked from "@/components/landing/hero/particles/hands.baked.json";

import type { PromoDemo } from "./promo-demo";
import { layoutOf, type PromoFormat } from "./promo-format";
import { computePoints, createPointBuffer, driftClock } from "./promo-points";
import { buildScene, monotoneCurve, roundedRectPoint } from "./promo-scene";
import { DURATION_MS, T } from "./promo-timeline";

const DEMO: PromoDemo = { cumulative: [0, 1, 1, 2, 4, 4, 7, 9, 9, 12], received: 12, openDossiers: 5, appointmentsPlanned: 2, mandatesConfirmed: 3 };

const FORMATS: PromoFormat[] = ["16x9", "9x16"];
const scenes = Object.fromEntries(FORMATS.map((format) => [format, buildScene(layoutOf(format), baked as unknown as BakedHands, DEMO)])) as Record<PromoFormat, ReturnType<typeof buildScene>>;

function snapshot(format: PromoFormat, t: number) {
  const scene = scenes[format];
  const buffer = createPointBuffer(scene.n);
  computePoints(scene, t, buffer);
  return buffer;
}

describe.each(FORMATS)("point cloud %s", (format) => {
  const scene = scenes[format];

  it("keeps a constant population of identities", () => {
    expect(scene.n).toBe(layoutOf(format).count);
    expect(scene.a).toBeLessThan(scene.n);
  });

  it("renders the same time to the same positions (deterministic)", () => {
    const first = snapshot(format, 15_400);
    snapshot(format, 0);
    snapshot(format, 29_700);
    const again = snapshot(format, 15_400);
    expect(Array.from(again.x)).toEqual(Array.from(first.x));
    expect(Array.from(again.y)).toEqual(Array.from(first.y));
    expect(Array.from(again.alpha)).toEqual(Array.from(first.alpha));
    expect(Array.from(again.inverse)).toEqual(Array.from(first.inverse));
  });

  it("builds the scene deterministically", () => {
    const other = buildScene(layoutOf(format), baked as unknown as BakedHands, DEMO);
    expect(Array.from(other.scatterX.slice(0, 200))).toEqual(Array.from(scene.scatterX.slice(0, 200)));
    expect(Array.from(other.windowX.slice(0, 200))).toEqual(Array.from(scene.windowX.slice(0, 200)));
  });

  it("produces finite values at every key instant", () => {
    for (const t of [0, 3000, 4500, 7300, 9100, 9500, 14_000, 15_000, 21_000, 22_500, 24_000, 26_000, 27_500, 29_700, DURATION_MS]) {
      const buffer = snapshot(format, t);
      for (let i = 0; i < scene.n; i++) {
        expect(Number.isFinite(buffer.x[i]!)).toBe(true);
        expect(Number.isFinite(buffer.y[i]!)).toBe(true);
        expect(buffer.alpha[i]!).toBeGreaterThanOrEqual(0);
        expect(buffer.alpha[i]!).toBeLessThanOrEqual(1.0001);
      }
    }
  });

  it("only shows the dormant identities once the hands are born", () => {
    const early = snapshot(format, 20_000);
    for (let i = scene.a; i < scene.n; i++) expect(early.alpha[i]).toBe(0);
    const late = snapshot(format, DURATION_MS);
    let visible = 0;
    for (let i = scene.a; i < scene.n; i++) if (late.alpha[i]! > 0) visible++;
    expect(visible).toBeGreaterThan((scene.n - scene.a) * 0.9);
  });

  it("starts on the light background and is dark in plans 3 and 4", () => {
    expect(snapshot(format, 1000).inverse.every((value) => value === 0)).toBe(true);
    const dark = snapshot(format, 14_500);
    let inverse = 0;
    for (let i = 0; i < scene.a; i++) if (dark.inverse[i]! > 0.99) inverse++;
    expect(inverse).toBeGreaterThan(scene.a * 0.95);
    expect(snapshot(format, 25_000).inverse.every((value) => value === 0)).toBe(true);
  });

  it("freezes the ambient clock at the sharp stop and keeps the rail still afterwards", () => {
    expect(driftClock(13_999)).toBeCloseTo(13_999, 5);
    expect(driftClock(14_300)).toBe(driftClock(16_000));
    const a = snapshot(format, 14_500);
    const b = snapshot(format, 16_000);
    for (let i = 0; i < scene.a; i++) {
      expect(b.x[i]).toBe(a.x[i]);
      expect(b.y[i]).toBe(a.y[i]);
    }
  });

  it("brings the two index tips together at the contact", () => {
    const before = snapshot(format, T.approachFrom - 1);
    const after = snapshot(format, T.contactAt);
    const tips = scene.handsTips;
    const nearest = (buffer: ReturnType<typeof snapshot>, side: number) => {
      let best = Infinity;
      let bx = 0;
      for (let i = 0; i < scene.n; i++) {
        if (scene.handsSide[i] !== side) continue;
        const d = Math.hypot(scene.handsX[i]! - (side < 0 ? tips.left[0] : tips.right[0]), scene.handsY[i]! - (side < 0 ? tips.left[1] : tips.right[1]));
        if (d < best) {
          best = d;
          bx = buffer.x[i]!;
        }
      }
      return bx;
    };
    const gapBefore = nearest(before, 1) - nearest(before, -1);
    const gapAfter = nearest(after, 1) - nearest(after, -1);
    expect(gapBefore).toBeGreaterThan(20);
    expect(Math.abs(gapAfter)).toBeLessThan(4);
  });
});

describe("shape helpers", () => {
  it("interpolates monotonically through increasing data", () => {
    const curve = monotoneCurve(DEMO.cumulative);
    let previous = -Infinity;
    for (let k = 0; k <= 100; k++) {
      const value = curve(k / 100);
      expect(value).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = value;
    }
    expect(curve(0)).toBeCloseTo(0, 5);
    expect(curve(1)).toBeCloseTo(12, 3);
  });

  it("walks the outline of a rounded rectangle", () => {
    const start = roundedRectPoint(10, 20, 200, 100, 16, 0);
    expect(start.y).toBe(20);
    const end = roundedRectPoint(10, 20, 200, 100, 16, 0.9999);
    expect(Math.hypot(end.x - start.x, end.y - start.y)).toBeLessThan(40);
  });
});
