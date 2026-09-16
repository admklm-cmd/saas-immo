/**
 * Time helpers for the agents, always in the agency's legal time zone.
 *
 * Everything that has a legal meaning in France (daily AI volume, calling
 * hours, working days) is computed in Europe/Paris, never in UTC and never in
 * the server's local time zone.
 */

import { TZDate } from "@date-fns/tz";

export const AGENCY_TIME_ZONE = "Europe/Paris";

/** Start of the current Paris calendar day, as an absolute instant. */
export function parisDayStart(now: Date = new Date()): Date {
  const zoned = new TZDate(now, AGENCY_TIME_ZONE);
  const start = new TZDate(
    zoned.getFullYear(),
    zoned.getMonth(),
    zoned.getDate(),
    0,
    0,
    0,
    0,
    AGENCY_TIME_ZONE,
  );
  return new Date(start.getTime());
}
