import type { Database } from "@/types/database";

import type { ConsentSeed, ContactSeed, PropertySeed } from "./dataset";
import { FIXTURE_EMAIL_DOMAIN, FIXTURE_USER_IDS, fictionLandline, fictionMobile, fixtureUuid } from "./fixture-ids";

/**
 * Historical cohort of the fictitious agencies: about three months of
 * plausible activity, so that the dashboard curve and the pipeline funnel are
 * computed from rows that look like a real agency's, not from a handful of
 * hand-written contacts.
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
 *    activities (always `is_simulation = true`), appointments. It never forges
 *    `contact_stage_changed` (reserved to the human RPC) and never writes
 *    `ai_agent_runs` (their `started_at` is stamped by the database, so they
 *    could not be dated in the past — and they would eat today's daily AI
 *    volume limit).
 *  - Arrivals are irregular: more on weekdays, quiet weekends, a few spikes,
 *    a slightly busier recent month.
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
  /** Contacts that are still in the pipeline, by current stage. */
  stages: Record<HistoryFunnelStage, number>;
  /** Contacts now `perdu`, by the furthest stage they had reached. */
  lostAt: Record<HistoryFunnelStage, number>;
  /** Contacts that arrived today (they are part of `stages.nouveau`). */
  todayArrivals: number;
  maxAgeDays: number;
  /** First 4-digit block of the fiction phone numbers of this cohort. */
  phoneBase: number;
  users: readonly UserKey[];
  /** Write appointments (agency A only: B stays small). */
  withAppointments: boolean;
  /** Inbound leads that are not a contact (spam) / a duplicate of one. */
  extraRejectedLeads: number;
  extraDuplicateLeads: number;
  /** First index of the unique last names used (A and B never share one). */
  nameOffset: number;
};

export const HISTORY_PLAN_A: HistoryPlan = {
  agency: "a",
  prefix: "hist-a",
  seed: 20260711,
  stages: { nouveau: 11, qualifie: 17, chaud: 8, rdv_planifie: 5, estimation_faite: 3, mandat_signe: 3 },
  lostAt: { nouveau: 3, qualifie: 4, chaud: 2, rdv_planifie: 2, estimation_faite: 1, mandat_signe: 0 },
  todayArrivals: 2,
  maxAgeDays: 89,
  phoneBase: 3000,
  users: ["agentA", "directorA", "ownerA"],
  withAppointments: true,
  extraRejectedLeads: 4,
  extraDuplicateLeads: 3,
  nameOffset: 0,
};

export const HISTORY_PLAN_B: HistoryPlan = {
  agency: "b",
  prefix: "hist-b",
  seed: 20260712,
  stages: { nouveau: 2, qualifie: 2, chaud: 1, rdv_planifie: 0, estimation_faite: 0, mandat_signe: 0 },
  lostAt: { nouveau: 0, qualifie: 1, chaud: 0, rdv_planifie: 0, estimation_faite: 0, mandat_signe: 0 },
  todayArrivals: 0,
  maxAgeDays: 40,
  phoneBase: 4000,
  users: ["userB"],
  withAppointments: false,
  extraRejectedLeads: 0,
  extraDuplicateLeads: 0,
  nameOffset: 70,
};

