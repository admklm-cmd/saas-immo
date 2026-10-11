/**
 * ROI section of the landing — pure model (docs/design-system.md §2.11.8.8
 * L4-B; figures and sources: docs/recherche-roi-agences.md). Defaults,
 * bounds, steps, calculations, rounding and the fr-FR formatting; no DOM, no
 * React, no clock. Nothing here is stored nor sent: the values live in the
 * local state of the widgets only.
 *
 * Kinds of a displayed value: `source` (published figure), `hypothesis`
 * (default value, to adjust), `estimate` (rounded calculation, shown with
 * « ≈ »). A US study is also flagged `us`.
 */

export type RoiKind = "source" | "hypothesis" | "estimate";
export type RoiTagName = RoiKind | "us";

export type SliderSpec = { min: number; max: number; step: number; defaultValue: number };

/** W1 — « Chaque minute compte » (A1, A4): no calculation. */
export const SPEED = {
  /** Odds of qualifying a lead called back in 5 min rather than 30 min (MIT/InsideSales 2007). */
  odds: 21,
  /** Odds when the contact is attempted within the hour rather than an hour later (HBR 2011). */
  hourOdds: 7,
} as const;

/** W4 — « La relance qui fait la différence » (C1): no calculation. */
export const FOLLOWUP = {
  /** Share of converted leads reached at the 6th call at the latest (Velocify), %. */
  share: 93,
  contacts: 6,
  /** Channels alternated along the six contacts (never « six calls »). */
  channels: ["email", "messages", "phone", "email", "messages", "phone"] as const,
} as const;

/** W2 — « Le temps qui vous échappe » (B1 + hypotheses). */
export const TIME = {
  negotiators: { min: 1, max: 15, step: 1, defaultValue: 4 } satisfies SliderSpec,
  hours: { min: 2, max: 10, step: 1, defaultValue: 5 } satisfies SliderSpec,
  weeks: 45,
  automatable: 0.3,
  hourlyCost: 40,
} as const;

/** W3 — « Les mandats qui partent ailleurs » (D1, D4 + hypotheses). */
export const MANDATES = {
  requests: { min: 10, max: 100, step: 5, defaultValue: 40 } satisfies SliderSpec,
  /** Share handled too late or without follow-up, in %. */
  lateShare: { min: 5, max: 30, step: 1, defaultValue: 15 } satisfies SliderSpec,
  toMandate: 0.08,
  toSale: 0.6,
  /** Median price of a flat in La Ciotat (DVF 2025), €. */
  price: 367000,
  /** Average fee, excl. VAT (FNAIM 2016). */
  fee: 0.04,
} as const;

export type TimeInput = { negotiators: number; hours: number };
export type MandatesInput = { requests: number; lateShare: number };

export const TIME_DEFAULTS: TimeInput = { negotiators: TIME.negotiators.defaultValue, hours: TIME.hours.defaultValue };
export const MANDATES_DEFAULTS: MandatesInput = {
  requests: MANDATES.requests.defaultValue,
  lateShare: MANDATES.lateShare.defaultValue,
};

/** Clamps a value into a slider's bounds and onto its step grid. */
export function clampToSlider(value: number, spec: SliderSpec): number {
  if (!Number.isFinite(value)) return spec.defaultValue;
  const stepped = spec.min + Math.round((value - spec.min) / spec.step) * spec.step;
  return Math.min(spec.max, Math.max(spec.min, stepped));
}

/** Rounds to the nearest multiple of `unit` (10, 100, 1 000…). */
export function roundTo(value: number, unit: number): number {
  return Math.round(value / unit) * unit;
}

/** Rounds to one decimal. */
export function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

