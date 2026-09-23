/**
 * French formatting helpers for the interface.
 *
 * The time zone is pinned to Europe/Paris so the server render and the browser
 * render always produce the same string (no hydration mismatch), and so the
 * agency always reads its own local time.
 */

const TIME_ZONE = "Europe/Paris";

const DATE = new Intl.DateTimeFormat("fr-FR", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const DATE_TIME = new Intl.DateTimeFormat("fr-FR", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const TIME = new Intl.DateTimeFormat("fr-FR", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});

const WEEKDAY_DATE_TIME = new Intl.DateTimeFormat("fr-FR", {
  timeZone: TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

const WEEKDAY_DATE_YEAR_TIME = new Intl.DateTimeFormat("fr-FR", {
  timeZone: TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function parse(iso: string): Date | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(iso: string): string {
  const date = parse(iso);
  return date ? DATE.format(date) : "—";
}

export function formatDateTime(iso: string): string {
  const date = parse(iso);
  return date ? DATE_TIME.format(date) : "—";
}

/**
 * "23 sept. 2026 à 10:12" (Paris time), or `null` for an unreadable value, so
 * that a sentence built around it ("Validé … le …") can drop the date instead
 * of printing a dash or a guessed one.
 */
export function formatDateAtTime(iso: string): string | null {
  const date = parse(iso);
  return date ? `${DATE.format(date)} à ${TIME.format(date)}` : null;
}

/** "lundi 6 octobre, 14:00 – 15:00" for a proposed appointment slot. */
export function formatSlot(startIso: string, endIso: string): string {
  const start = parse(startIso);
  const end = parse(endIso);
  if (!start) return "—";
  return end ? `${WEEKDAY_DATE_TIME.format(start)} – ${TIME.format(end)}` : WEEKDAY_DATE_TIME.format(start);
}

/**
 * "lundi 6 octobre 2026 à 14:00 – 15:00": same as `formatSlot`, with the year,
 * for lists that span past and future appointments.
 */
export function formatSlotWithYear(startIso: string, endIso: string): string {
  const start = parse(startIso);
  const end = parse(endIso);
  if (!start) return "—";
  return end ? `${WEEKDAY_DATE_YEAR_TIME.format(start)} – ${TIME.format(end)}` : WEEKDAY_DATE_YEAR_TIME.format(start);
}

const DAY_OF_MONTH = new Intl.DateTimeFormat("fr-FR", { timeZone: TIME_ZONE, day: "numeric" });
const SHORT_MONTH = new Intl.DateTimeFormat("fr-FR", { timeZone: TIME_ZONE, month: "short" });

/** Day of month and short month in Paris time ("6", "oct."), for a calendar tile. */
export function formatDayParts(iso: string): { day: string; month: string } | null {
  const date = parse(iso);
  return date ? { day: DAY_OF_MONTH.format(date), month: SHORT_MONTH.format(date) } : null;
}

/**
 * A measured duration, in milliseconds.
 *
 * Milliseconds are kept as the unit as long as they stay readable, because the
 * replay of an AI run must show the figure that was really measured — never a
 * rounded, prettier one (CLAUDE.md: nothing simulated is passed off as real,
 * and nothing real is dressed up).
 */
export function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const rounded = Math.round(ms);
  if (rounded < 10_000) return `${rounded} ms`;
  return `${(rounded / 1000).toFixed(1).replace(".", ",")} s (${rounded} ms)`;
}

export function formatSurface(surfaceM2: number | null): string | null {
  return surfaceM2 === null ? null : `${surfaceM2} m²`;
}
