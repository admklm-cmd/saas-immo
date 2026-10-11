import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchAllPages, MAX_PAGES, PAGE_SIZE } from "./paginate";

afterEach(() => {
  vi.restoreAllMocks();
});

const rows = (count: number, offset = 0) => Array.from({ length: count }, (_, index) => ({ n: offset + index }));

describe("fetchAllPages", () => {
  it("returns a short first page as is", async () => {
    const result = await fetchAllPages("test", async () => ({ data: rows(3), error: null }));
    expect(result.data).toHaveLength(3);
  });

  it("returns an empty list for no row (a real 0, not an error)", async () => {
    const result = await fetchAllPages("test", async () => ({ data: null, error: null }));
    expect(result).toEqual({ data: [], error: null });
  });

  it("walks the pages with the right ranges until a short one", async () => {
    const ranges: Array<[number, number]> = [];
    const result = await fetchAllPages("test", async (from, to) => {
      ranges.push([from, to]);
      return { data: ranges.length < 3 ? rows(PAGE_SIZE, from) : rows(7, from), error: null };
    });
    expect(ranges).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
    expect(result.data).toHaveLength(2 * PAGE_SIZE + 7);
    expect(new Set(result.data!.map((row) => row.n)).size).toBe(2 * PAGE_SIZE + 7);
  });

  it("asks for one more page when the last one is exactly full", async () => {
    let calls = 0;
    const result = await fetchAllPages("test", async (from) => {
      calls += 1;
      return { data: calls === 1 ? rows(PAGE_SIZE, from) : [], error: null };
    });
    expect(calls).toBe(2);
    expect(result.data).toHaveLength(PAGE_SIZE);
  });

  it("fails on a database error, without leaking its text", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await fetchAllPages("test", async () => ({ data: null, error: { message: "secret_internal_table" } }));
    expect(result.data).toBeNull();
    expect(JSON.stringify(result)).not.toContain("secret_internal_table");
  });

  it("fails — never truncates — beyond the page cap", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    let calls = 0;
    const result = await fetchAllPages("test", async (from) => {
      calls += 1;
      return { data: rows(PAGE_SIZE, from), error: null };
    });
    expect(calls).toBe(MAX_PAGES);
    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("unexpected_error");
  });
});
