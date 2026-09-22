import { expect, it } from "vitest";

import { BRAND } from "./brand";
import { APP_TEXTS } from "./texts";

it("is the single source the interface copy reads from", () => {
  expect(APP_TEXTS.brand).toBe(BRAND);
});

it("keeps the word mark and the full name in sync", () => {
  expect(BRAND.wordmark.join(" ")).toBe(BRAND.name);
  expect(BRAND.name.startsWith(BRAND.shortName)).toBe(true);
});

/**
 * Guard against a rename leaving a stale spelling behind: no former product
 * name may survive in the centralised copy. Extend the list on every rename.
 */
it("carries no former product name in the interface copy", () => {
  const FORMER_NAMES = ["AiaA"];
  const copy = JSON.stringify(APP_TEXTS);

  for (const formerName of FORMER_NAMES) {
    expect(copy).not.toContain(formerName);
  }
});

it("promises no live website and no figure", () => {
  const brandText = [BRAND.name, BRAND.shortName, BRAND.tagline, BRAND.prototype].join(" ");

  // The domain is not confirmed and nothing is online (CLAUDE.md, prototype).
  expect(brandText).not.toMatch(/https?:|\.fr\b|\.com\b|www\./);
  // Statistics are computed from real data only: a brand string never carries one.
  expect(brandText).not.toMatch(/[\d€%]/);
});
