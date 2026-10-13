/**
 * Boss's statistics page — types returned by `getDashboardPilotage(period)`.
 *
 * Every figure is computed from rows actually recorded (CLAUDE.md: never
 * invented). A block whose computation failed is `{ status: "unavailable" }`:
 * display « Indisponible », never a zero. One unavailable block never hides the
 * others. `null` inside an `ok` block means « not measurable » (no denominator,
 * no dossier measured…): display « — » with the explanation, never `0`.
 *
 * Time zone: Europe/Paris for every bucket and every boundary. Instants are
 * ISO-8601 UTC strings.
 *
 * No database change was made for this page: each rule below uses what the
 * application already records. The rules are stated next to each type so the
 * interface can explain them to the user.
 */

import type { Enums } from "@/lib/agents/types";

import type {
  PilotageBucket,
  PilotageGranularity,
  PilotagePeriodKey,
  PilotagePreviousCoverage,
  PilotageRange,
} from "./pilotage-periods";

export type { PilotageBucket, PilotageGranularity, PilotagePeriodKey, PilotagePreviousCoverage, PilotageRange };

type Stage = Enums["pipeline_stage"];
type Source = Enums["contact_source"];
type AgentName = Enums["ai_agent_name"];

/** An independent block of the page. */
export type PilotageBlock<T> = { status: "ok"; value: T } | { status: "unavailable" };

/** A figure over the period and over the previous period of the same length. */
export type PilotageComparison = {
  /** Over the current period. */
  value: number;
  /** Over the previous period (see `PilotagePeriodInfo.previousCoverage` to know if it is a fair comparison). */
  previous: number;
};

/**
 * A ratio with its numerator and denominator, so the interface can explain it
 * (« 3 mandats pour 41 demandes »). `rate` is NOT rounded and NOT capped:
 * `numerator / denominator`, `null` when the denominator is 0. It can exceed 1 on
 * a short period (mandates signed this week may come from older requests).
 */
export type PilotageRate = {
  numerator: number;
  denominator: number;
  rate: number | null;
};

/**
 * Median delay between the creation of a dossier and the first thing recorded on
 * it by an agent or a member of the agency.
 *
 *   * perimeter: dossiers CREATED in the period;
 *   * « first handling »: the earliest activity of the dossier whose author is an
 *     AI agent or a user, other than the creation of the file itself
 *     (`contact_created`, `contact_created_from_lead`), and not earlier than the
 *     creation;
 *   * a dossier nobody has touched yet is not measured (`unhandled`): it is
 *     counted apart, never as a zero delay and never silently dropped.
 *
 * `medianMinutes` is `null` when no dossier of the period was handled.
 */
export type PilotageHandlingDelay = {
  medianMinutes: number | null;
  /** Dossiers created in the period AND handled: the sample the median is computed on. */
  measured: number;
  /** Dossiers created in the period and not handled yet. */
  unhandled: number;
  /** Dossiers created in the period (= measured + unhandled). */
  created: number;
};

export type PilotageSeriesPoint = PilotageBucket & {
  /** Dossiers created in the bucket (every source). */
  received: number;
  /** Mandates signed in the bucket (see `PilotageMandatesRule`). */
  signed: number;
};

export type PilotageSeries = {
  granularity: PilotageGranularity;
  /** The current period, oldest bucket first. The last one is partial. */
  points: PilotageSeriesPoint[];
  /** The previous period, same length: `previousPoints[i]` lines up with `points[i]`. */
  previousPoints: PilotageSeriesPoint[];
};

export type PilotageOrigin = {
  source: Source;
  /** Dossiers created in the current period from this origin. */
  count: number;
  /** Same, in the previous period. */
  previousCount: number;
};

/** One stage of the cohort flow: dossiers created in the period that reached AT LEAST this stage. */
export type PilotageFlowStep = {
  stage: Exclude<Stage, "perdu">;
  reached: number;
};

/**
 * Flow of the dossiers CREATED in the period (a cohort), following them to
 * where they stand today:
 *
 *   * `entrants` — dossiers created in the period;
 *   * `steps`    — for each stage of the journey, how many reached it at least
 *     (the first step is `entrants`). A dossier still in progress reached every
 *     stage up to the one it is at; a LOST dossier reached the furthest stage its
 *     recorded history shows (same rule as the pipeline funnel); with no history
 *     it is counted at `nouveau` and reported in `lost.untraced`;
 *   * `signed`   — dossiers now at `mandat_signe`;
 *   * `lost`     — dossiers now at `perdu`, by furthest stage reached;
 *   * `inProgress` — `entrants - signed - lost.total`.
 *
 * A recent cohort has had little time to progress: do not read a short period as
 * a conversion rate (see `conversion` for the rate).
 */
export type PilotageFlow = {
  entrants: number;
  steps: PilotageFlowStep[];
  signed: number;
  inProgress: number;
  lost: {
    total: number;
    byFurthestStage: Record<Exclude<Stage, "perdu">, number>;
    /** Lost dossiers with no recorded stage history (counted at `nouveau`: a lower bound). */
    untraced: number;
    /**
     * Loss reasons: the schema has NO structured loss-reason field. The only
     * recorded motive is the free text typed by a member when moving a dossier to
     * « Perdu » (`contact_stage_changed`, `payload.reason`). `recorded` counts the
     * lost dossiers of the cohort that have one; `available: false` means none has
     * (the interface should not show a « motifs de perte » chart).
     */
    reasons: { available: boolean; recorded: number };
  };
};