export type TimeResult = {
  /** Hours of admin per year: exact product of the inputs (no « ≈ »). */
  yearlyHours: number;
  /** Raw recoverable hours (not rounded, for the tests). */
  recoverableHours: number;
  /** Raw value of the recoverable time, €. */
  value: number;
  /** Displayed: hours to the ten, euros to the hundred. */
  recoverableHoursRounded: number;
  valueRounded: number;
  /** Share of the bar that is recoverable (0–1). */
  share: number;
};

export function computeTime(input: TimeInput): TimeResult {
  const negotiators = clampToSlider(input.negotiators, TIME.negotiators);
  const hours = clampToSlider(input.hours, TIME.hours);
  const yearlyHours = negotiators * hours * TIME.weeks;
  const recoverableHours = yearlyHours * TIME.automatable;
  const value = recoverableHours * TIME.hourlyCost;
  return {
    yearlyHours,
    recoverableHours,
    value,
    recoverableHoursRounded: roundTo(recoverableHours, 10),
    valueRounded: roundTo(value, 100),
    share: TIME.automatable,
  };
}

export type MandatesResult = {
  yearlyRequests: number;
  /** Raw values (tests); displayed rounded. */
  late: number;
  mandates: number;
  sales: number;
  fees: number;
  lateRounded: number;
  mandatesRounded: number;
  salesRounded: number;
  /** Fees to the thousand, € excl. VAT. */
  feesRounded: number;
};

export function computeMandates(input: MandatesInput): MandatesResult {
  const requests = clampToSlider(input.requests, MANDATES.requests);
  const lateShare = clampToSlider(input.lateShare, MANDATES.lateShare);
  const yearlyRequests = requests * 12;
  // Integer arithmetic first: 480 × 15 / 100 = 72 exactly.
  const late = (yearlyRequests * lateShare) / 100;
  const mandates = late * MANDATES.toMandate;
  const sales = mandates * MANDATES.toSale;
  const fees = sales * MANDATES.price * MANDATES.fee;
  return {
    yearlyRequests,
    late,
    mandates,
    sales,
    fees,
    lateRounded: Math.round(late),
    mandatesRounded: roundOneDecimal(mandates),
    salesRounded: roundOneDecimal(sales),
    feesRounded: roundTo(fees, 1000),
  };
}

const INTEGER = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const ONE_DECIMAL = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** « 10 800 », « 51 000 » (narrow no-break space between thousands, fr-FR). */
export function formatInteger(value: number): string {
  return INTEGER.format(Math.round(value));
}

/** « 5,8 », « 3,5 » (decimal comma, fr-FR). */
export function formatOneDecimal(value: number): string {
  return ONE_DECIMAL.format(roundOneDecimal(value));
}

/** Fills `{key}` placeholders of a text template. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

/** True when an input differs from its defaults (the « Valeurs par défaut » link appears). */
export function differsFromDefaults<T extends Record<string, number>>(input: T, defaults: T): boolean {
  return Object.keys(defaults).some((key) => input[key] !== defaults[key]);
}

/**
 * Durations of the arrival of each widget, ms (L4-B « Mouvement »): every
 * end ≤ 1 600 ms after the start, so ≤ 1 840 ms after the 40 % threshold.
 */
export const ARRIVAL_END_MS = { speed: 1220, time: 1300, mandates: 1600, followup: 1120 } as const;
/** Delay between the 40 % threshold and the start of a widget, ms. */
export const ARRIVAL_DELAY_MS = 240;
/** Share of a widget that must be visible for its arrival to start. */
export const ARRIVAL_THRESHOLD = 0.4;
/** A slider change: each number goes from its displayed value to the new one in 320 ms. */
export const CHANGE_MS = 320;
/** The live region announces the result this long after the last slider change, ms. */
export const ANNOUNCE_DELAY_MS = 500;

/** Splits a template around `{value}`: « ≈ {value} € HT » → [« ≈ », « € HT »] (trimmed). */
export function splitTemplate(template: string): [string, string] {
  const [before = "", after = ""] = template.split("{value}");
  return [before.trim(), after.trim()];
}
