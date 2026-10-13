import type { Database } from "@/types/database";

import type { ConsentSeed, ContactSeed, PropertySeed } from "./dataset";
import { FIXTURE_EMAIL_DOMAIN, FIXTURE_USER_IDS, fictionLandline, fictionMobile, fixtureUuid } from "./fixture-ids";


/**
 * Historical cohort of the fictitious agencies: about twenty-four months of
 * plausible activity, so that the dashboard curves, the pipeline funnel and the
 * boss's statistics page are computed from rows that look like a real
 * agency's, not from a handful of hand-written contacts.
 *
 * Properties of this module:
 *  - PURE and DETERMINISTIC: a seeded generator (mulberry32) and relative
 *    dates only. The same `now` always yields exactly the same rows, so the
 *    identifiers (derived from stable labels) never change between reloads.
 *  - 100 % invented: names are combinations of two lists, e-mails are on the
 *    reserved `.test` domain, phones are in the Arcep fiction blocks, streets
 *    carry "(fictive)".
 *  - It only writes what the application itself writes: a contact, its
 *    property, its consents, the inbound lead it came from, Léa / Hugo / Sarah
 *    activities (always `is_simulation = true`), appointments, open follow-up
 *    tasks, and the journal trace of Emma's follow-up drafts / Louis's
 *    appointment proposals with the human decision on each (JOURNAL ENTRIES
 *    ONLY: no `outbound_messages` row is written, so no queue, count or
 *    "message to validate" list changes). It never forges `contact_stage_changed` (reserved to the human RPC)
 *    and never writes `ai_agent_runs` (their `started_at` is stamped by the
 *    database, so they could not be dated in the past — and they would eat
 *    today's daily AI volume limit).
 *  - A signed mandate is ALWAYS a human act: a `mandate_signed` activity whose
 *    actor is a member of the agency, never an agent.
 *  - Seasonality: arrivals follow a plausible real-estate year (busy spring and
 *    "rentrée", quiet August and end of December), more on weekdays, a few
 *    spikes. Signed mandates are dated FIRST (spread over the year) and their
 *    dossier is created one to three months before: an old dossier is mostly
 *    closed (signed or lost), a dossier still in progress is recent.
 */

type Tables = Database["public"]["Tables"];
type Enums = Database["public"]["Enums"];
type Stage = Enums["pipeline_stage"];
type Source = Enums["contact_source"];
type UserKey = keyof typeof FIXTURE_USER_IDS;

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

/** Stages of the sales journey, in order (`perdu` is outside of it). */
export const HISTORY_FUNNEL_STAGES = [
  "nouveau",
  "qualifie",
  "chaud",
  "rdv_planifie",
  "estimation_faite",
  "mandat_signe",
] as const;

export type HistoryFunnelStage = (typeof HISTORY_FUNNEL_STAGES)[number];

export type HistoryPlan = {
  agency: "a" | "b";
  /** Prefix of the contact keys (and so of every identifier). */
  prefix: string;
  /** Seed of the generator. */
  seed: number;
  /** Contacts that are still in the pipeline, by current stage (`mandat_signe` = signed). */
  stages: Record<HistoryFunnelStage, number>;
  /** Contacts now `perdu`, by the furthest stage they had reached. */
  lostAt: Record<HistoryFunnelStage, number>;
  /** Contacts that arrived today (they are part of `stages.nouveau`). */
  todayArrivals: number;
  /** Oldest creation age (days) of a lost dossier. */
  maxAgeDays: number;
  /** Signed mandates are dated within the last `signedWithinDays` days. */
  signedWithinDays: number;
  /**
   * Dossiers of the year BEFORE (older than a year, so all closed): signed
   * mandates and lost dossiers by furthest stage. Optional.
   */
  previousYear?: {
    signed: number;
    lostAt: Record<HistoryFunnelStage, number>;
    /** Oldest creation age (days) of a lost dossier of that year. */
    maxAgeDays: number;
    /** Its signed mandates are dated between a year and `signedWithinDays` days ago. */
    signedWithinDays: number;
  };
  /** First 4-digit block of the fiction phone numbers of this cohort. */
  phoneBase: number;
  users: readonly UserKey[];
  /** Share of the advisors' dossiers, aligned with `users` (relative weights). */
  advisorWeights: readonly number[];
  /** Write appointments (agency A only: B stays small). */
  withAppointments: boolean;
  /** Write an open follow-up task on most open dossiers (agency A only). */
  withOpenTasks: boolean;
  /**
   * Write the journal trace of Emma's follow-up drafts (with the human decision
   * on each) and of Louis's appointment proposals (agency A only).
   */
  withRelationActivities: boolean;
  /** Inbound leads that are not a contact (spam) / a duplicate of one. */
  extraRejectedLeads: number;
  extraDuplicateLeads: number;
  /** First index of the unique last names used (A and B never share one). */
  nameOffset: number;
};

export const HISTORY_PLAN_A: HistoryPlan = {
  agency: "a",
  prefix: "hist-a",
  seed: 20261011,
  stages: { nouveau: 6, qualifie: 8, chaud: 5, rdv_planifie: 3, estimation_faite: 3, mandat_signe: 22 },
  lostAt: { nouveau: 88, qualifie: 60, chaud: 36, rdv_planifie: 22, estimation_faite: 14, mandat_signe: 0 },
  todayArrivals: 2,
  maxAgeDays: 364,
  signedWithinDays: 362,
  // The year before: a slightly less active agency (about 10 % fewer requests),
  // every dossier closed. The oldest ones go back beyond two years so the
  // history covers the whole previous period of a one-year comparison.
  previousYear: {
    signed: 18,
    lostAt: { nouveau: 97, qualifie: 64, chaud: 38, rdv_planifie: 23, estimation_faite: 15, mandat_signe: 0 },
    maxAgeDays: 752,
    signedWithinDays: 700,
  },
  phoneBase: 3000,
  users: ["agentA", "directorA", "ownerA"],
  advisorWeights: [46, 30, 24],
  withAppointments: true,
  withOpenTasks: true,
  withRelationActivities: true,
  extraRejectedLeads: 9,
  extraDuplicateLeads: 7,
  nameOffset: 0,
};

export const HISTORY_PLAN_B: HistoryPlan = {
  agency: "b",
  prefix: "hist-b",
  seed: 20261012,
  stages: { nouveau: 2, qualifie: 2, chaud: 1, rdv_planifie: 0, estimation_faite: 0, mandat_signe: 1 },
  lostAt: { nouveau: 2, qualifie: 2, chaud: 1, rdv_planifie: 0, estimation_faite: 0, mandat_signe: 0 },
  todayArrivals: 0,
  maxAgeDays: 300,
  signedWithinDays: 120,
  previousYear: {
    signed: 1,
    lostAt: { nouveau: 1, qualifie: 2, chaud: 1, rdv_planifie: 0, estimation_faite: 0, mandat_signe: 0 },
    maxAgeDays: 560,
    signedWithinDays: 500,
  },
  phoneBase: 4000,
  users: ["userB"],
  advisorWeights: [1],
  withAppointments: false,
  withOpenTasks: false,
  withRelationActivities: false,
  extraRejectedLeads: 0,
  extraDuplicateLeads: 0,
  nameOffset: 70,
};

export type HistoryCohort = {
  seeds: ContactSeed[];
  activities: Tables["activities"]["Insert"][];
  inboundLeads: Tables["inbound_leads"]["Insert"][];
  appointments: Tables["appointments"]["Insert"][];
  tasks: Tables["tasks"]["Insert"][];
};


// -----------------------------------------------------------------------------
// Seeded generator
// -----------------------------------------------------------------------------
export type Rng = {
  next: () => number;
  int: (min: number, max: number) => number;
  chance: (probability: number) => boolean;
  pick: <T>(items: readonly T[]) => T;
  weighted: (weights: readonly number[]) => number;
  shuffle: <T>(items: readonly T[]) => T[];
};

