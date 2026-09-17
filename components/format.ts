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

/** "lundi 6 octobre, 14:00 – 15:00" for a proposed appointment slot. */
export function formatSlot(startIso: string, endIso: string): string {
  const start = parse(startIso);
  const end = parse(endIso);
  if (!start) return "—";
  return end ? `${WEEKDAY_DATE_TIME.format(start)} – ${TIME.format(end)}` : WEEKDAY_DATE_TIME.format(start);
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
