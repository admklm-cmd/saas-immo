import { expect, it } from "vitest";

import { isAnimationGalleryEnabled } from "./guard";

it("exposes the animation gallery only outside production", () => {
  expect(isAnimationGalleryEnabled("development")).toBe(true);
  expect(isAnimationGalleryEnabled("test")).toBe(true);
  expect(isAnimationGalleryEnabled("production")).toBe(false);
});