/** mulberry32: tiny, fast, and fully reproducible from its seed. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
  const int = (min: number, max: number): number => min + Math.floor(next() * (max - min + 1));
  return {
    next,
    int,
    chance: (probability) => next() < probability,
    pick: (items) => items[Math.floor(next() * items.length)]!,
    weighted: (weights) => {
      const total = weights.reduce((sum, weight) => sum + weight, 0);
      let cursor = next() * total;
      for (const [index, weight] of weights.entries()) {
        cursor -= weight;
        if (cursor < 0) return index;
      }
      return weights.length - 1;
    },
    shuffle: (items) => {
      const copy = [...items];
      for (let index = copy.length - 1; index > 0; index -= 1) {
        const other = int(0, index);
        [copy[index], copy[other]] = [copy[other]!, copy[index]!];
      }
      return copy;
    },
  };
}

// -----------------------------------------------------------------------------
// Vocabulary (invented)
// -----------------------------------------------------------------------------
const FIRST_NAMES = [
  "Antoine", "Béatrice", "Cédric", "Delphine", "Emmanuel", "Fabienne", "Gérard", "Hélène", "Ismaël", "Jocelyne",
  "Karim", "Lucie", "Mathieu", "Nathalie", "Océane", "Philippe", "Quentin", "Rachel", "Sébastien", "Tiphaine",
  "Urbain", "Valérie", "Wilfried", "Xavier", "Yasmine", "Zoé", "Adrien", "Brigitte", "Claude", "Dominique",
  "Estelle", "Florent", "Gaëlle", "Hugo", "Inès", "Jérôme", "Kévin", "Laetitia", "Maxime", "Nadège",
  "Olivia", "Pascal", "Roxane", "Stéphanie", "Thomas", "Ursula", "Vincent", "Yann", "Aurélien", "Corinne",
  "David", "Émilie", "Frédérique", "Guillaume", "Hakim", "Isabelle", "Julie", "Loïc", "Magali", "Noémie",
] as const;

const LAST_NAMES = [
  "Abadie", "Arnaud", "Baudoin", "Bertrand", "Blanc", "Bonifay", "Bruno", "Cardona", "Carpentier", "Cassar",
  "Chabert", "Clément", "Combes", "Dagorne", "Daumas", "Deschamps", "Dupuy", "Escoffier", "Fontaine", "Gaillard",
  "Giraud", "Granier", "Guichard", "Imbert", "Jourdan", "Kherfi", "Laborde", "Lacroix", "Lemoine", "Magnan",
  "Marti", "Maurel", "Michel", "Moulin", "Navarre", "Olivier", "Pages", "Paoli", "Payan", "Peyre",
  "Pellegrin", "Quilici", "Raynaud", "Reboul", "Ricard", "Rolland", "Salvi", "Segura", "Tessier", "Tomasi",
  "Turc", "Ughetto", "Vallier", "Vasseur", "Verdier", "Vial", "Villard", "Yvon", "Zanotti", "Ferrand",
  "Hamon", "Lefèvre", "Meyer", "Nicolas", "Rousseau", "Simon", "Texier", "Barthelemy", "Colombo", "Dufour",
  "Espinasse","Fournier", "Gomez", "Henry", "Joly", "Klein", "Lopes", "Morel", "Noel", "Orsini",
] as const;

type Commune = {
  city: string;
  postalCode: string;
  weight: number;
  sectors: readonly string[];
  /** Order of magnitude of the price per m², in euros (invented). */
  pricePerM2: number;
};

const COMMUNES: readonly Commune[] = [
  {
    city: "La Ciotat",
    postalCode: "13600",
    weight: 36,
    sectors: ["La Ciotat — Centre", "La Ciotat — Port", "La Ciotat — Gare", "La Ciotat — Plage", "La Ciotat — Fardeloup", "La Ciotat — Roumagoua"],
    pricePerM2: 4400,
  },
  {
    city: "Cassis",
    postalCode: "13260",
    weight: 15,
    sectors: ["Cassis — Centre", "Cassis — Hauteurs", "Cassis — Presqu'île", "Cassis — Port"],
    pricePerM2: 6900,
  },
  {
    city: "Ceyreste",
    postalCode: "13600",
    weight: 9,
    sectors: ["Ceyreste — Village", "Ceyreste — Coteaux"],
    pricePerM2: 4000,
  },
  {
    city: "Saint-Cyr-sur-Mer",
    postalCode: "83270",
    weight: 13,
    sectors: ["Saint-Cyr-sur-Mer — Les Lecques", "Saint-Cyr-sur-Mer — Coteaux", "Saint-Cyr-sur-Mer — Centre"],
    pricePerM2: 4900,
  },
  {
    city: "Carnoux-en-Provence",
    postalCode: "13470",
    weight: 7,
    sectors: ["Carnoux — Centre", "Carnoux — Pinède"],
    pricePerM2: 3800,
  },
  {
    city: "Roquefort-la-Bédoule",
    postalCode: "13830",
    weight: 6,
    sectors: ["Roquefort — Village", "Roquefort — Les Hauts"],
    pricePerM2: 3600,
  },
  {
    city: "Aubagne",
    postalCode: "13400",
    weight: 14,
    sectors: ["Aubagne — Centre", "Aubagne — Les Défensions", "Aubagne — La Tourtelle"],
    pricePerM2: 3100,
  },
];

const STREETS = [
  "rue des Pêcheurs", "avenue des Mimosas", "chemin des Cigales", "boulevard des Lecques", "impasse des Figuiers",
  "traverse des Oliviers", "rue du Marché", "avenue de la Gare", "chemin du Vallon", "rue de la Source",
  "allée des Tamaris", "chemin de la Colle", "rue Saint-Jean", "avenue du Mistral", "montée des Pins",
  "chemin des Restanques", "rue de l'Horloge", "quai des Chantiers", "avenue des Aloès", "rue des Lavandières",
] as const;

const MOTIVATIONS = [
  "Succession : partage entre héritiers",
  "Mutation professionnelle",
  "Achat d'un bien plus grand",
  "Départ à la retraite",
  "Divorce : vente du bien commun",
  "Investissement locatif revendu",
  "Rapprochement familial",
  "Déménagement hors région",
  "Achat d'une maison avec jardin",
  "Vente d'une résidence secondaire",
  "Achat d'un bien plus petit",
  "Besoin de trésorerie",
] as const;

const TIMELINES = ["Sous 2 mois", "Sous 3 mois", "Sous 4 mois", "Sous 6 mois", "6 à 12 mois", "12 mois", "Pas de date arrêtée"] as const;

const LOST_REASONS: Record<HistoryFunnelStage, readonly string[]> = {
  nouveau: ["Injoignable après plusieurs tentatives.", "Demande sans suite : simple curiosité sur le prix du marché."],
  qualifie: ["Projet de vente reporté d'un an.", "A confié le bien à une autre agence.", "Bien retiré de la vente."],
  chaud: ["A confié le bien à une autre agence.", "Vente entre particuliers finalement retenue."],
  rdv_planifie: ["Rendez-vous annulé : projet abandonné.", "Rendez-vous annulé : a choisi une autre agence."],
  estimation_faite: ["Prix attendu trop éloigné de l'estimation : n'a pas donné suite."],
  mandat_signe: [],
};

/**
 * Origin of the requests: not uniform. The online estimation dominates, then
 * the website form and the phone; recommendations are a solid minority; the
 * partner feed (portals / partners) and the desk walk-ins (`manual_entry`) are
 * smaller. Only values of the real `contact_source` enum.
 */
const SOURCE_WEIGHTS: readonly [Source, number][] = [
  ["estimation_form", 38],
  ["website_form", 13],
  ["inbound_call", 14],
  ["inbound_email", 6],
  ["referral", 12],
  ["partner_api", 7],
  ["software_import", 3],
  ["manual_entry", 7],
];


/** Sources that arrive as a raw lead in Léa's inbox before becoming a contact. */
const LEAD_SOURCES: ReadonlySet<Source> = new Set<Source>(["estimation_form", "website_form", "inbound_email", "partner_api"]);

const FORM_IDS: Partial<Record<Source, string>> = {
  estimation_form: "estimation-web",
  website_form: "contact-web",
  inbound_email: "inbound-mailbox",
  partner_api: "partner-feed",
};

// -----------------------------------------------------------------------------
// Time helpers
// -----------------------------------------------------------------------------
const MIN_START_MINUTE = 7 * 60 + 5; // 07:05 UTC = 08:05 / 09:05 Paris
const MAX_START_MINUTE = 17 * 60 + 20; // 17:20 UTC = 18:20 / 19:20 Paris

/**
 * UTC calendar day `daysAgo` days before `now`, at `minuteOfDay` UTC. Business
 * hours stay between 07:00 and 18:59 UTC, so the Europe/Paris calendar day is
 * the same as the UTC day, summer time (UTC+2) or winter time (UTC+1).
 */
