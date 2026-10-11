/**
 * Louis — rendez-vous: free slot computation. NO database, NO AI call.
 *
 * NON-NEGOTIABLE DESIGN RULE (CLAUDE.md): the CODE computes which slots are
 * bookable; the AI only picks one from the list it is given. A slot proposed by
 * Louis is therefore, by construction:
 *
 *   * in Europe/Paris, the agency's legal time zone (never UTC, never the
 *     server's local zone);
 *   * on a working day: Monday to Friday, French public holidays excluded;
 *   * inside the agency's working windows (10:00–13:00 and 14:00–18:00),
 *     which sit inside the hours French law allows for reaching a private
 *     individual (10:00–13:00 / 14:00–20:00, Mon–Fri, no public holidays);
 *   * far enough in the future to leave the seller time to answer;
 *   * free: it overlaps no existing appointment of the agency.
 *
 * The "no double booking" rule is enforced twice: here (agency-wide, before
 * anything is written) and by the database exclusion constraint
 * `appointments_no_overlap`, which holds even when two runs race.
 */

import { TZDate } from "@date-fns/tz";

import { AGENCY_TIME_ZONE } from "@/lib/agents/time";

export const APPOINTMENT_DURATION_MINUTES = 60;

/** Working windows, in minutes from Paris midnight. */
export const WORKING_WINDOWS: readonly { readonly start: number; readonly end: number }[] = [
  { start: 10 * 60, end: 13 * 60 },
  { start: 14 * 60, end: 18 * 60 },
];

/** A slot must be at least this far away: the seller needs time to answer. */
export const MIN_LEAD_TIME_MINUTES = 24 * 60;

/** How far ahead slots are looked for. */
export const SLOT_HORIZON_DAYS = 14;

/** How many slots are offered to the agent at most. */
export const MAX_PROPOSED_SLOTS = 5;

export type BusyInterval = {
  /** ISO 8601 instant. */
  startsAt: string;
  endsAt: string;
};

export type FreeSlot = {
  /** Identifier the AI must echo back, e.g. "creneau-1". */
  id: string;
  startsAt: string;
  endsAt: string;
  /** French label shown in the prompt and in the CRM history. */
  label: string;
};

export type SlotOptions = {
  durationMinutes: number;
  leadTimeMinutes: number;
  horizonDays: number;
  maxSlots: number;
  windows: readonly { readonly start: number; readonly end: number }[];
};

export const DEFAULT_SLOT_OPTIONS: SlotOptions = {
  durationMinutes: APPOINTMENT_DURATION_MINUTES,
  leadTimeMinutes: MIN_LEAD_TIME_MINUTES,
  horizonDays: SLOT_HORIZON_DAYS,
  maxSlots: MAX_PROPOSED_SLOTS,
  windows: WORKING_WINDOWS,
};

// -----------------------------------------------------------------------------
// French public holidays
// -----------------------------------------------------------------------------

/**
 * Easter Sunday (Gregorian, "anonymous" / Meeus-Jones-Butcher algorithm).
 * Returned as a 0-based month and a day.
 */
export function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month: month - 1, day };
}

