import { APP_TEXTS } from "@/components/texts";

import type { PilotagePeriodKey } from "../../pilotage-periods";

/**
 * Pure helpers of the boss's statistics page: they WRITE figures that the server
 * already computed (docs/design-system.md §3.5.2.G). Nothing here derives a
 * business figure: no rate, no median, no total.
 */

const TEXTS = APP_TEXTS.dashboard.pilotage;
const PARIS = "Europe/Paris";

/** The period shown when the URL says nothing (decision by default: « 1 an »). */
export const DEFAULT_PERIOD: PilotagePeriodKey = "365d";

/** Whether a number rolls from the old to the new value when the period changes (decision by default: yes). */
export const ROLLING_FIGURES = true;
/** Duration of that roll, at most 420 ms (docs §3.5.2.H). */
export const ROLLING_MS = 420;
/** Below this many requests the rate carries a caution (docs §3.5.2.E2). */
export const FEW_REQUESTS = 5;
/** Parts of the origins ring before the rest is grouped in « Autres ». */
export const MAX_NAMED_ORIGINS = 4;

/** `?periode=` values, in the order of the selector. */
export const PERIOD_URL_VALUES = { "7d": "7j", "30d": "30j", "90d": "3m", "365d": "1a" } as const satisfies Record<
  PilotagePeriodKey,
  string
>;
export const PERIOD_ORDER = ["7d", "30d", "90d", "365d"] as const satisfies readonly PilotagePeriodKey[];

/** Unknown, missing or repeated value → the default. Never coerced from another spelling. */
export function parsePeriodParam(value: string | string[] | undefined | null): PilotagePeriodKey {
  const raw = Array.isArray(value) ? value[0] : value;
  const found = PERIOD_ORDER.find((key) => PERIOD_URL_VALUES[key] === raw);
  return found ?? DEFAULT_PERIOD;
}

const dayFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: PARIS });
const shortDay = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: PARIS });
const weekday = new Intl.DateTimeFormat("fr-FR", { weekday: "short", timeZone: PARIS });
const longDay = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: PARIS });
const monthShort = new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: PARIS });
const monthLong = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: PARIS });
const timeFormat = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: PARIS });

/** « 13 oct. 2025 », Paris calendar day of an instant. */
export function formatDay(iso: string): string {
  return dayFormat.format(new Date(iso));
}

export function formatClock(iso: string): string {
  return timeFormat.format(new Date(iso));
}

/** `YYYY-MM-DD` (a Paris calendar day) → noon UTC, the same civil day whatever the browser zone. */
export function bucketDate(bucketStart: string): Date {
  return new Date(`${bucketStart}T12:00:00.000Z`);
}

export type BucketLabels = { axis: string; long: string; table: string };

