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

/**
 * Start of the Paris calendar day that opens a rolling window of `days` days
 * ending today, as an absolute instant.
 *
 * `parisWindowStart(1)` is `parisDayStart()` (today only), `parisWindowStart(7)`
 * is midnight Paris six days ago — the "7 derniers jours" of the Agents IA
 * screen, today included.
 *
 * The arithmetic is done on the CIVIL date, then the midnight instant is
 * resolved in Europe/Paris. Subtracting `days * 24 h` from an instant would be
 * wrong twice a year: the DST days are 23 and 25 hours long.
 */
export function parisWindowStart(days: number, now: Date = new Date()): Date {
  if (!Number.isInteger(days) || days < 1) {
    throw new RangeError(`parisWindowStart: days must be a positive integer, got ${days}`);
  }
  const zoned = new TZDate(now, AGENCY_TIME_ZONE);
  // Day overflow is handled by the Date constructor semantics (day 0 is the
  // last day of the previous month), so month and year boundaries are free.
  const start = new TZDate(
    zoned.getFullYear(),
    zoned.getMonth(),
    zoned.getDate() - (days - 1),
    0,
    0,
    0,
    0,
    AGENCY_TIME_ZONE,
  );
  return new Date(start.getTime());
}

/**
 * Current Paris calendar day as `YYYY-MM-DD`.
 *
 * Used to build idempotency keys that are stable for a whole working day
 * (`emma-<contact>-<day>`), so that two runs of the same agent on the same
 * contact on the same day cannot produce two drafts — the unique index
 * `outbound_messages_idempotency_key` refuses the second one.
 */
export function parisDayKey(now: Date = new Date()): string {
  const zoned = new TZDate(now, AGENCY_TIME_ZONE);
  const month = String(zoned.getMonth() + 1).padStart(2, "0");
  const day = String(zoned.getDate()).padStart(2, "0");
  return `${zoned.getFullYear()}-${month}-${day}`;
}
