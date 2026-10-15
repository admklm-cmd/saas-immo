import { expect, it } from "vitest";

import { isPromoEnabled } from "./guard";

it("exposes the promo video page only outside production", () => {
  expect(isPromoEnabled("development")).toBe(true);
  expect(isPromoEnabled("test")).toBe(true);
  expect(isPromoEnabled("production")).toBe(false);
});
