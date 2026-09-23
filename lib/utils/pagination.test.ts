import { describe, expect, it } from "vitest";

import { buildPage, isRangeNotSatisfiable, paginationSchema, PAGE_LIMIT_DEFAULT } from "./pagination";

describe("paginationSchema", () => {
  it("applies the defaults", () => {
    expect(paginationSchema.parse({})).toEqual({ limit: PAGE_LIMIT_DEFAULT, offset: 0 });
  });

  it("accepts the bounds, as numbers or digit strings (URL search params)", () => {
    expect(paginationSchema.parse({ limit: 1, offset: 0 })).toEqual({ limit: 1, offset: 0 });
    expect(paginationSchema.parse({ limit: "100", offset: "5000" })).toEqual({ limit: 100, offset: 5000 });
  });

  it.each([
    { limit: 0 },
    { limit: 101 },
    { limit: 2.5 },
    { limit: -1 },
    { limit: "1e2" },
    { limit: " 10" },
    { limit: "-5" },
    { limit: true },
    { limit: null },
    { offset: -1 },
    { offset: 5001 },
    { offset: "abc" },
    { offset: {} },
    { limit: 10, extra: "x" },
  ])("refuses %o", (input) => {
    expect(paginationSchema.safeParse(input).success).toBe(false);
  });
});

describe("buildPage", () => {
  it("computes hasMore from the exact total, not from the page", () => {
    expect(buildPage([1, 2], 5, { limit: 2, offset: 0 }, "t").hasMore).toBe(true);
    expect(buildPage([5], 5, { limit: 2, offset: 4 }, "t").hasMore).toBe(false);
    expect(buildPage([], 5, { limit: 2, offset: 10 }, "t")).toEqual({
      items: [],
      total: 5,
      limit: 2,
      offset: 10,
      hasMore: false,
      generatedAt: "t",
    });
  });
});

describe("isRangeNotSatisfiable", () => {
  it("recognises only PGRST103", () => {
    expect(isRangeNotSatisfiable({ code: "PGRST103" })).toBe(true);
    expect(isRangeNotSatisfiable({ code: "42501" })).toBe(false);
    expect(isRangeNotSatisfiable(null)).toBe(false);
  });
});
