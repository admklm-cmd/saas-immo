import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * The CSS contract of the micro-interactions, read from the stylesheet itself:
 * jsdom does not evaluate media queries, so the reduced-motion guarantees are
 * checked where they live.
 */
const css = readFileSync(fileURLToPath(new URL("./micro-interactions.css", import.meta.url)), "utf8");

function reducedMotionBlock(): string {
  const start = css.indexOf("@media (prefers-reduced-motion: reduce)");
  expect(start).toBeGreaterThan(-1);
  return css.slice(start);
}

describe("micro-interactions.css", () => {
  it("stops every decorative animation with prefers-reduced-motion", () => {
    const block = reducedMotionBlock();
    for (const selector of [
      ".simulation-badge",
      ".simulation-dot",
      ".dot-loader",
      ".pending-dots > i",
      ".error-dots",
      ".stagger > *",
      '.reveal[data-reveal="entering"]',
    ]) {
      expect(block).toContain(selector);
    }
    expect(block).toMatch(/animation:\s*none/);
  });

  it("keeps the spec timings", () => {
    expect(css).toMatch(/\.simulation-badge\s*\{\s*animation: simulation-float 3s ease-in-out infinite/);
    expect(css).toMatch(/\.simulation-dot[\s\S]*?animation: simulation-pulse 2s ease-in-out infinite/);
    expect(css).toMatch(/animation: dot-loader-turn 1\.7s linear infinite/);
    expect(css).toMatch(/animation: pending-dot-bounce 1\.5s/);
    expect(css).toMatch(/animation-delay: 0\.16s/);
    // One shake only, never a permanent blink.
    expect(css).toMatch(/animation: error-shake 0\.45s var\(--ease-standard\) 1 both/);
    expect(css).toMatch(/animation: card-arrive 550ms/);
  });

  it("keeps movements within the spec amplitudes", () => {
    const shake = css.slice(css.indexOf("@keyframes error-shake"), css.indexOf("/* --- F."));
    for (const [, px] of shake.matchAll(/translateX\((-?\d+)px\)/g)) {
      expect(Math.abs(Number(px))).toBeLessThanOrEqual(5);
    }
    const bounce = css.slice(css.indexOf("@keyframes pending-dot-bounce"), css.indexOf("/* --- D."));
    for (const [, px] of bounce.matchAll(/translateY\((-?\d+)px\)/g)) {
      expect(Math.abs(Number(px))).toBeLessThanOrEqual(7);
    }
  });
});
