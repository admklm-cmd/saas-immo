import { afterEach, describe, expect, it, vi } from "vitest";

import { chunkArray, fetchAllByIds, fetchAllPages, IN_CHUNK_SIZE, MAX_PAGES, PAGE_SIZE } from "./paginate";

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

describe("chunkArray", () => {
  it("splits a long list into chunks of 100 ids, the last one shorter", () => {
    const chunks = chunkArray(Array.from({ length: 250 }, (_, index) => `id-${index}`));
    expect(chunks.map((chunk) => chunk.length)).toEqual([IN_CHUNK_SIZE, IN_CHUNK_SIZE, 50]);
    expect(chunks.flat()).toHaveLength(250);
  });

  it("returns no chunk for an empty list and refuses an invalid size", () => {
    expect(chunkArray([])).toEqual([]);
    expect(() => chunkArray([1], 0)).toThrow(RangeError);
  });
});

describe("fetchAllByIds", () => {
  it("makes one request per chunk and concatenates the rows in order", async () => {
    const ids = Array.from({ length: 230 }, (_, index) => `id-${index}`);
    const seen: number[] = [];
    const result = await fetchAllByIds("test", ids, async (chunk) => {
      seen.push(chunk.length);
      return { data: chunk.map((id) => ({ id })), error: null };
    });
    expect(seen).toEqual([100, 100, 30]);
    expect(result.data!.map((row) => row.id)).toEqual(ids);
  });

  it("paginates inside a chunk when a chunk holds more than a page of rows", async () => {
    const ids = Array.from({ length: 5 }, (_, index) => `id-${index}`);
    const ranges: Array<[number, number]> = [];
    const result = await fetchAllByIds("test", ids, async (_chunk, from, to) => {
      ranges.push([from, to]);
      return { data: ranges.length === 1 ? rows(PAGE_SIZE, from) : rows(2, from), error: null };
    });
    expect(ranges).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
    expect(result.data).toHaveLength(PAGE_SIZE + 2);
  });

  it("fails as soon as one chunk fails, never returning a partial list", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const ids = Array.from({ length: 250 }, (_, index) => `id-${index}`);
    let calls = 0;
    const result = await fetchAllByIds("test", ids, async (chunk) => {
      calls += 1;
      return calls === 2 ? { data: null, error: { message: "boom" } } : { data: chunk.map((id) => ({ id })), error: null };
    });
    expect(result.data).toBeNull();
    expect(calls).toBe(2);
  });

  it("returns an empty list for no id without any request", async () => {
    let calls = 0;
    const result = await fetchAllByIds("test", [], async () => {
      calls += 1;
      return { data: [], error: null };
    });
    expect(result).toEqual({ data: [], error: null });
    expect(calls).toBe(0);
  });
});
