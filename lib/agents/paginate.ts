/**
 * Reads every row of a query that can exceed the API page size (PostgREST
 * answers at most `max_rows` = 1000 rows per request).
 *
 * Used by the analytics reads (daily series, funnel history), which need the
 * rows themselves and not a count. Fails — it never truncates silently: a
 * figure computed from an incomplete list would be a wrong figure.
 */

import { ok, type Result } from "@/lib/utils/result";

import { failFromDatabase, failWith, type DatabaseErrorLike } from "./errors";

/** Same as `max_rows` in supabase/config.toml. */
export const PAGE_SIZE = 1000;
/** Safety net: 20 000 rows. Beyond that the read fails instead of growing without bound. */
export const MAX_PAGES = 20;

type PageResponse<Row> = { data: Row[] | null; error: DatabaseErrorLike | null };

export async function fetchAllPages<Row>(
  context: string,
  fetchPage: (from: number, to: number) => PromiseLike<PageResponse<Row>>,
): Promise<Result<Row[]>> {
  const rows: Row[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const response = await fetchPage(from, from + PAGE_SIZE - 1);
    if (response.error) return failFromDatabase<Row[]>(context, response.error);
    const batch = response.data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return ok(rows);
  }
  console.error(`[agents] ${context}: more than ${MAX_PAGES * PAGE_SIZE} rows, read refused rather than truncated`);
  return failWith<Row[]>("unexpected_error");
}
