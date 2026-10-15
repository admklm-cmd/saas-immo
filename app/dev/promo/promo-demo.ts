import { buildFixtures } from "@/fixtures/dataset";

/**
 * The figures of plan 5 are read from the demonstration fixtures (docs/motion/promo-2026-10.md §4):
 * nothing is typed here. Server side only (the fixtures use node:crypto); the page passes this plain
 * object to the client stage.
 */
export type PromoDemo = {
  /** Cumulative requests received day by day over the last 30 days (last value = total). */
  cumulative: number[];
  received: number;
  /** Dossiers still being worked: neither signed nor lost. */
  openDossiers: number;
  appointmentsPlanned: number;
  mandatesConfirmed: number;
};

/** Reference instant of the demonstration (fixed: the film must not depend on the clock). */
export const DEMO_NOW = "2026-09-23T10:00:00.000Z";
const DAY_MS = 86_400_000;
const WINDOW_DAYS = 30;
const CLOSED_STAGES = ["mandat_signe", "perdu"];

type ContactLike = { created_at?: string | null; stage?: string | null };

export function buildDemoFigures(contacts: readonly ContactLike[], now: number): PromoDemo {
  const perDay = new Array<number>(WINDOW_DAYS).fill(0);
  for (const contact of contacts) {
    if (!contact.created_at) continue;
    const age = Math.floor((now - Date.parse(contact.created_at)) / DAY_MS);
    if (age >= 0 && age < WINDOW_DAYS) perDay[WINDOW_DAYS - 1 - age]! += 1;
  }
  let running = 0;
  const cumulative = perDay.map((count) => (running += count));
  return {
    cumulative,
    received: running,
    openDossiers: contacts.filter((contact) => contact.stage !== undefined && contact.stage !== null && !CLOSED_STAGES.includes(contact.stage)).length,
    appointmentsPlanned: contacts.filter((contact) => contact.stage === "rdv_planifie").length,
    mandatesConfirmed: contacts.filter((contact) => contact.stage === "mandat_signe").length,
  };
}

export function loadPromoDemo(): PromoDemo {
  const now = Date.parse(DEMO_NOW);
  return buildDemoFigures(buildFixtures(new Date(now)).a.contacts, now);
}