function utcDayAt(now: Date, daysAgo: number, minuteOfDay: number): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysAgo, 0, 0, 0, 0) + minuteOfDay * MINUTE_MS,
  );
}

function dayOfWeekUtc(now: Date, daysAgo: number): number {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysAgo)).getUTCDay();
}

/** Arrival rhythm of the requests: weekdays busy, weekends quiet. */
const WEEKDAY_WEIGHT: Record<number, number> = { 0: 0.12, 1: 1.15, 2: 1.22, 3: 1.1, 4: 1.05, 5: 0.92, 6: 0.32 };
/** Mandates are signed on working days, almost never on a Sunday. */
const SIGNING_WEEKDAY_WEIGHT: Record<number, number> = { 0: 0.02, 1: 1, 2: 1.05, 3: 1, 4: 1.05, 5: 0.9, 6: 0.18 };
/** Real-estate seasonality, January to December: busy spring and "rentrée", quiet August and December. */
const MONTH_WEIGHT: readonly number[] = [0.85, 0.95, 1.15, 1.3, 1.3, 1.2, 0.95, 0.55, 1.2, 1.2, 0.95, 0.7];
/** Days (counted back from today) with a visible peak: a mailing, a press article… */
const SPIKE_DAYS: ReadonlySet<number> = new Set([
  6, 13, 22, 36, 58, 77, 104, 131, 160, 188, 215, 246, 301, 337, 379, 418, 455, 497, 531, 574, 612, 655, 689, 712,
]);

function seasonFactor(date: Date): number {
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  let weight = MONTH_WEIGHT[month]!;
  if ((month === 11 && day >= 20) || (month === 0 && day <= 2)) weight *= 0.45; // end-of-year break
  if (month === 7 && day >= 8 && day <= 22) weight *= 0.7; // mid-August
  return weight;
}

/** Weight of each day back from today (index 0 = yesterday), for arrivals or for signatures. */
function dayWeights(now: Date, horizonDays: number, mode: "arrival" | "signing"): number[] {
  const weights: number[] = [];
  for (let daysAgo = 1; daysAgo <= horizonDays; daysAgo += 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysAgo));
    const dow = date.getUTCDay();
    let weight = (mode === "arrival" ? WEEKDAY_WEIGHT[dow] : SIGNING_WEEKDAY_WEIGHT[dow]) ?? 1;
    weight *= seasonFactor(date);
    if (mode === "arrival") {
      if (SPIKE_DAYS.has(daysAgo)) weight *= 2.2;
    }
    weights.push(weight);
  }
  return weights;
}

/** A day back in [min, max], drawn with the given weights. */
function drawDay(rng: Rng, weights: readonly number[], min: number, max: number): number {
  const slice = weights.slice(min - 1, Math.min(max, weights.length));
  return min + rng.weighted(slice);
}

/**
 * `count` days back in [min, max], one per equal slice of the cumulative weight
 * (stratified sampling): irregular, but spread over the whole year and its
 * seasonality instead of clumping by chance. Shuffled before use.
 */
function stratifiedDays(rng: Rng, weights: readonly number[], min: number, max: number, count: number): number[] {
  const slice = weights.slice(min - 1, Math.min(max, weights.length));
  const total = slice.reduce((sum, weight) => sum + weight, 0);
  const days: number[] = [];
  let accumulated = 0;
  let index = 0;
  for (let rank = 0; rank < count; rank += 1) {
    const target = ((rank + rng.next()) / count) * total;
    while (index < slice.length - 1 && accumulated + slice[index]! <= target) {
      accumulated += slice[index]!;
      index += 1;
    }
    days.push(min + index);
  }
  return rng.shuffle(days);
}

function isoOf(date: Date): string {
  return date.toISOString();
}

function isWeekend(date: Date): boolean {
  return [0, 6].includes(date.getUTCDay());
}

/** Moves a Saturday / Sunday back to the previous Friday. */
function previousWeekday(date: Date): Date {
  let result = date;
  while (isWeekend(result)) result = new Date(result.getTime() - DAY_MS);
  return result;
}

/** Moves a Saturday / Sunday forward to the next Monday. */
function nextWeekday(date: Date): Date {
  let result = date;
  while (isWeekend(result)) result = new Date(result.getTime() + DAY_MS);
  return result;
}

/** Next event of a chain: later than `previous`, never after `latest`. */
function followUp(rng: Rng, previous: Date, minDays: number, maxDays: number, latest: Date): Date {
  const candidate = utcDayAt(previous, -rng.int(minDays, maxDays), rng.int(7 * 60, 18 * 60 + 40));
  const floor = previous.getTime() + 3 * MINUTE_MS;
  const ceiling = latest.getTime();
  if (candidate.getTime() >= floor && candidate.getTime() <= ceiling) return candidate;
  return new Date(Math.min(ceiling, Math.max(floor, ceiling - rng.int(2, 40) * MINUTE_MS)));
}

// -----------------------------------------------------------------------------
// Draft contacts
// -----------------------------------------------------------------------------
type Draft = {
  index: number;
  key: string;
  ageDays: number;
  createdAt: Date;
  /** Current stage. */
  stage: Stage;
  /** Furthest funnel stage ever reached (equals `stage` unless `perdu`). */
  furthest: HistoryFunnelStage;
  /** Instant of the human confirmation of the mandate (signed dossiers only). */
  signedAt: Date | null;
};

/** Age range (days) of a dossier that is STILL in the pipeline at a stage: an open dossier is recent. */
const OPEN_AGE_RANGE: Record<Exclude<HistoryFunnelStage, "mandat_signe">, readonly [number, number]> = {
  nouveau: [1, 16],
  qualifie: [2, 60],
  chaud: [5, 85],
  rdv_planifie: [9, 95],
  estimation_faite: [22, 150],
};
/** Minimal age (days) of a dossier lost after reaching that stage. */
const MIN_AGE_LOST: Record<HistoryFunnelStage, number> = {
  nouveau: 4,
  qualifie: 6,
  chaud: 10,
  rdv_planifie: 16,
  estimation_faite: 28,
  mandat_signe: 60,
};
/** Time between the creation of the dossier and the signature of the mandate: 26 to 96 days. */
const MIN_CYCLE_DAYS = 26;

type Slot = { stage: Stage; furthest: HistoryFunnelStage; previous?: boolean };

/**
 * One draft per contact of the plan: when it arrived and what became of it.
 * Signed mandates are dated first (spread over the year, working days, season),
 * their dossier was created one to three months earlier. Lost dossiers are old
 * enough for the stage they reached. Open dossiers are recent.
 */