/**
 * Dossiers with no next action, right now (a snapshot, independent of the period).
 *
 * Rule: a dossier is « open » at `nouveau`, `qualifie`, `chaud`, `rdv_planifie`
 * or `estimation_faite`. It has a next action when AT LEAST ONE holds:
 *   * an open task (`tasks.status = 'open'`) is attached to it;
 *   * an appointment `proposed` or `confirmed` that has not started yet;
 *   * a message `pending_validation` or `approved` (a draft waiting for a human).
 * `count` is the number of open dossiers with none of the three.
 */
export type PilotageWithoutNextAction = {
  count: number;
  /** Open dossiers (the denominator of « X sur Y »). */
  openTotal: number;
  /** The five dossiers left alone the longest (by last update), for links. */
  sample: Array<{
    contactId: string;
    /** « Contact sans nom » when the dossier has none. */
    contactName: string;
    stage: Stage;
    /** Last update of the dossier, ISO-8601 UTC. */
    updatedAt: string;
  }>;
};

/**
 * What a counter of an agent measures:
 *   * `runs`  — executions journaled in `ai_agent_runs` that STARTED in the
 *     current period (exact counts by status). `succeeded`: finished without
 *     error; `blocked`: refused by a guard rail (coupe-circuit, daily limit,
 *     human takeover…), not an error of the agent; `failed`: technical error or
 *     invalid output (the safe fallback ran); `running`: not finished.
 *     Runs are stamped by the database at the real time of the run: a demo that
 *     was loaded today only shows today's runs here.
 *   * `recordedActions` — entries the agent wrote in the CRM history
 *     (`activities` with this agent as author) dated in the current period:
 *     qualifications for Hugo, files created for Léa, follow-up drafts
 *     (`message_drafted`) for Emma, appointment proposals (`appointment_proposed`)
 *     for Louis, stage moves after a visit for Sarah. Every type authored by the
 *     agent counts, none is singled out. The human decision on a draft (validated,
 *     edited, refused, sent in simulation) is authored by a USER: it is never
 *     counted as an action of the agent. This is the agent's output over the
 *     period, whatever the date of its runs.
 *   * `lastActivityAt` — the most recent of its last run and its last history
 *     entry, whatever the period (never « jamais » just because the period is
 *     quiet). `null` only when the agent has never done anything.
 */
export type PilotageAgentActivity = {
  agent: AgentName;
  runs: { total: number; succeeded: number; blocked: number; failed: number; running: number };
  recordedActions: number;
  lastActivityAt: string | null;
};

export type PilotageAgents = {
  /** True when the agency has paused all its AI agents (coupe-circuit). */
  paused: boolean;
  /** The five agents, in the order Léa, Hugo, Emma, Louis, Sarah. */
  agents: PilotageAgentActivity[];
};

export type PilotagePeriodInfo = {
  key: PilotagePeriodKey;
  granularity: PilotageGranularity;
  timeZone: "Europe/Paris";
  current: PilotageRange;
  previous: PilotageRange;
  /** First dossier ever recorded for the agency (ISO-8601 UTC), `null` if it could not be read. */
  historyStartsAt: string | null;
  /**
   * Whether the history covers the previous period. When not `full`, show the
   * previous figures with a caveat (or hide the evolution): « historique
   * disponible depuis le … ».
   */
  previousCoverage: PilotagePreviousCoverage;
};

export type DashboardPilotage = {
  /** Instant of the read, ISO-8601 UTC. The current period ends here. */
  generatedAt: string;
  period: PilotagePeriodInfo;
  /**
   * Signed mandates in the period and in the previous one. Rule: the instant a
   * MEMBER of the agency confirmed the signature, read in the append-only history —
   * `contact_stage_changed` to `mandat_signe` authored by a user (the real
   * application path), or `mandate_signed` authored by a user (demo history). An AI
   * agent can never produce one: an entry authored by an agent is ignored. One
   * signature per dossier (the first); a signature later undone by a director (exit
   * from « Mandat signé ») is not counted, unless the dossier is signed again.
   */
  mandates: PilotageBlock<PilotageComparison>;
  /** Dossiers created in the period and in the previous one. */
  requests: PilotageBlock<PilotageComparison>;
  /**
   * Conversion request → mandate. Rule (flow ratio): mandates signed in the
   * period / dossiers created in the same period. It does not depend on how
   * long the recent requests have had to mature, so a period and its previous
   * one are comparable; it can exceed 100 % on a short period. The cohort view
   * (what became of the requests of the period) is in `flow`.
   */
  conversion: PilotageBlock<{ current: PilotageRate; previous: PilotageRate }>;
  /** Median delay of first handling, current and previous. */
  firstHandling: PilotageBlock<{ current: PilotageHandlingDelay; previous: PilotageHandlingDelay }>;
  withoutNextAction: PilotageBlock<PilotageWithoutNextAction>;
  series: PilotageBlock<PilotageSeries>;
  /** Origins of the requests, most frequent first (ties by source name). Only origins seen in either period. */
  origins: PilotageBlock<PilotageOrigin[]>;
  /** Cohort flow of the dossiers created in the current period. */
  flow: PilotageBlock<PilotageFlow>;
  agents: PilotageBlock<PilotageAgents>;
};
