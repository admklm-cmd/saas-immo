/**
 * Periods of the boss's statistics page: pure calendar arithmetic in Europe/Paris.
 *
 * Four periods, each compared with the PREVIOUS period of the same length:
 *
 *   key    label     buckets of the series               previous period = current shifted back by
 *   7d     7 jours   7 Paris calendar days               7 days
 *   30d    30 jours  30 Paris calendar days              30 days
 *   90d    3 mois    13 weeks (Monday to Sunday)         13 weeks (91 days)
 *   365d   1 an      12 calendar months                  12 months
 *
 * The current period always ENDS NOW, so its last bucket is partial (today, this
 * week, this month). The previous period is the current one shifted back as a
 * whole — its end included — so that the partial bucket is compared with the same
 * partial stretch of the previous period (« 3 jours écoulés de la semaine »
 * against « 3 jours écoulés de la semaine d'avant ») and not with a complete one.
 * Bucket i of the previous period lines up with bucket i of the current one.
 *
 * All arithmetic is done on the CIVIL date and the instant is resolved in
 * Europe/Paris afterwards: subtracting `n * 24 h` from an instant would be wrong
 * twice a year (23 h and 25 h days).
 *
 * Pure: no I/O, the instant is a parameter.
 */

import { TZDate } from "@date-fns/tz";
import { z } from "zod";

import { AGENCY_TIME_ZONE, parisDayKey } from "@/lib/agents/time";

export const PILOTAGE_PERIODS = ["7d", "30d", "90d", "365d"] as const;
export type PilotagePeriodKey = (typeof PILOTAGE_PERIODS)[number];

/** Strict: any other value (« 1y », « 31d », a number…) is refused, never coerced. */
export const pilotagePeriodSchema = z.enum(PILOTAGE_PERIODS);

export type PilotageGranularity = "day" | "week" | "month";

export type PilotageRange = {
  /** Inclusive, ISO-8601 UTC. */
  startsAt: string;
  /** Exclusive, ISO-8601 UTC. For the current period: the instant of the read. */
  endsAt: string;
};

/** One bucket of a series (a day, a week or a month of Europe/Paris). */
export type PilotageBucket = {
  /** Paris calendar date of the first day of the bucket, `YYYY-MM-DD`. */
  bucketStart: string;
  /** First instant of the bucket, ISO-8601 UTC (inclusive). */
  startsAt: string;
  /** End of the bucket, ISO-8601 UTC (exclusive; the instant of the read for the last bucket of a period). */
  endsAt: string;
  /** True for the bucket still running (today / this week / this month, or its image in the previous period). */
  partial: boolean;
};

export type PilotagePeriod = {
  key: PilotagePeriodKey;
  granularity: PilotageGranularity;
  timeZone: typeof AGENCY_TIME_ZONE;
  current: PilotageRange;
  previous: PilotageRange;
  currentBuckets: PilotageBucket[];
  previousBuckets: PilotageBucket[];
};

type Civil = { year: number; month: number; day: number; hour: number; minute: number; second: number; ms: number };

function civilOf(date: Date): Civil {
  const zoned = new TZDate(date, AGENCY_TIME_ZONE);
  return {
    year: zoned.getFullYear(),
    month: zoned.getMonth(),
    day: zoned.getDate(),
    hour: zoned.getHours(),
    minute: zoned.getMinutes(),
    second: zoned.getSeconds(),
    ms: zoned.getMilliseconds(),
  };
}

function instantOf(civil: Civil): Date {
  return new Date(
    new TZDate(civil.year, civil.month, civil.day, civil.hour, civil.minute, civil.second, civil.ms, AGENCY_TIME_ZONE).getTime(),
  );
}

/** Midnight Europe/Paris of the civil day `(year, month, day)`; day overflow rolls over months and years. */
function midnight(year: number, month: number, day: number): Date {
  return instantOf({ year, month, day, hour: 0, minute: 0, second: 0, ms: 0 });
}

/** The instant shifted back by `days` civil days, same wall-clock time. */
function shiftBackDays(date: Date, days: number): Date {
  const civil = civilOf(date);
  return instantOf({ ...civil, day: civil.day - days });
}

