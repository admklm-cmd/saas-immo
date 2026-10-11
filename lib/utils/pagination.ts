/**
 * Pagination of the server lists (tasks, appointments…).
 *
 * The page window comes from the browser (URL search params), so it is
 * validated with zod before any query: a bounded `limit` keeps each read cheap,
 * a bounded `offset` prevents deep scans requested on purpose.
 *
 * The total is never derived from the page: every paginated list returns the
 * EXACT count of the rows matching its filter (`count: "exact"`).
 */

import { z } from "zod";

export const PAGE_LIMIT_MAX = 100;
export const PAGE_OFFSET_MAX = 5_000;
export const PAGE_LIMIT_DEFAULT = 25;

/**
 * A non-negative integer given as a number, or as a string of digits (URL
 * search params). Anything else (boolean, "1e2", " 3", "-1", object) is refused
 * instead of being coerced silently.
 */
function boundedInteger(min: number, max: number) {
  return z
    .union([z.number(), z.string().regex(/^\d{1,6}$/).transform(Number)])
    .pipe(z.number().int().min(min).max(max));
}

/**
 * `limit` 1..100 (default 25), `offset` 0..5000 (default 0). Integers only.
 */
export const paginationShape = {
  limit: boundedInteger(1, PAGE_LIMIT_MAX).default(PAGE_LIMIT_DEFAULT),
  offset: boundedInteger(0, PAGE_OFFSET_MAX).default(0),
};

export const paginationSchema = z.object(paginationShape).strict();

export type PaginationInput = z.input<typeof paginationSchema>;
export type Pagination = z.output<typeof paginationSchema>;

/** One page of an exactly counted list. */
export type Page<TItem> = {
  items: TItem[];
  /** EXACT number of rows matching the filter, all pages included. */
  total: number;
  limit: number;
  offset: number;
  /** True when rows exist after this page (`offset + items.length < total`). */
  hasMore: boolean;
  /** Instant of the read, ISO-8601 UTC (reference of every "now" comparison). */
  generatedAt: string;
};

export function buildPage<TItem>(
  items: TItem[],
  total: number,
  pagination: Pagination,
  generatedAt: string,
): Page<TItem> {
  return {
    items,
    total,
    limit: pagination.limit,
    offset: pagination.offset,
    hasMore: pagination.offset + items.length < total,
    generatedAt,
  };
}

/**
 * PostgREST answers `PGRST103` (HTTP 416) when the requested range starts
 * after the last row. For a list, that is simply an empty page past the end.
 */
export function isRangeNotSatisfiable(error: { code?: string | null } | null | undefined): boolean {
  return (error?.code ?? "") === "PGRST103";
}
