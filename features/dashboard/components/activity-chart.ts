import { APP_TEXTS } from "@/components/texts";

import type { DashboardDailyPoint } from "../types";

/**
 * Pure helpers of the « Activité sur 30 jours » card. Nothing here computes a
 * business figure: counts and totals come from the database, this file only
 * adapts them to the chart and writes them in French.
 */

const TEXTS = APP_TEXTS.dashboard.activity;
const PARIS = "Europe/Paris";

const longDay = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: PARIS });
const liveDay = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: PARIS });
const tableDay = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: PARIS });

/** A day of the chart: the Bklit chart wants a `Date` on its x axis. */
export type ActivityChartDay = { date: Date; received: number; qualified: number };

/**
 * « YYYY-MM-DD » (a Paris calendar day) → 12:00 UTC of that day. Noon UTC is
 * 13:00 or 14:00 in Paris: the same calendar day whatever the browser time zone.
 */
export function parisDayToDate(day: string): Date {
  return new Date(`${day}T12:00:00.000Z`);
}

export function toChartDays(points: readonly DashboardDailyPoint[]): ActivityChartDay[] {
  return points.map((point) => ({ date: parisDayToDate(point.date), received: point.received, qualified: point.qualified }));
}

/** No request in the whole window: the chart is replaced by one line of text. */
export function isEmptySeries(points: readonly DashboardDailyPoint[]): boolean {
  return points.every((point) => point.received === 0 && point.qualified === 0);
}

export function formatLongDay(day: string): string {
  return longDay.format(parisDayToDate(day));
}

export function formatTableDay(day: string): string {
  return tableDay.format(parisDayToDate(day));
}

/** « 12 octobre : 3 demandes reçues, 1 dossier qualifié » — the text of the live region. */
export function describeDay(point: DashboardDailyPoint): string {
  return TEXTS.liveDay(liveDay.format(parisDayToDate(point.date)), point.received, point.qualified);
}

/** Number of labels on the x axis, by chart width (a mark every 5 / 7 days, 4 on a phone). */
export function axisTickCount(width: number): number {
  if (width >= 1200) return 7;
  if (width >= 640) return 5;
  return 4;
}

/** `aspect-ratio` of the plot by chart width (docs §3.5.1.A: 4/1, 3/1, 16/10). */
export function chartAspectRatio(width: number): string {
  if (width >= 1200) return "4 / 1";
  if (width >= 640) return "3 / 1";
  return "16 / 10";
}

/**
 * Whole-number marks for the horizontal grid: 0, the middle (rounded) and the
 * top, with no repeat. A count is never drawn on a 0,5 mark.
 */
export function integerGridTicks(maxValue: number): number[] {
  const top = Math.max(1, Math.ceil(maxValue));
  return [...new Set([0, Math.round(top / 2), top])].sort((a, b) => a - b);
}

export function maxOfSeries(points: readonly DashboardDailyPoint[]): number {
  return points.reduce((max, point) => Math.max(max, point.received, point.qualified), 0);
}