/** The instant shifted back by `months` civil months, same wall-clock time (day clamped to the target month). */
function shiftBackMonths(date: Date, months: number): Date {
  const civil = civilOf(date);
  const target = new Date(Date.UTC(civil.year, civil.month - months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return instantOf({ ...civil, year: target.getUTCFullYear(), month: target.getUTCMonth(), day: Math.min(civil.day, lastDay) });
}

function toRange(startsAt: Date, endsAt: Date): PilotageRange {
  return { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
}

function buildBuckets(starts: readonly Date[], end: Date): PilotageBucket[] {
  return starts.map((start, index) => {
    const next = starts[index + 1];
    const isLast = next === undefined;
    return {
      bucketStart: parisDayKey(start),
      startsAt: start.toISOString(),
      endsAt: (isLast ? end : next).toISOString(),
      partial: isLast,
    };
  });
}

/**
 * Bounds and buckets of a period, for the instant `now`.
 *
 * `now` is injectable for the tests; the server always uses the real instant.
 */
export function resolvePilotagePeriod(key: PilotagePeriodKey, now: Date = new Date()): PilotagePeriod {
  const today = civilOf(now);

  let granularity: PilotageGranularity;
  let currentStarts: Date[];
  let shift: (date: Date) => Date;

  if (key === "7d" || key === "30d") {
    const days = key === "7d" ? 7 : 30;
    granularity = "day";
    currentStarts = Array.from({ length: days }, (_, index) => midnight(today.year, today.month, today.day - (days - 1) + index));
    shift = (date) => shiftBackDays(date, days);
  } else if (key === "90d") {
    granularity = "week";
    // Monday of the current week (getDay: 0 = Sunday).
    const weekday = new TZDate(now, AGENCY_TIME_ZONE).getDay();
    const mondayOffset = (weekday + 6) % 7;
    currentStarts = Array.from({ length: 13 }, (_, index) =>
      midnight(today.year, today.month, today.day - mondayOffset - 7 * (12 - index)),
    );
    shift = (date) => shiftBackDays(date, 91);
  } else {
    granularity = "month";
    currentStarts = Array.from({ length: 12 }, (_, index) => midnight(today.year, today.month - 11 + index, 1));
    shift = (date) => shiftBackMonths(date, 12);
  }

  const previousStarts = currentStarts.map(shift);
  const previousEnd = shift(now);

  return {
    key,
    granularity,
    timeZone: AGENCY_TIME_ZONE,
    current: toRange(currentStarts[0]!, now),
    previous: toRange(previousStarts[0]!, previousEnd),
    currentBuckets: buildBuckets(currentStarts, now),
    previousBuckets: buildBuckets(previousStarts, previousEnd),
  };
}

/**
 * Index of the bucket holding the instant `instant` (ISO-8601), or `-1` when it
 * falls outside every bucket (or is not a valid date). Buckets are contiguous
 * and sorted; the range is `[first.startsAt, last.endsAt)`.
 */
export function bucketIndexOf(buckets: readonly PilotageBucket[], instant: string): number {
  const time = Date.parse(instant);
  if (Number.isNaN(time) || buckets.length === 0) return -1;
  if (time < Date.parse(buckets[0]!.startsAt) || time >= Date.parse(buckets[buckets.length - 1]!.endsAt)) return -1;
  for (let index = buckets.length - 1; index >= 0; index -= 1) {
    if (time >= Date.parse(buckets[index]!.startsAt)) return index;
  }
  return -1;
}

/** True when `instant` is inside `[range.startsAt, range.endsAt)`. */
export function isInRange(range: PilotageRange, instant: string): boolean {
  const time = Date.parse(instant);
  return !Number.isNaN(time) && time >= Date.parse(range.startsAt) && time < Date.parse(range.endsAt);
}

/**
 * How much of the previous period the agency's history covers.
 *
 *   * `full`    — the first recorded dossier is older than the previous period;
 *   * `partial` — the history starts inside the previous period;
 *   * `none`    — the history starts after the previous period (nothing to compare with);
 *   * `unknown` — the first dossier could not be read.
 *
 * A comparison against a previous period that the history does not fully cover
 * is not a fair one: the interface must say so instead of showing a drop.
 */
export type PilotagePreviousCoverage = "full" | "partial" | "none" | "unknown";

export function previousCoverage(historyStartsAt: string | null, previous: PilotageRange): PilotagePreviousCoverage {
  if (historyStartsAt === null) return "unknown";
  const start = Date.parse(historyStartsAt);
  if (Number.isNaN(start)) return "unknown";
  if (start <= Date.parse(previous.startsAt)) return "full";
  if (start < Date.parse(previous.endsAt)) return "partial";
  return "none";
}
