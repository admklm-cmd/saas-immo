import type { TaskScope } from "../types";

/** URL of the `/taches` list for a filter and a page. Defaults are omitted. */
export function tasksHref(scope: TaskScope, offset = 0): string {
  const params = new URLSearchParams();
  if (scope !== "all") params.set("scope", scope);
  if (offset > 0) params.set("offset", String(offset));
  const query = params.toString();
  return query ? `/taches?${query}` : "/taches";
}