function planDrafts(rng: Rng, plan: HistoryPlan, now: Date): Draft[] {
  const slots: Slot[] = [];
  for (const stage of HISTORY_FUNNEL_STAGES) {
    for (let count = 0; count < plan.stages[stage]; count += 1) slots.push({ stage, furthest: stage });
  }
  for (const stage of HISTORY_FUNNEL_STAGES) {
    for (let count = 0; count < plan.lostAt[stage]; count += 1) slots.push({ stage: "perdu", furthest: stage });
  }
  const before = plan.previousYear;
  if (before) {
    for (let count = 0; count < before.signed; count += 1) {
      slots.push({ stage: "mandat_signe", furthest: "mandat_signe", previous: true });
    }
    for (const stage of HISTORY_FUNNEL_STAGES) {
      for (let count = 0; count < before.lostAt[stage]; count += 1) {
        slots.push({ stage: "perdu", furthest: stage, previous: true });
      }
    }
  }
  // The order only fixes which identity (name, phone…) goes with which story.
  const ordered = createRng(plan.seed ^ 0x5bd1e995).shuffle(slots);

  const horizon = Math.max(plan.maxAgeDays, plan.signedWithinDays, before?.maxAgeDays ?? 0, before?.signedWithinDays ?? 0);
  const arrival = dayWeights(now, horizon, "arrival");
  const signing = dayWeights(now, horizon, "signing");
  // A recent request is more likely to be still open than closed: fewer lost dossiers in the last months.
  const lostArrival = arrival.map((weight, index) => weight * Math.min(1, 0.4 + (index + 1) / 110));
  const signedDays = stratifiedDays(rng, signing, 2, plan.signedWithinDays, plan.stages.mandat_signe);
  const previousSignedDays = before ? stratifiedDays(rng, signing, 366, before.signedWithinDays, before.signed) : [];
  let todayLeft = plan.todayArrivals;
  let todayRank = 0;

  return ordered.map((slot, index): Draft => {
    const key = `${plan.prefix}-${String(index + 1).padStart(3, "0")}`;

    if (slot.stage === "nouveau" && todayLeft > 0) {
      todayLeft -= 1;
      const minutesAgo = todayRank === 0 ? 47 : 155 + (todayRank - 1) * 61;
      todayRank += 1;
      return {
        index,
        key,
        ageDays: 0,
        createdAt: new Date(now.getTime() - minutesAgo * MINUTE_MS),
        stage: slot.stage,
        furthest: slot.furthest,
        signedAt: null,
      };
    }

    let ageDays: number;
    let signedAt: Date | null = null;
    if (slot.stage === "mandat_signe") {
      const signedDaysAgo = (slot.previous ? previousSignedDays : signedDays).pop()!;
      ageDays = signedDaysAgo + MIN_CYCLE_DAYS + rng.int(0, 36) + rng.int(0, 34);
      signedAt = utcDayAt(now, signedDaysAgo, rng.int(8 * 60 + 30, 16 * 60 + 30));
    } else if (slot.stage === "perdu") {
      ageDays = slot.previous
        ? drawDay(rng, lostArrival, Math.max(366, MIN_AGE_LOST[slot.furthest]), before!.maxAgeDays)
        : drawDay(rng, lostArrival, MIN_AGE_LOST[slot.furthest], plan.maxAgeDays);
    } else {
      const [min, max] = OPEN_AGE_RANGE[slot.stage as keyof typeof OPEN_AGE_RANGE];
      ageDays = drawDay(rng, arrival, min, max);
    }
    const weekend = [0, 6].includes(dayOfWeekUtc(now, ageDays));
    const createdAt = utcDayAt(
      now,
      ageDays,
      weekend ? rng.int(8 * 60 + 30, 15 * 60 + 30) : rng.int(MIN_START_MINUTE, MAX_START_MINUTE),
    );
    return { index, key, ageDays, createdAt, stage: slot.stage, furthest: slot.furthest, signedAt };
  });
}