/** Labels of one bucket: axis tick, tooltip title and table row, by granularity. */
export function bucketLabels(bucketStart: string, granularity: "day" | "week" | "month", total: number): BucketLabels {
  const date = bucketDate(bucketStart);
  if (granularity === "month") {
    return { axis: monthShort.format(date), long: capitalize(monthLong.format(date)), table: capitalize(monthLong.format(date)) };
  }
  if (granularity === "week") {
    const label = shortDay.format(date);
    return { axis: label, long: `Semaine du ${label}`, table: `Semaine du ${label}` };
  }
  const full = longDay.format(date);
  // A 7-day window reads best as weekdays; a 30-day one as dates.
  return { axis: total <= 7 ? weekday.format(date) : shortDay.format(date), long: capitalize(full), table: shortDay.format(date) };
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const NARROW_NBSP = " ";

/** « 8 % » with a narrow no-break space; `null` → « — » (never 0). */
export function formatPercent(rate: number | null): string {
  if (rate === null) return TEXTS.notMeasurable;
  return `${Math.round(rate * 100)}${NARROW_NBSP}%`;
}

/** Whole percent used both by the figure and by the comparison. */
export function wholePercent(rate: number | null): number | null {
  return rate === null ? null : Math.round(rate * 100);
}

/** « 47 min » · « 3 h 20 » · « 1 j 4 h » (two units at most); `null` → « — ». */
export function formatDelay(minutes: number | null): string {
  if (minutes === null) return TEXTS.notMeasurable;
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return `${total} min`;
  if (total < 24 * 60) {
    const hours = Math.floor(total / 60);
    const rest = total % 60;
    return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, "0")}`;
  }
  const days = Math.floor(total / (24 * 60));
  const hours = Math.round((total % (24 * 60)) / 60);
  return hours === 0 ? `${days} j` : `${days} j ${hours} h`;
}

/** The count of the giant figure and of the written comparisons. */
export function formatCount(value: number): string {
  return new Intl.NumberFormat("fr-FR").format(value);
}

/**
 * Comparison with the previous period, in one sentence (docs §3.5.2.G): same colour
 * whatever the sign, no arrow, no percentage. `null` when the previous period is not
 * a fair comparison: the caller says so instead of inventing a delta.
 */
export function compareCounts(current: number, previous: number, phrase: string, fair: boolean): string {
  if (!fair) return TEXTS.comparison.unavailable;
  const delta = current - previous;
  if (delta > 0) return TEXTS.comparison.up(formatCount(delta), phrase, formatCount(previous));
  if (delta < 0) return TEXTS.comparison.down(formatCount(-delta), phrase, formatCount(previous));
  return TEXTS.comparison.same(phrase, formatCount(previous));
}

/** Conversion rates compare in whole points. `null` on either side → « non mesurable ». */
export function compareRates(current: number | null, previous: number | null, phrase: string, fair: boolean): string {
  if (!fair) return TEXTS.comparison.unavailable;
  const now = wholePercent(current);
  const before = wholePercent(previous);
  if (now === null || before === null) return TEXTS.comparison.notMeasurable;
  const delta = now - before;
  const unit = (n: number) => (n > 1 ? TEXTS.comparison.pointMany : TEXTS.comparison.pointOne);
  const prev = `${before}${NARROW_NBSP}%`;
  if (delta > 0) return TEXTS.comparison.up(`${delta} ${unit(delta)}`, phrase, prev);
  if (delta < 0) return TEXTS.comparison.down(`${-delta} ${unit(-delta)}`, phrase, prev);
  return TEXTS.comparison.same(phrase, prev);
}

/** Delays compare in minutes, written like the figure. */
export function compareDelays(current: number | null, previous: number | null, phrase: string, fair: boolean): string {
  if (!fair) return TEXTS.comparison.unavailable;
  if (current === null || previous === null) return TEXTS.comparison.notMeasurable;
  const delta = Math.round(current) - Math.round(previous);
  const prev = formatDelay(previous);
  if (delta > 0) return TEXTS.comparison.up(formatDelay(delta), phrase, prev);
  if (delta < 0) return TEXTS.comparison.down(formatDelay(-delta), phrase, prev);
  return TEXTS.comparison.same(phrase, prev);
}

/** Cumulative sum of a series, oldest first: a plain running total for the chart. */
export function runningTotal(values: readonly number[]): number[] {
  let sum = 0;
  return values.map((value) => (sum += value));
}

/** Round up to the next whole step for the Y axis; never a decimal, never below `floor`. */
export function niceMax(value: number, floor = 4): number {
  return Math.max(floor, Math.ceil(value));
}

/** Whole-number marks for the horizontal grid: 0, the middle (rounded) and the top. */
export function gridTicks(max: number): number[] {
  const top = niceMax(max);
  return [...new Set([0, Math.round(top / 2), top])].sort((a, b) => a - b);
}

/** Indexes of the axis labels to show, always including the first and the last. */
export function axisIndexes(count: number, wanted: number): number[] {
  if (count <= 0) return [];
  if (count <= wanted) return Array.from({ length: count }, (_, i) => i);
  const step = (count - 1) / (wanted - 1);
  const picked = Array.from({ length: wanted }, (_, i) => Math.round(i * step));
  return [...new Set(picked)];
}