export type HistoryCohort = {
  seeds: ContactSeed[];
  activities: Tables["activities"]["Insert"][];
  inboundLeads: Tables["inbound_leads"]["Insert"][];
  appointments: Tables["appointments"]["Insert"][];
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

const SOURCE_WEIGHTS: readonly [Source, number][] = [
  ["estimation_form", 40],
  ["website_form", 14],
  ["inbound_call", 12],
  ["inbound_email", 6],
  ["referral", 10],
  ["partner_api", 5],
  ["software_import", 4],
  ["manual_entry", 9],
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
const MIN_START_MINUTE = 7 * 60 + 5; // 07:05 UTC = 09:05 Paris (summer)
const MAX_START_MINUTE = 17 * 60 + 20; // 17:20 UTC = 19:20 Paris

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

const WEEKDAY_WEIGHT: Record<number, number> = { 0: 0.12, 1: 1.15, 2: 1.22, 3: 1.1, 4: 1.05, 5: 0.92, 6: 0.32 };
/** Days (counted back from today) with a visible peak: a mailing, a press article… */
const SPIKE_DAYS: ReadonlySet<number> = new Set([6, 13, 22, 36, 58]);

function dayWeights(now: Date, maxAgeDays: number): number[] {
  const weights: number[] = [];
  for (let daysAgo = 1; daysAgo <= maxAgeDays; daysAgo += 1) {
    let weight = WEEKDAY_WEIGHT[dayOfWeekUtc(now, daysAgo)] ?? 1;
    if (daysAgo <= 29) weight *= 1.5;
    if (SPIKE_DAYS.has(daysAgo)) weight *= 3;
    weights.push(weight);
  }
  return weights;
}

function isoOf(date: Date): string {
  return date.toISOString();
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
  jitteredAge: number;
  /** Same, with a much wider jitter: recent requests are sometimes qualified within hours. */
  wideJitteredAge: number;
  createdAt: Date;
  /** Current stage. */
  stage: Stage;
  /** Furthest funnel stage ever reached (equals `stage` unless `perdu`). */
  furthest: HistoryFunnelStage;
};

/** Minimal age (days) for a contact to plausibly be at a stage. */
const MIN_AGE_STAGE: Record<HistoryFunnelStage, number> = {
  nouveau: 0,
  qualifie: 1,
  chaud: 4,
  rdv_planifie: 8,
  estimation_faite: 21,
  mandat_signe: 34,
};
/** Same, for a dossier that was lost after reaching that stage. */
const MIN_AGE_LOST: Record<HistoryFunnelStage, number> = {
  nouveau: 4,
  qualifie: 6,
  chaud: 10,
  rdv_planifie: 16,
  estimation_faite: 28,
  mandat_signe: 60,
};

const ADVANCED_FIRST = [...HISTORY_FUNNEL_STAGES].reverse();

function assignStages(rng: Rng, drafts: Draft[], plan: HistoryPlan): void {
  const unassigned = new Set(drafts.filter((draft) => draft.ageDays > 0));

  // 1. Lost dossiers: random among the contacts old enough for their stage.
  for (const stage of ADVANCED_FIRST) {
    const needed = plan.lostAt[stage];
    if (needed === 0) continue;
    const candidates = rng.shuffle([...unassigned].filter((draft) => draft.ageDays >= MIN_AGE_LOST[stage]));
    if (candidates.length < needed) throw new Error(`fixtures history: not enough old contacts for lost@${stage}`);
    for (const draft of candidates.slice(0, needed)) {
      draft.stage = "perdu";
      draft.furthest = stage;
      unassigned.delete(draft);
    }
  }

  // 2. Dossiers still in the pipeline: the oldest take the most advanced stages.
  for (const stage of ADVANCED_FIRST) {
    if (stage === "nouveau") continue;
    const needed = plan.stages[stage];
    const candidates = [...unassigned]
      .filter((draft) => draft.ageDays >= MIN_AGE_STAGE[stage])
      .sort((first, second) => {
        const key = stage === "qualifie" ? "wideJitteredAge" : "jitteredAge";
        return second[key] - first[key] || first.index - second.index;
      });
    if (candidates.length < needed) throw new Error(`fixtures history: not enough old contacts for ${stage}`);
    for (const draft of candidates.slice(0, needed)) {
      draft.stage = stage;
      draft.furthest = stage;
      unassigned.delete(draft);
    }
  }

  // 3. Whatever is left (the most recent) is new.
  const todayCount = drafts.filter((draft) => draft.ageDays === 0).length;
  if (unassigned.size + todayCount !== plan.stages.nouveau) {
    throw new Error(`fixtures history: ${unassigned.size + todayCount} "nouveau" left, plan says ${plan.stages.nouveau}`);
  }
  for (const draft of unassigned) {
    draft.stage = "nouveau";
    draft.furthest = "nouveau";
  }
}

// -----------------------------------------------------------------------------
// Builder
// -----------------------------------------------------------------------------
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
  const property_type: Enums["property_type"] =
    typeRoll < 0.6 ? "apartment" : typeRoll < 0.93 ? "house" : typeRoll < 0.97 ? "land" : "commercial";
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

export function buildHistoricalCohort(plan: HistoryPlan, now: Date): HistoryCohort {
  const rng = createRng(plan.seed);
  const latest = new Date(now.getTime() - 90_000);
  const agencyId = plan.agency === "a" ? fixtureUuid("agency:calanques-immobilier") : fixtureUuid("agency:test-isolation");

  const total =
    Object.values(plan.stages).reduce((sum, count) => sum + count, 0) +
    Object.values(plan.lostAt).reduce((sum, count) => sum + count, 0);

  // --- 1. When does each contact arrive? --------------------------------------
  const weights = dayWeights(now, plan.maxAgeDays);
  const drafts: Draft[] = [];
  for (let index = 0; index < total; index += 1) {
    const isToday = index < plan.todayArrivals;
    let createdAt: Date;
    let ageDays: number;
    if (isToday) {
      ageDays = 0;
      createdAt = new Date(now.getTime() - (index === 0 ? 47 : 155 + (index - 1) * 61) * MINUTE_MS);
    } else {
      ageDays = rng.weighted(weights) + 1;
      const weekend = [0, 6].includes(dayOfWeekUtc(now, ageDays));
      createdAt = utcDayAt(
        now,
        ageDays,
        weekend ? rng.int(8 * 60 + 30, 15 * 60 + 30) : rng.int(MIN_START_MINUTE, MAX_START_MINUTE),
      );
    }
    drafts.push({
      index,
      key: `${plan.prefix}-${String(index + 1).padStart(2, "0")}`,
      ageDays,
      jitteredAge: ageDays + (rng.next() - 0.5) * 16,
      wideJitteredAge: ageDays + (rng.next() - 0.5) * 56,
      createdAt,
      stage: "nouveau",
      furthest: "nouveau",
    });
  }

  assignStages(rng, drafts, plan);

  // --- 2. Everything else about each contact -----------------------------------
  // Identity (names, source, phone, property, consents) comes from per-contact
  // streams that do not depend on the load date: a contact keeps its name, its
  // e-mail and its address whichever day the fixtures are reloaded. Only its
  // dates and its stage move with "now".
  const lastNames = createRng(plan.seed ^ 0x9e3779b1).shuffle(LAST_NAMES.slice(0, LAST_NAMES.length));
  const extra = createRng(plan.seed + 777);
  const seeds: ContactSeed[] = [];
  const activities: Tables["activities"]["Insert"][] = [];
  const leads: Tables["inbound_leads"]["Insert"][] = [];
  const appointments: Tables["appointments"]["Insert"][] = [];
  const contactIdByKey = new Map<string, string>();
  // Calendar days (from today) already used by the hand-written upcoming appointments.
  const usedUpcomingDays = new Set<number>([4, 6, 11]);

  // Chronological order keeps the generator stable when the plan changes.
  for (const draft of drafts) {
    const lost = draft.stage === "perdu";
    const attr = createRng(plan.seed * 7919 + draft.index * 104729 + 13);
    const ev = createRng(plan.seed * 104729 + draft.index * 7919 + 31);
    const source = pickSource(attr);
    const firstName = FIRST_NAMES[(draft.index * 7 + plan.nameOffset) % FIRST_NAMES.length]!;
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
    const assigned = attr.pick(plan.users);

    const consents = makeConsents(attr, ev, source, draft.createdAt, lost, latest);

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
      createdAt: isoOf(draft.createdAt),
      furthest: draft.furthest,
      historyManaged: true,
      ...(property ? { property } : {}),
      consents,
    });
    const contactId = fixtureUuid(`contact:${draft.key}`);
    contactIdByKey.set(draft.key, contactId);
    const propertyId = property ? fixtureUuid(`property:${draft.key}`) : null;
    const assignedUserId = FIXTURE_USER_IDS[assigned];

    // --- Inbound lead (the raw request, processed by Léa) ------------------------
    const leadId = fixtureUuid(`lead:${draft.key}`);
    if (LEAD_SOURCES.has(source)) {
      const leadAt = new Date(draft.createdAt.getTime() - ev.int(2, 9) * MINUTE_MS);
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
        occurred_at: isoOf(new Date(draft.createdAt.getTime() + MINUTE_MS)),
      });
    }

    // --- Stage history: only what the application itself writes ------------------
    const transition = (
      label: string,
      type: "ai_qualification_done" | "ai_follow_through_done",
      agent: "hugo" | "sarah",
      at: Date,
      previous: Stage,
      stage: Stage,
      extra: Record<string, unknown> = {},
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
        payload: { agent, previous_stage: previous, stage, ...extra },
        actor_type: "ai_agent",
        actor_agent: agent,
        is_simulation: true,
        occurred_at: isoOf(at),
      });
    };

    let cursor = draft.createdAt;
    if (furthestRank >= 1) {
      const span = Math.max(MINUTE_MS * 10, latest.getTime() - draft.createdAt.getTime());
      const quick = ev.chance(0.55);
      const lag = quick ? ev.int(4, 70) * MINUTE_MS : ev.int(1, 3) * DAY_MS + ev.int(0, 240) * MINUTE_MS;
      const qualifiedAt = new Date(Math.min(draft.createdAt.getTime() + lag, draft.createdAt.getTime() + span * 0.5));
      const directToHot = furthestRank >= 2 && ev.chance(0.2);
      transition("qualified", "ai_qualification_done", "hugo", qualifiedAt, "nouveau", directToHot ? "chaud" : "qualifie");
      cursor = qualifiedAt;
      if (furthestRank >= 2 && !directToHot) {
        cursor = followUp(ev, cursor, 1, 8, latest);
        transition("hot", "ai_qualification_done", "hugo", cursor, "qualifie", "chaud");
      }
    }

    // --- Appointments -------------------------------------------------------------
    if (plan.withAppointments && furthestRank >= 3 && propertyId) {
      const appointmentId = fixtureUuid(`appointment:${draft.key}`);
      const confirmedStillAhead = draft.stage === "rdv_planifie";
      let startsAt: Date;
      let status: Tables["appointments"]["Insert"]["status"];
      if (confirmedStillAhead) {
        // Distinct days at 09:00 UTC: no overlap with the hand-written ones.
        let offset = 2;
        let start = utcDayAt(now, -offset, 9 * 60);
        while ([0, 6].includes(start.getUTCDay()) || usedUpcomingDays.has(offset)) {
          offset += 1;
          start = utcDayAt(now, -offset, 9 * 60);
        }
        usedUpcomingDays.add(offset);
        startsAt = start;
        status = "confirmed";
      } else {
        let guess = followUp(ev, cursor, 2, 9, new Date(latest.getTime() - 2 * DAY_MS));
        guess = utcDayAt(guess, 0, ev.pick([8 * 60, 9 * 60 + 30, 11 * 60, 13 * 60 + 30, 15 * 60]));
        while ([0, 6].includes(guess.getUTCDay())) guess = new Date(guess.getTime() - DAY_MS);
        if (guess.getTime() <= cursor.getTime()) guess = new Date(cursor.getTime() + 2 * 60 * MINUTE_MS);
        startsAt = guess;
        status = draft.stage === "perdu" && draft.furthest === "rdv_planifie" ? "cancelled" : "done";
      }
      const endsAt = new Date(startsAt.getTime() + 60 * MINUTE_MS);
      const confirmedAt = new Date(Math.max(cursor.getTime() + 5 * MINUTE_MS, Math.min(startsAt.getTime() - ev.int(1, 4) * DAY_MS, latest.getTime())));
      const reportNotes =
        status === "done" && ev.chance(0.6)
          ? `Visite d'estimation : ${property ? describeProperty(property) : "bien"}. État général correct, le vendeur ${
              ev.chance(0.5) ? "souhaite une mise en vente rapide" : "hésite encore sur le prix de présentation"
            }. Rapport remis en main propre.`
          : null;

      appointments.push({
        id: appointmentId,
        agency_id: agencyId,
        contact_id: contactId,
        property_id: propertyId,
        assigned_user_id: assignedUserId,
        status,
        is_simulation: true,
        starts_at: isoOf(startsAt),
        ends_at: isoOf(endsAt),
        ...(reportNotes ? { report_notes: reportNotes, report_recorded_by: assignedUserId } : {}),
      });
      activities.push({
        id: fixtureUuid(`activity:${draft.key}:appointment-confirmed`),
        agency_id: agencyId,
        contact_id: contactId,
        type: "appointment_confirmed",
        summary: "Rendez-vous d'estimation confirmé (simulation).",
        payload: { appointment_id: appointmentId, status: "confirmed" },
        actor_type: "user",
        actor_user_id: assignedUserId,
        is_simulation: true,
        occurred_at: isoOf(new Date(Math.min(confirmedAt.getTime(), latest.getTime()))),
      });
      cursor = new Date(Math.min(confirmedAt.getTime(), latest.getTime()));

      if (status === "cancelled") {
        activities.push({
          id: fixtureUuid(`activity:${draft.key}:appointment-cancelled`),
          agency_id: agencyId,
          contact_id: contactId,
          type: "appointment_cancelled",
          summary: "Rendez-vous annulé (simulation).",
          payload: { appointment_id: appointmentId, status: "cancelled" },
          actor_type: "user",
          actor_user_id: assignedUserId,
          is_simulation: true,
          occurred_at: isoOf(new Date(Math.min(startsAt.getTime() - 2 * 60 * MINUTE_MS, latest.getTime()))),
        });
      }
      if (status === "done") {
        const completedAt = new Date(Math.min(endsAt.getTime() + ev.int(20, 120) * MINUTE_MS, latest.getTime()));
        activities.push({
          id: fixtureUuid(`activity:${draft.key}:appointment-completed`),
          agency_id: agencyId,
          contact_id: contactId,
          type: "appointment_completed",
          summary: "Rendez-vous d'estimation réalisé (simulation).",
          payload: { appointment_id: appointmentId, status: "done" },
          actor_type: "user",
          actor_user_id: assignedUserId,
          is_simulation: true,
          occurred_at: isoOf(completedAt),
        });
        cursor = completedAt;
        if (furthestRank >= 4) {
          const followedAt = new Date(Math.min(completedAt.getTime() + ev.int(20, 600) * MINUTE_MS, latest.getTime()));
          transition("estimated", "ai_follow_through_done", "sarah", followedAt, "rdv_planifie", "estimation_faite", {
            appointment_id: appointmentId,
          });
          cursor = followedAt;
        }
      }
    }

    // --- Signed mandate: confirmed by a human, never by an agent -----------------
    if (draft.stage === "mandat_signe") {
      activities.push({
        id: fixtureUuid(`activity:${draft.key}:mandate`),
        agency_id: agencyId,
        contact_id: contactId,
        type: "mandate_signed",
        summary: "Mandat signé, confirmé par un membre de l'agence.",
        payload: {},
        actor_type: "user",
        actor_user_id: assignedUserId,
        is_simulation: true,
        occurred_at: isoOf(followUp(ev, cursor, 2, 14, latest)),
      });
    }
  }

  // --- 3. Leads that never became a contact -------------------------------------
  for (let index = 0; index < plan.extraRejectedLeads; index += 1) {
    const daysAgo = [4, 17, 31, 52][index % 4]! + Math.floor(index / 4);
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
    const target = drafts[(index * 11 + 5) % drafts.length]!;
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

  return { seeds, activities, inboundLeads: leads, appointments };
}