function dayKey(month: number, day: number): string {
  return `${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addDaysToCalendarDate(
  year: number,
  month: number,
  day: number,
  days: number,
): { year: number; month: number; day: number; weekday: number } {
  // Plain UTC arithmetic on a calendar date: no time zone, no DST involved.
  const shifted = new Date(Date.UTC(year, month, day) + days * 86_400_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
  };
}

/**
 * The 11 French public holidays of a given year, as "MM-DD" keys.
 * (Alsace-Moselle local holidays are deliberately not included: the agency is
 * in Provence. This must be revisited before selling outside that area.)
 */
export function frenchPublicHolidays(year: number): ReadonlySet<string> {
  const easter = easterSunday(year);
  const fromEaster = (offset: number): string => {
    const date = addDaysToCalendarDate(year, easter.month, easter.day, offset);
    return dayKey(date.month, date.day);
  };

  return new Set([
    "01-01", // Jour de l'an
    fromEaster(1), // Lundi de Pâques
    "05-01", // Fête du travail
    "05-08", // Victoire 1945
    fromEaster(39), // Ascension
    fromEaster(50), // Lundi de Pentecôte
    "07-14", // Fête nationale
    "08-15", // Assomption
    "11-01", // Toussaint
    "11-11", // Armistice 1918
    "12-25", // Noël
  ]);
}

export function isFrenchPublicHoliday(year: number, month: number, day: number): boolean {
  return frenchPublicHolidays(year).has(dayKey(month, day));
}

/** Monday to Friday, French public holidays excluded. */
export function isWorkingDay(year: number, month: number, day: number): boolean {
  const { weekday } = addDaysToCalendarDate(year, month, day, 0);
  if (weekday === 0 || weekday === 6) return false;
  return !isFrenchPublicHoliday(year, month, day);
}

// -----------------------------------------------------------------------------
// Paris wall-clock helpers
// -----------------------------------------------------------------------------

/** Calendar date of an instant, in Europe/Paris. */
export function parisCalendarDate(instant: Date): { year: number; month: number; day: number } {
  const zoned = new TZDate(instant, AGENCY_TIME_ZONE);
  return { year: zoned.getFullYear(), month: zoned.getMonth(), day: zoned.getDate() };
}

/** Absolute instant of a Paris wall-clock time. DST-safe. */
export function parisInstant(year: number, month: number, day: number, minutesFromMidnight: number): Date {
  const hours = Math.floor(minutesFromMidnight / 60);
  const minutes = minutesFromMidnight % 60;
  return new Date(new TZDate(year, month, day, hours, minutes, 0, 0, AGENCY_TIME_ZONE).getTime());
}

const DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  timeZone: AGENCY_TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const TIME_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  timeZone: AGENCY_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});

/** e.g. "mardi 22 septembre 2026, de 10:00 à 11:00 (heure de Paris)". */
export function formatSlotLabel(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  return `${DATE_FORMATTER.format(start)}, de ${TIME_FORMATTER.format(start)} à ${TIME_FORMATTER.format(end)} (heure de Paris)`;
}

// -----------------------------------------------------------------------------
// Free slots
// -----------------------------------------------------------------------------

function overlaps(startMs: number, endMs: number, busy: readonly { start: number; end: number }[]): boolean {
  return busy.some((interval) => startMs < interval.end && interval.start < endMs);
}

export type ComputeFreeSlotsInput = {
  /** Reference instant (defaults to now). */
  now?: Date;
  /** Existing `proposed` / `confirmed` appointments of the agency. */
  busy?: readonly BusyInterval[];
  options?: Partial<SlotOptions>;
};

/**
 * Bookable slots, in chronological order. Returns an empty list when nothing is
 * free: Louis then proposes nothing at all and a human takes over. An empty
 * list is a legitimate answer, never a reason to bend a rule.
 */
export function computeFreeSlots(input: ComputeFreeSlotsInput = {}): FreeSlot[] {
  const options: SlotOptions = { ...DEFAULT_SLOT_OPTIONS, ...input.options };
  const now = input.now ?? new Date();

  const busy = (input.busy ?? [])
    .map((interval) => ({ start: Date.parse(interval.startsAt), end: Date.parse(interval.endsAt) }))
    .filter((interval) => Number.isFinite(interval.start) && Number.isFinite(interval.end) && interval.end > interval.start);

  const earliestMs = now.getTime() + options.leadTimeMinutes * 60_000;
  const today = parisCalendarDate(now);
  const slots: FreeSlot[] = [];

  for (let offset = 0; offset < options.horizonDays && slots.length < options.maxSlots; offset += 1) {
    const date = addDaysToCalendarDate(today.year, today.month, today.day, offset);
    if (!isWorkingDay(date.year, date.month, date.day)) continue;

    for (const window of options.windows) {
      for (
        let minutes = window.start;
        minutes + options.durationMinutes <= window.end && slots.length < options.maxSlots;
        minutes += options.durationMinutes
      ) {
        const start = parisInstant(date.year, date.month, date.day, minutes);
        const end = parisInstant(date.year, date.month, date.day, minutes + options.durationMinutes);
        const startMs = start.getTime();
        const endMs = end.getTime();

        if (startMs < earliestMs) continue;
        if (overlaps(startMs, endMs, busy)) continue;

        const startsAt = start.toISOString();
        const endsAt = end.toISOString();
        slots.push({
          id: `creneau-${slots.length + 1}`,
          startsAt,
          endsAt,
          label: formatSlotLabel(startsAt, endsAt),
        });
      }
    }
  }

  return slots;
}
