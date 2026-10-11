import type { DashboardActionList, DashboardIndicator } from "../types";

/**
 * The exact `total` of an action list, as a figure. An unavailable list stays
 * unavailable: its total is never guessed from the sample.
 */
export function listTotal<TItem>(list: DashboardActionList<TItem>): DashboardIndicator<number> {
  return list.status === "ok"
    ? { status: "ok", scope: list.scope, value: list.value.total }
    : { status: "unavailable", scope: list.scope };
}