function ascii(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function pickSource(rng: Rng): Source {
  return SOURCE_WEIGHTS[rng.weighted(SOURCE_WEIGHTS.map(([, weight]) => weight))]![0];
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function describeProperty(property: PropertySeed): string {
  const kind =
    property.property_type === "house"
      ? "maison"
      : property.property_type === "land"
        ? "terrain"
        : property.property_type === "commercial"
          ? "local commercial"
          : "appartement";
  return `${kind} de ${property.surface_m2} m² à ${property.city}`;
}

/**
 * Always consumes the same draws, whatever the stage: the address, the surface
 * and the figures of a contact are the same whichever day the fixtures are
 * loaded. Only the DECISION to record an estimated value depends on the stage.
 */
function makeProperty(rng: Rng, furthest: HistoryFunnelStage, isLost: boolean): PropertySeed {
  const commune = COMMUNES[rng.weighted(COMMUNES.map((entry) => entry.weight))]!;
  const typeRoll = rng.next();
  // A residential agency: flats and houses, a few building plots, no commercial premises.
  const property_type: Enums["property_type"] = typeRoll < 0.6 ? "apartment" : typeRoll < 0.95 ? "house" : "land";
  const surfaces = [rng.int(28, 112), rng.int(72, 215), rng.int(320, 1450), rng.int(38, 170)] as const;
  const surface =
    property_type === "apartment" ? surfaces[0] : property_type === "house" ? surfaces[1] : property_type === "land" ? surfaces[2] : surfaces[3];
  const rooms =
    property_type === "apartment"
      ? Math.min(5, Math.max(1, Math.round(surface / 24)))
      : property_type === "house"
        ? Math.min(8, Math.max(3, Math.round(surface / 26)))
        : null;
  const base: PropertySeed = {
    property_type,
    address: `${rng.int(1, 64)} ${rng.pick(STREETS)} (fictive)`,
    postal_code: commune.postalCode,
    city: commune.city,
    sector: rng.pick(commune.sectors),
    surface_m2: surface,
    rooms,
  };
  const earlyRoll = rng.next();
  const midRoll = rng.next();
  const priceRoll = rng.next();
  const sourceRoll = rng.next();

  const rank = HISTORY_FUNNEL_STAGES.indexOf(furthest);
  const hasValue =
    (property_type === "apartment" || property_type === "house") &&
    (rank >= 3 || (rank >= 2 && midRoll < 0.4) || (rank >= 1 && earlyRoll < 0.18));
  if (!hasValue) return base;
  const perM2 = commune.pricePerM2 * (property_type === "house" ? 1.08 : 1) * (0.86 + priceRoll * 0.3);
  const fromAgency = rank >= 3 && !isLost ? true : sourceRoll < 0.6;
  return {
    ...base,
    estimated_value_eur: roundTo(surface * perM2, 1000),
    estimated_value_source: fromAgency ? "agency" : "owner_declared",
  };
}

function makeConsents(attr: Rng, ev: Rng, source: Source, createdAt: Date, lost: boolean, latest: Date): ConsentSeed[] {
  // Fixed draws first (identity of the register), then the stage-dependent one.
  const noneRoll = attr.next();
  const firstRoll = attr.next();
  const secondRoll = attr.next();
  const thirdRoll = attr.next();
  const fourthRoll = attr.next();
  const delays = [attr.int(1, 4), attr.int(1, 4), attr.int(1, 4), attr.int(1, 4)];
  let delayIndex = 0;
  const at = () => isoOf(new Date(createdAt.getTime() + delays[delayIndex++ % delays.length]! * MINUTE_MS));
  const grant = (channel: Enums["consent_channel"], text?: ConsentSeed["text"]): ConsentSeed => ({
    channel,
    status: "granted",
    daysAgo: 0,
    at: at(),
    source,
    text: text ?? "estimation",
  });
  const consents: ConsentSeed[] = [];

  if (noneRoll < 0.06) return consents; // nobody asked yet: no consent at all

  if (source === "estimation_form" || source === "website_form") {
    if (firstRoll < 0.95) consents.push(grant("email"));
    if (secondRoll < 0.5) consents.push(grant("sms"));
    if (thirdRoll < 0.33) consents.push(grant("phone"));
    if (fourthRoll < 0.12) consents.push(grant("whatsapp", "whatsapp"));
  } else if (source === "inbound_call") {
    if (firstRoll < 0.7) consents.push(grant("phone"));
    if (secondRoll < 0.4) consents.push(grant("email"));
  } else if (firstRoll < 0.7) {
    consents.push(grant("email"));
  }

  if (lost && consents.length > 0 && ev.chance(0.45)) {
    const target = consents[0]!;
    const span = Math.max(1, latest.getTime() - createdAt.getTime());
    const withdrawnAt = new Date(createdAt.getTime() + span * (0.4 + ev.next() * 0.4));
    consents.push({
      channel: target.channel,
      status: "withdrawn",
      daysAgo: 0,
      at: isoOf(withdrawnAt),
      source: target.channel === "email" ? "unsubscribe_link" : "stop_keyword",
    });
  }
  return consents;
}

function leadRawText(source: Source, property: PropertySeed | undefined, name: string): string {
  const what = property ? describeProperty(property) : "un bien";
  switch (source) {
    case "estimation_form":
      return `Demande d'estimation en ligne : ${what}. Contact : ${name}.`;
    case "website_form":
      return `Demande de rappel via le site au sujet de : ${what}.`;
    case "inbound_email":
      return `Email reçu : « Bonjour, je souhaite vendre ${what} et connaître votre avis de valeur. »`;
    default:
      return `Contact transmis par un partenaire (simulation) : ${what}.`;
  }
}

/**
 * Share of the requests an agent takes up within the hour (the others wait for
 * a missing detail or for the next morning). Shared with the hand-written
 * contacts so the median first-handling delay is not dragged by one cohort.
 */
export const QUICK_HANDLING_SHARE = 0.72;

type ApptPlan = {
  startsAt: Date;
  endsAt: Date;
  confirmedAt: Date;
  status: Tables["appointments"]["Insert"]["status"];
  completedAt: Date | null;
  cancelledAt: Date | null;
};

/** What each open stage's follow-up task says (the task of a dossier waiting for the advisor). */
const OPEN_TASKS: Partial<Record<Stage, { chance: number; type: string; title: string }>> = {
  nouveau: { chance: 0.45, type: "call_back_seller", title: "Rappeler le vendeur pour qualifier la demande" },
  qualifie: { chance: 0.8, type: "schedule_estimation", title: "Proposer un rendez-vous d'estimation" },
  chaud: { chance: 0.9, type: "schedule_estimation", title: "Fixer la date de l'estimation" },
  estimation_faite: { chance: 0.85, type: "follow_up_after_estimation", title: "Relancer le vendeur après l'estimation" },
};

// -----------------------------------------------------------------------------
// Emma / Louis: journal trace of their work, with the human decision on each
// -----------------------------------------------------------------------------
type Activity = Tables["activities"]["Insert"];
type MessageChannel = "email" | "sms" | "whatsapp";

/** Channels an outbound message can use (the phone is not a written channel). */
const MESSAGE_CHANNELS: readonly MessageChannel[] = ["email", "sms", "whatsapp"];
const CHANNEL_WEIGHTS: Record<MessageChannel, number> = { email: 70, sms: 22, whatsapp: 8 };
const EMMA_ANGLES = ["relance_sans_reponse", "information_marche", "demande_precision"] as const;
const EMMA_ANGLE_WEIGHTS = [45, 25, 30] as const;
/** Same codes and labels as the database trigger that audits a refusal. */
const REJECTION_REASONS: readonly [string, string][] = [
  ["inappropriate_tone", "Ton ou formulation inadaptés"],
  ["bad_timing", "Mauvais moment pour ce contact"],
  ["already_contacted", "Contact déjà relancé récemment"],
  ["incorrect_information", "Information inexacte ou absente du dossier"],
  ["other", "Autre motif"],
];
const REJECTION_REASON_WEIGHTS = [34, 26, 20, 14, 6] as const;
/** At least this long between two drafts for the same contact (and never two on the same day). */
const MIN_DAYS_BETWEEN_DRAFTS = 4;
const DRAFTED_DECISION =
  "Brouillon de relance préparé et mis en attente de validation : rien n'a été envoyé, le consentement du canal a été vérifié avant rédaction.";

type RelationInput = {
  rng: Rng;
  agencyId: string;
  contactId: string;
  key: string;
  actorUserId: string;
  consents: readonly ConsentSeed[];
  /** Latest instant any entry may take (the dossier's loss date, its last news, or "now"). */
  ceiling: Date;
};

/** A channel is usable at `at` when it was granted before and not withdrawn since. */
function consentValidAt(consents: readonly ConsentSeed[], channel: MessageChannel, at: Date): boolean {
  let valid = false;
  const events = consents
    .filter((consent) => consent.channel === channel && consent.at !== undefined)
    .sort((first, second) => Date.parse(first.at!) - Date.parse(second.at!));
  for (const consent of events) {
    if (Date.parse(consent.at!) > at.getTime()) break;
    valid = consent.status === "granted";
  }
  return valid;
}

/** First instant a channel's consent is withdrawn (or `null`). */
function withdrawalOf(consents: readonly ConsentSeed[], channel: MessageChannel): Date | null {
  const times = consents
    .filter((consent) => consent.channel === channel && consent.status === "withdrawn" && consent.at !== undefined)
    .map((consent) => Date.parse(consent.at!));
  return times.length > 0 ? new Date(Math.min(...times)) : null;
}

/**
 * Emma's follow-up drafts on a dossier that was `qualifie` / `chaud` between
 * `from` and `until`, and what a human of the agency decided about each one.
 *
 * Rules (the code's, as in the application):
 *  - a channel with a consent that is valid when the draft is prepared AND
 *    until the end of the chain (a withdrawal stops everything before it);
 *  - at most one draft per contact and per day (here at least four days apart);
 *  - nothing after the window of the stage, the loss of the dossier or a
 *    human takeover (none in this cohort: `human_takeover` is always false);
 *  - the history only holds items already processed: a draft is validated and
 *    « sent » in simulation, edited then validated, or refused. Nothing pending.
 */
export function buildEmmaActivities(input: RelationInput & { from: Date; until: Date }): Activity[] {
  const { rng, agencyId, contactId, key, actorUserId, consents } = input;
  const until = new Date(Math.min(input.until.getTime(), input.ceiling.getTime()) - MINUTE_MS);
  if (until.getTime() - input.from.getTime() < 6 * 60 * MINUTE_MS) return [];

  const countRoll = rng.next();
  const wanted = countRoll < 0.22 ? 0 : countRoll < 0.62 ? 1 : countRoll < 0.88 ? 2 : 3;
  const span = until.getTime() - input.from.getTime();
  const candidates = Array.from({ length: wanted }, () => new Date(input.from.getTime() + rng.next() * span)).sort(
    (first, second) => first.getTime() - second.getTime(),
  );

  const activities: Activity[] = [];
  let lastDraft = -Infinity;
  for (const candidate of candidates) {
    // Prepared on a weekday, during the agency's office hours.
    const draftedAt = previousWeekday(utcDayAt(candidate, 0, rng.int(8 * 60, 17 * 60)));
    const channelRoll = rng.weighted(MESSAGE_CHANNELS.map((channel) => CHANNEL_WEIGHTS[channel]));
    const angle = EMMA_ANGLES[rng.weighted(EMMA_ANGLE_WEIGHTS)]!;
    const confidence = Math.round((0.62 + rng.next() * 0.33) * 100) / 100;
    const outcomeRoll = rng.next();
    const delayMinutes = rng.int(20, 900);
    const reason = REJECTION_REASONS[rng.weighted(REJECTION_REASON_WEIGHTS)]!;
    const preferred = MESSAGE_CHANNELS[channelRoll]!;

    if (draftedAt.getTime() < input.from.getTime() || draftedAt.getTime() > until.getTime()) continue;
    if (draftedAt.getTime() - lastDraft < MIN_DAYS_BETWEEN_DRAFTS * DAY_MS) continue;
    // Preferred channel first, then any other one that is valid.
    const channel = [preferred, ...MESSAGE_CHANNELS.filter((other) => other !== preferred)].find((option) => {
      if (!consentValidAt(consents, option, draftedAt)) return false;
      const withdrawn = withdrawalOf(consents, option);
      return withdrawn === null || withdrawn.getTime() > draftedAt.getTime();
    });
    if (!channel) continue;

    // The whole chain (draft, decision, simulated send) must end while the consent still holds.
    const chainEnd = Math.min(until.getTime(), (withdrawalOf(consents, channel)?.getTime() ?? Infinity) - MINUTE_MS);
    const gap = chainEnd - draftedAt.getTime();
    if (gap < 14 * MINUTE_MS) continue;
    const total = Math.min(delayMinutes * MINUTE_MS, gap - MINUTE_MS);
    lastDraft = draftedAt.getTime();

    const label = `emma-${activities.filter((activity) => activity.type === "message_drafted").length + 1}`;
    const base = { agency_id: agencyId, contact_id: contactId, is_simulation: true as const };
    activities.push({
      ...base,
      id: fixtureUuid(`activity:${key}:${label}:drafted`),
      type: "message_drafted",
      summary: `Emma — relance : brouillon préparé (${channel}). ${DRAFTED_DECISION}`,
      payload: { agent: "emma", channel, angle, confidence, consent_checked: true },
      actor_type: "ai_agent",
      actor_agent: "emma",
      occurred_at: isoOf(draftedAt),
    });

    const human = (kind: string, at: number, type: string, summary: string, extra: Record<string, unknown> = {}): Activity => ({
      ...base,
      id: fixtureUuid(`activity:${key}:${label}:${kind}`),
      type,
      summary,
      payload: { drafted_by_agent: "emma", channel, ...extra },
      actor_type: "user",
      actor_user_id: actorUserId,
      occurred_at: isoOf(new Date(draftedAt.getTime() + at)),
    });
    const approved = "Message validé par un membre de l'agence. Rien n'a encore été envoyé.";
    const sent = "Message envoyé en simulation après validation humaine. Aucun envoi réel : aucun fournisseur n'est branché.";
    if (outcomeRoll < 0.2) {
      activities.push(
        human(
          "rejected",
          total,
          "message_rejected",
          `Message refusé par un membre de l'agence : il ne partira pas. Motif : ${reason[1]}.`,
          { rejection_reason: reason[0], rejection_reason_label: reason[1], rejection_note: null },
        ),
      );
    } else {
      const edited = outcomeRoll < 0.45;
      if (edited) {
        activities.push(
          human("edited", Math.round(total * 0.4), "message_edited", "Message réécrit par un membre de l'agence avant validation."),
        );
      }
      activities.push(human("approved", total - 2 * MINUTE_MS < 0 ? total : total - 2 * MINUTE_MS, "message_approved", approved));
      activities.push(human("sent", total, "message_sent_simulated", sent));
    }
  }
  return activities;
}

/**
 * Louis's appointment proposal that preceded an appointment of the history: the
 * slot offered is the appointment's own, and the human confirmation is the
 * `appointment_confirmed` entry already written for it. Skipped when no
 * written channel had a valid consent at that time (the advisor booked by phone).
 */
export function buildLouisActivity(
  input: RelationInput & {
    appointmentId: string;
    startsAt: Date;
    endsAt: Date;
    confirmedAt: Date;
    /** The dossier was qualified / hot from this instant. */
    floor: Date;
  },
): Activity | null {
  const { rng, consents } = input;
  const bookedByPhone = rng.chance(0.14);
  const preferred = MESSAGE_CHANNELS[rng.weighted(MESSAGE_CHANNELS.map((channel) => CHANNEL_WEIGHTS[channel]))]!;
  const offered = rng.int(3, 5);
  const confidence = Math.round((0.66 + rng.next() * 0.3) * 100) / 100;
  const leadMinutes = rng.int(40, 2 * 24 * 60);

  const gap = input.confirmedAt.getTime() - input.floor.getTime();
  if (bookedByPhone || gap < 12 * MINUTE_MS) return null;
  const proposedAt = new Date(input.confirmedAt.getTime() - Math.min(leadMinutes * MINUTE_MS, Math.floor(gap * 0.85)));
  if (proposedAt.getTime() <= input.floor.getTime()) return null;
  const channel = [preferred, ...MESSAGE_CHANNELS.filter((other) => other !== preferred)].find((option) => {
    if (!consentValidAt(consents, option, input.confirmedAt)) return false;
    const withdrawn = withdrawalOf(consents, option);
    return withdrawn === null || withdrawn.getTime() > input.confirmedAt.getTime();
  });
  if (!channel) return null;
  return {
    id: fixtureUuid(`activity:${input.key}:louis-proposed`),
    agency_id: input.agencyId,
    contact_id: input.contactId,
    type: "appointment_proposed",
    summary:
      "Louis — rendez-vous : créneau proposé. Rendez-vous créé en « proposé » et message mis en attente de validation : rien n'est envoyé.",
    payload: {
      agent: "louis",
      channel,
      appointment_id: input.appointmentId,
      starts_at: isoOf(input.startsAt),
      ends_at: isoOf(input.endsAt),
      offered_slots: offered,
      confidence,
    },
    actor_type: "ai_agent",
    actor_agent: "louis",
    is_simulation: true,
    occurred_at: isoOf(proposedAt),
  };
}

export function buildHistoricalCohort(plan: HistoryPlan, now: Date): HistoryCohort {
  const rng = createRng(plan.seed);
  const latest = new Date(now.getTime() - 90_000);
  const agencyId = plan.agency === "a" ? fixtureUuid("agency:calanques-immobilier") : fixtureUuid("agency:test-isolation");

  // --- 1. When does each contact arrive, and what became of it? ---------------
  const drafts = planDrafts(rng, plan, now);

  // --- 2. Everything else about each contact -----------------------------------
  // Identity (names, source, phone, property, consents) comes from per-contact
  // streams that do not depend on the load date: a contact keeps its name, its
  // e-mail and its address whichever day the fixtures are reloaded. Only its
  // dates move with "now".
  const lastNames = createRng(plan.seed ^ 0x9e3779b1).shuffle(LAST_NAMES.slice(0, LAST_NAMES.length));
  const extra = createRng(plan.seed + 777);
  const seeds: ContactSeed[] = [];
  const activities: Tables["activities"]["Insert"][] = [];
  const leads: Tables["inbound_leads"]["Insert"][] = [];
  const appointments: Tables["appointments"]["Insert"][] = [];
  const tasks: Tables["tasks"]["Insert"][] = [];
  const contactIdByKey = new Map<string, string>();
  // Calendar days (from today) already used by the hand-written upcoming appointments.
  const usedUpcomingDays = new Set<number>([4, 6, 11]);
  const fallbackUser: UserKey = plan.users.includes("directorA") ? "directorA" : plan.users[0]!;

  for (const draft of drafts) {
    const lost = draft.stage === "perdu";
    const signed = draft.stage === "mandat_signe";
    const attr = createRng(plan.seed * 7919 + draft.index * 104729 + 13);
    const ev = createRng(plan.seed * 104729 + draft.index * 7919 + 31);
    const source = pickSource(attr);
    // 60 first names x 80 last names, shifted every 80 contacts: no pair repeats before 320 contacts.
    const firstName = FIRST_NAMES[(draft.index * 7 + Math.floor(draft.index / 80) * 11 + plan.nameOffset) % FIRST_NAMES.length]!;
    const lastName = lastNames[(draft.index + plan.nameOffset) % lastNames.length]!;
    const slug = `${ascii(firstName)}.${ascii(lastName)}`;
    const phoneBlock = String(plan.phoneBase + draft.index).padStart(4, "0");
    const phoneRoll = attr.next();
    const phone =
      phoneRoll < 0.12 ? null : phoneRoll < 0.2 ? fictionLandline(phoneBlock) : fictionMobile(phoneBlock);
    const email = attr.chance(0.04) ? null : `${slug}@${FIXTURE_EMAIL_DOMAIN}`;

    const furthestRank = HISTORY_FUNNEL_STAGES.indexOf(draft.furthest);
    const noPropertyRoll = attr.next();
    const builtProperty = makeProperty(attr, draft.furthest, lost);
    const property = furthestRank >= 3 || noPropertyRoll >= 0.1 ? builtProperty : undefined;
    const qualified = furthestRank >= 1;
    const advisor = plan.users[attr.weighted(plan.advisorWeights)]!;
    const leaveUnassigned = attr.chance(0.4);
    // A brand-new request waits for an advisor; every dossier past it has one.
    const assigned: UserKey | null = draft.stage === "nouveau" && leaveUnassigned ? null : advisor;
    const actorUserId = FIXTURE_USER_IDS[assigned ?? fallbackUser];

    let notes = (() => {
      const what = property ? describeProperty(property) : "un bien dont la nature n'est pas précisée";
      switch (source) {
        case "estimation_form":
          return `Formulaire d'estimation en ligne : ${what}.`;
        case "website_form":
          return `Demande de rappel via le site : ${what}.`;
        case "inbound_call":
          return `Appel entrant à l'agence au sujet de : ${what}.`;
        case "inbound_email":
          return `Email reçu : souhaite vendre ${what}.`;
        case "referral":
          return `Recommandé par un client de l'agence : ${what}.`;
        case "partner_api":
          return `Contact transmis par un partenaire (simulation) : ${what}.`;
        case "software_import":
          return `Importé depuis le logiciel métier de l'agence (simulation) : ${what}.`;
        default:
          return `Fiche créée à l'accueil de l'agence : ${what}.`;
      }
    })();
    if (lost) notes += ` ${ev.pick(LOST_REASONS[draft.furthest])}`;

    const motivationRoll = attr.next();
    const motivationPick = attr.pick(MOTIVATIONS);
    const timelineRoll = attr.next();
    const timelinePick = attr.pick(TIMELINES);
    const motivation = qualified && motivationRoll < 0.88 ? motivationPick : null;
    const timeline = qualified && timelineRoll < 0.9 ? timelinePick : null;

    const contactId = fixtureUuid(`contact:${draft.key}`);
    contactIdByKey.set(draft.key, contactId);
    const propertyId = property ? fixtureUuid(`property:${draft.key}`) : null;
    const created = draft.createdAt;

    // --- Inbound lead (the raw request, processed by Léa) ------------------------
    const leadId = fixtureUuid(`lead:${draft.key}`);
    if (LEAD_SOURCES.has(source)) {
      const leadAt = new Date(created.getTime() - ev.int(2, 9) * MINUTE_MS);
      leads.push({
        id: leadId,
        agency_id: agencyId,
        source,
        raw_text: leadRawText(source, property, `${firstName} ${lastName}`),
        payload: {
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          city: property?.city ?? null,
          form_id: FORM_IDS[source] ?? null,
        },
        status: "processed",
        contact_id: contactId,
        created_at: isoOf(leadAt),
      });
      activities.push({
        id: fixtureUuid(`activity:${draft.key}:from-lead`),
        agency_id: agencyId,
        contact_id: contactId,
        type: "contact_created_from_lead",
        summary: "Léa — acquisition : fiche créée à partir de la demande reçue (simulation).",
        payload: { agent: "lea", lead_id: leadId, lead_source: source },
        actor_type: "ai_agent",
        actor_agent: "lea",
        is_simulation: true,
        occurred_at: isoOf(new Date(created.getTime() + MINUTE_MS)),
      });
    }

    // --- The dossier's story (times only) ------------------------------------------
    let qualifiedAt: Date | null = null;
    let hotAt: Date | null = null;
    let directToHot = false;
    let estimatedAt: Date | null = null;
    let appt: ApptPlan | null = null;
    let cursor = created;

    const makeAppointment = (afterHot: Date, start: Date, status: ApptPlan["status"]): ApptPlan => {
      const endsAt = new Date(start.getTime() + 60 * MINUTE_MS);
      const confirmedAt = new Date(
        Math.min(
          start.getTime() - 30 * MINUTE_MS,
          Math.max(afterHot.getTime() + 5 * MINUTE_MS, start.getTime() - ev.int(1, 4) * DAY_MS),
        ),
      );
      return {
        startsAt: start,
        endsAt,
        confirmedAt: new Date(Math.min(confirmedAt.getTime(), latest.getTime())),
        status,
        completedAt: status === "done" ? new Date(Math.min(endsAt.getTime() + ev.int(20, 120) * MINUTE_MS, latest.getTime())) : null,
        cancelledAt:
          status === "cancelled" ? new Date(Math.min(start.getTime() - 2 * 60 * MINUTE_MS, latest.getTime())) : null,
      };
    };

    if (signed && draft.signedAt) {
      // Planned backwards from the human signature: every step falls between
      // the creation and the signature, whatever the length of the cycle.
      const signedAt = draft.signedAt;
      const span = signedAt.getTime() - created.getTime();
      const quick = ev.chance(QUICK_HANDLING_SHARE);
      const lag = quick ? ev.int(4, 70) * MINUTE_MS : ev.int(180, 2880) * MINUTE_MS;
      qualifiedAt = new Date(created.getTime() + Math.min(lag, span * 0.1));
      directToHot = ev.chance(0.2);
      const hotRoll = ev.next();
      if (!directToHot) hotAt = new Date(Math.max(qualifiedAt.getTime() + 5 * MINUTE_MS, created.getTime() + span * (0.1 + hotRoll * 0.12)));
      const afterHot = hotAt ?? qualifiedAt;
      const apptRoll = ev.next();
      const hour = ev.pick([8 * 60, 9 * 60 + 30, 11 * 60, 13 * 60 + 30, 15 * 60]);
      let start = previousWeekday(utcDayAt(new Date(created.getTime() + span * (0.34 + apptRoll * 0.26)), 0, hour));
      if (start.getTime() < afterHot.getTime() + 6 * 60 * MINUTE_MS) {
        start = nextWeekday(utcDayAt(new Date(afterHot.getTime() + 2 * DAY_MS), 0, hour));
      }
      if (plan.withAppointments && propertyId) {
        appt = makeAppointment(afterHot, start, "done");
        estimatedAt = new Date(appt.completedAt!.getTime() + ev.int(20, 600) * MINUTE_MS);
        cursor = estimatedAt;
      } else {
        cursor = afterHot;
      }
    } else {
      // Missing-information flag by Hugo: a request he cannot qualify (no stage move).
      if (furthestRank === 0 && draft.ageDays >= 1 && ev.chance(0.9)) {
        const flaggedAt = new Date(
          Math.min(
            latest.getTime(),
            created.getTime() + (ev.chance(QUICK_HANDLING_SHARE) ? ev.int(5, 180) * MINUTE_MS : ev.int(180, 2880) * MINUTE_MS),
          ),
        );
        activities.push({
          id: fixtureUuid(`activity:${draft.key}:missing`),
          agency_id: agencyId,
          contact_id: contactId,
          type: "ai_information_missing",
          summary: "Hugo a signalé des informations manquantes : le dossier attend un complément (simulation).",
          payload: { agent: "hugo", missing: ["motivation", "timeline"] },
          actor_type: "ai_agent",
          actor_agent: "hugo",
          is_simulation: true,
          occurred_at: isoOf(flaggedAt),
        });
        cursor = flaggedAt;
      }
      if (furthestRank >= 1) {
        const span = Math.max(MINUTE_MS * 10, latest.getTime() - created.getTime());
        const quick = ev.chance(QUICK_HANDLING_SHARE);
        const lag = quick ? ev.int(4, 70) * MINUTE_MS : ev.int(180, 2880) * MINUTE_MS;
        qualifiedAt = new Date(Math.min(created.getTime() + lag, created.getTime() + span * 0.5));
        directToHot = furthestRank >= 2 && ev.chance(0.2);
        cursor = qualifiedAt;
        if (furthestRank >= 2 && !directToHot) {
          hotAt = followUp(ev, cursor, 1, 8, latest);
          cursor = hotAt;
        }
      }
      if (plan.withAppointments && furthestRank >= 3 && propertyId) {
        const confirmedStillAhead = draft.stage === "rdv_planifie";
        let start: Date;
        let status: ApptPlan["status"];
        if (confirmedStillAhead) {
          // Distinct days at 09:00 UTC: no overlap with the hand-written ones.
          let offset = 2;
          start = utcDayAt(now, -offset, 9 * 60);
          while ([0, 6].includes(start.getUTCDay()) || usedUpcomingDays.has(offset)) {
            offset += 1;
            start = utcDayAt(now, -offset, 9 * 60);
          }
          usedUpcomingDays.add(offset);
          status = "confirmed";
        } else {
          start = followUp(ev, cursor, 2, 9, new Date(latest.getTime() - 2 * DAY_MS));
          start = previousWeekday(utcDayAt(start, 0, ev.pick([8 * 60, 9 * 60 + 30, 11 * 60, 13 * 60 + 30, 15 * 60])));
          if (start.getTime() <= cursor.getTime()) start = new Date(cursor.getTime() + 2 * 60 * MINUTE_MS);
          status = draft.stage === "perdu" && draft.furthest === "rdv_planifie" ? "cancelled" : "done";
        }
        appt = makeAppointment(cursor, start, status);
        cursor = appt.confirmedAt;
        if (appt.cancelledAt && appt.cancelledAt.getTime() > cursor.getTime()) cursor = appt.cancelledAt;
        if (appt.completedAt) {
          cursor = appt.completedAt;
          if (furthestRank >= 4) {
            estimatedAt = new Date(Math.min(appt.completedAt.getTime() + ev.int(20, 600) * MINUTE_MS, latest.getTime()));
            cursor = estimatedAt;
          }
        }
      }
    }

    // --- Rows of the story ----------------------------------------------------------
    const transition = (
      label: string,
      type: "ai_qualification_done" | "ai_follow_through_done",
      agent: "hugo" | "sarah",
      at: Date,
      previous: Stage,
      stage: Stage,
      extraPayload: Record<string, unknown> = {},
    ) => {
      activities.push({
        id: fixtureUuid(`activity:${draft.key}:${label}`),
        agency_id: agencyId,
        contact_id: contactId,
        type,
        summary:
          agent === "hugo"
            ? `Hugo — qualification : dossier passé à « ${stage} » (simulation).`
            : `Sarah — suivi : dossier passé à « ${stage} » après le rendez-vous (simulation).`,
        payload: { agent, previous_stage: previous, stage, ...extraPayload },
        actor_type: "ai_agent",
        actor_agent: agent,
        is_simulation: true,
        occurred_at: isoOf(at),
      });
    };

    if (qualifiedAt) transition("qualified", "ai_qualification_done", "hugo", qualifiedAt, "nouveau", directToHot ? "chaud" : "qualifie");
    if (hotAt) transition("hot", "ai_qualification_done", "hugo", hotAt, "qualifie", "chaud");

    if (appt && propertyId) {
      const appointmentId = fixtureUuid(`appointment:${draft.key}`);
      const reportNotes =
        appt.status === "done" && ev.chance(0.6)
          ? `Visite d'estimation : ${property ? describeProperty(property) : "bien"}. État général correct, le vendeur ${
              ev.chance(0.5) ? "souhaite une mise en vente rapide" : "hésite encore sur le prix de présentation"
            }. Rapport remis en main propre.`
          : null;
      appointments.push({
        id: appointmentId,
        agency_id: agencyId,
        contact_id: contactId,
        property_id: propertyId,
        assigned_user_id: actorUserId,
        status: appt.status,
        is_simulation: true,
        starts_at: isoOf(appt.startsAt),
        ends_at: isoOf(appt.endsAt),
        ...(reportNotes ? { report_notes: reportNotes, report_recorded_by: actorUserId } : {}),
      });
      activities.push({
        id: fixtureUuid(`activity:${draft.key}:appointment-confirmed`),
        agency_id: agencyId,
        contact_id: contactId,
        type: "appointment_confirmed",
        summary: "Rendez-vous d'estimation confirmé (simulation).",
        payload: { appointment_id: appointmentId, status: "confirmed" },
        actor_type: "user",
        actor_user_id: actorUserId,
        is_simulation: true,
        occurred_at: isoOf(appt.confirmedAt),
      });
      if (appt.cancelledAt) {
        activities.push({
          id: fixtureUuid(`activity:${draft.key}:appointment-cancelled`),
          agency_id: agencyId,
          contact_id: contactId,
          type: "appointment_cancelled",
          summary: "Rendez-vous annulé (simulation).",
          payload: { appointment_id: appointmentId, status: "cancelled" },
          actor_type: "user",
          actor_user_id: actorUserId,
          is_simulation: true,
          occurred_at: isoOf(appt.cancelledAt),
        });
      }
      if (appt.completedAt) {
        activities.push({
          id: fixtureUuid(`activity:${draft.key}:appointment-completed`),
          agency_id: agencyId,
          contact_id: contactId,
          type: "appointment_completed",
          summary: "Rendez-vous d'estimation réalisé (simulation).",
          payload: { appointment_id: appointmentId, status: "done" },
          actor_type: "user",
          actor_user_id: actorUserId,
          is_simulation: true,
          occurred_at: isoOf(appt.completedAt),
        });
      }
      if (estimatedAt) {
        transition("estimated", "ai_follow_through_done", "sarah", estimatedAt, "rdv_planifie", "estimation_faite", {
          appointment_id: appointmentId,
        });
      }
    }

    // --- Signed mandate: confirmed by a human, never by an agent -----------------
    if (signed && draft.signedAt) {
      activities.push({
        id: fixtureUuid(`activity:${draft.key}:mandate`),
        agency_id: agencyId,
        contact_id: contactId,
        type: "mandate_signed",
        summary: "Mandat signé, confirmé par un membre de l'agence.",
        payload: {},
        actor_type: "user",
        actor_user_id: actorUserId,
        is_simulation: true,
        occurred_at: isoOf(draft.signedAt),
      });
      cursor = draft.signedAt;
    }

    // --- Date of the last news about the dossier (loss date for a lost one) ---------
    const lossAt = lost ? followUp(ev, cursor, 1, 21, latest) : null;
    const updatedAt = lossAt ?? (cursor.getTime() > created.getTime() ? cursor : created);
    // A withdrawal, if any, happens while the dossier is still alive (before its loss date).
    const consents = makeConsents(attr, ev, source, created, lost, lossAt ?? latest);

    // --- Next action: an open follow-up task on most open dossiers ----------------
    const taskPlan = OPEN_TASKS[draft.stage];
    const taskRoll = ev.next();
    const dueOffsetDays = ev.int(-5, 6);
    const taskDelayMinutes = ev.int(5, 90);
    if (plan.withOpenTasks && taskPlan && draft.ageDays >= 1 && taskRoll < taskPlan.chance) {
      tasks.push({
        id: fixtureUuid(`task:${draft.key}:next`),
        agency_id: agencyId,
        contact_id: contactId,
        type: taskPlan.type,
        title: taskPlan.title,
        status: "open",
        assigned_user_id: FIXTURE_USER_IDS[assigned ?? fallbackUser],
        due_at: isoOf(utcDayAt(now, -dueOffsetDays, 9 * 60)),
        created_at: isoOf(new Date(Math.min(updatedAt.getTime() + taskDelayMinutes * MINUTE_MS, latest.getTime()))),
      });
    }

    // --- Emma's follow-up drafts and Louis's proposal (journal trace only) ----------
    // Own random streams: nothing drawn above (identity, dates, stages) moves.
    if (plan.withRelationActivities && qualifiedAt) {
      const relation = createRng(plan.seed * 15485863 + draft.index * 32452843 + 101);
      const common = { agencyId, contactId, key: draft.key, actorUserId, consents };
      const ceiling = lossAt ?? updatedAt;
      // Emma works on `qualifie` / `chaud` dossiers only, never on a signed one
      // (mandate), and stops when the dossier reaches the appointment stage.
      const stageEnd = appt ? appt.confirmedAt : furthestRank >= 3 ? null : ceiling;
      if (!signed && stageEnd) {
        activities.push(
          ...buildEmmaActivities({
            ...common,
            rng: relation,
            ceiling,
            from: new Date(qualifiedAt.getTime() + 3 * 60 * MINUTE_MS),
            until: stageEnd,
          }),
        );
      }
      if (appt && propertyId) {
        const proposal = buildLouisActivity({
          ...common,
          rng: relation,
          ceiling,
          appointmentId: fixtureUuid(`appointment:${draft.key}`),
          startsAt: appt.startsAt,
          endsAt: appt.endsAt,
          confirmedAt: appt.confirmedAt,
          floor: hotAt ?? qualifiedAt,
        });
        if (proposal) activities.push(proposal);
      }
    }

    seeds.push({
      key: draft.key,
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      source,
      stage: draft.stage,
      notes,
      sale_motivation: motivation,
      sale_timeline: timeline,
      human_takeover: false,
      assigned,
      createdDaysAgo: draft.ageDays,
      createdAt: isoOf(created),
      updatedAt: isoOf(updatedAt),
      furthest: draft.furthest,
      historyManaged: true,
      ...(property ? { property } : {}),
      consents,
    });
  }

  // --- 3. Leads that never became a contact -------------------------------------
  for (let index = 0; index < plan.extraRejectedLeads; index += 1) {
    const daysAgo = 4 + index * 38 + extra.int(0, 22);
    leads.push({
      id: fixtureUuid(`lead:${plan.prefix}:rejected:${index}`),
      agency_id: agencyId,
      source: "website_form",
      raw_text: extra.pick([
        "Offre spéciale référencement de votre site en première page, cliquez ici.",
        "Je suis intéressé par une location saisonnière, pas par une vente.",
        "Test de formulaire — ne pas traiter.",
        "Message publicitaire : devis gratuit pour vos diagnostics.",
      ]),
      payload: { form_id: "contact-web" },
      status: "rejected",
      created_at: isoOf(utcDayAt(now, daysAgo, extra.int(MIN_START_MINUTE, MAX_START_MINUTE))),
    });
  }
  for (let index = 0; index < plan.extraDuplicateLeads; index += 1) {
    const target = drafts[(index * 37 + 5) % drafts.length]!;
    const duplicateAt = new Date(target.createdAt.getTime() + extra.int(2, 9) * DAY_MS);
    if (duplicateAt.getTime() > latest.getTime()) continue;
    const seed = seeds.find((candidate) => candidate.key === target.key)!;
    leads.push({
      id: fixtureUuid(`lead:${plan.prefix}:duplicate:${index}`),
      agency_id: agencyId,
      source: "website_form",
      raw_text: "Je vous ai déjà écrit, pouvez-vous me rappeler au sujet de mon bien ?",
      payload: {
        first_name: seed.first_name,
        last_name: seed.last_name,
        email: seed.email,
        phone: seed.phone,
        form_id: "contact-web",
      },
      status: "duplicate",
      contact_id: contactIdByKey.get(target.key)!,
      created_at: isoOf(duplicateAt),
    });
  }

  return { seeds, activities, inboundLeads: leads, appointments, tasks };
}
