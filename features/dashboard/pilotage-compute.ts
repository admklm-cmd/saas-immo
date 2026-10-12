/**
 * Boss's statistics page — pure computations (no I/O).
 *
 * Every rule of `pilotage-types.ts` is implemented here, on plain rows, so it
 * can be unit tested with hostile and edge-case inputs. The data layer
 * (`pilotage.ts`) only reads rows and calls these functions.
 */

import { furthestStageFromActivities } from "@/features/pipeline/funnel";
import { PIPELINE_FUNNEL_STAGES, type PipelineFunnelStage } from "@/features/pipeline/types";
import { AGENT_ORDER } from "@/lib/agents/messages";
import type { Enums } from "@/lib/agents/types";

import { bucketIndexOf, isInRange, type PilotageBucket, type PilotageRange } from "./pilotage-periods";
import type {
  PilotageAgentActivity,
  PilotageFlow,
  PilotageHandlingDelay,
  PilotageOrigin,
  PilotageRate,
  PilotageSeriesPoint,
  PilotageWithoutNextAction,
} from "./pilotage-types";

type Stage = Enums["pipeline_stage"];
type Source = Enums["contact_source"];
type AgentName = Enums["ai_agent_name"];

/** The five agents, in the order the screen shows them (the seller journey). */
export const PILOTAGE_AGENT_ORDER: readonly AgentName[] = AGENT_ORDER;

/** Stages from which a dossier is « open » (still being worked). */
export const OPEN_STAGES = ["nouveau", "qualifie", "chaud", "rdv_planifie", "estimation_faite"] as const;

/** An activity, reduced to what the statistics need (the JSON payload is already unpacked). */
export type PilotageActivityRow = {
  contactId: string | null;
  type: string;
  actorType: string;
  actorAgent: string | null;
  occurredAt: string;
  /** `payload.stage`, when it is a string. */
  stage: string | null;
  /** `payload.previous_stage`, when it is a string. */
  previousStage: string | null;
  /** `payload.reason`, when it is a string. */
  reason: string | null;
};

export type PilotageContactRow = {
  id: string;
  createdAt: string;
  stage: Stage;
  source: Source;
};

// -----------------------------------------------------------------------------
// Basic statistics
// -----------------------------------------------------------------------------

/** Median of a list of numbers; `null` for an empty list. Non-finite values are ignored. */
export function median(values: readonly number[]): number | null {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((first, second) => first - second);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

/** `numerator / denominator` kept apart: `rate` is `null` when there is nothing to divide by. */
export function rate(numerator: number, denominator: number): PilotageRate {
  return { numerator, denominator, rate: denominator > 0 ? numerator / denominator : null };
}

// -----------------------------------------------------------------------------
// Signed mandates
// -----------------------------------------------------------------------------

function isSignature(row: PilotageActivityRow): boolean {
  if (row.actorType !== "user") return false;
  if (row.type === "mandate_signed") return true;
  return row.type === "contact_stage_changed" && row.stage === "mandat_signe" && row.previousStage !== "mandat_signe";
}

function isMandateExit(row: PilotageActivityRow): boolean {
  return row.actorType === "user" && row.type === "contact_stage_changed" && row.previousStage === "mandat_signe";
}

/**
 * The instant each dossier's mandate was signed (by a human), as epoch ms.
 *
 * Only activities authored by a user count: an agent (or the system) writing
 * `mandate_signed` or a stage change to `mandat_signe` is ignored — a signed
 * mandate is never declared by an AI. The first signature of a dossier wins; a
 * director's exit from « Mandat signé » cancels it, and a later signature counts
 * again (from that later instant). Rows with an invalid date or no dossier are
 * ignored.
 */
export function signedMandates(rows: readonly PilotageActivityRow[]): Map<string, number> {
  const events = new Map<string, Array<{ time: number; kind: "sign" | "exit" }>>();
  for (const row of rows) {
    if (!row.contactId) continue;
    const kind = isSignature(row) ? "sign" : isMandateExit(row) ? "exit" : null;
    if (!kind) continue;
    const time = Date.parse(row.occurredAt);
    if (Number.isNaN(time)) continue;
    const list = events.get(row.contactId) ?? [];
    list.push({ time, kind });
    events.set(row.contactId, list);
  }

  const signed = new Map<string, number>();
  for (const [contactId, list] of events) {
    // At the same instant, the signature comes before its undoing.
    list.sort((first, second) => first.time - second.time || (first.kind === "sign" ? -1 : 1));
    let signedAt: number | null = null;
    for (const event of list) {
      if (event.kind === "sign") {
        if (signedAt === null) signedAt = event.time;
      } else {
        signedAt = null;
      }
    }
    if (signedAt !== null) signed.set(contactId, signedAt);
  }
  return signed;
}

/** Number of signatures inside a range. */
export function countSignedIn(signed: ReadonlyMap<string, number>, range: PilotageRange): number {
  let count = 0;
  for (const time of signed.values()) {
    if (isInRange(range, new Date(time).toISOString())) count += 1;
  }
  return count;
}

// -----------------------------------------------------------------------------
// Requests, series, origins
// -----------------------------------------------------------------------------

/** Contacts created inside a range. */
export function createdIn<T extends { createdAt: string }>(contacts: readonly T[], range: PilotageRange): T[] {
  return contacts.filter((contact) => isInRange(range, contact.createdAt));
}

/**
 * Buckets the received requests and the signatures of ONE period. Every bucket
 * is present, with a real `0` when nothing happened; an instant outside the
 * period (or invalid) is ignored, never counted in a wrong bucket.
 */
export function buildSeriesPoints(
  buckets: readonly PilotageBucket[],
  receivedAt: readonly string[],
  signedAt: readonly string[],
): PilotageSeriesPoint[] {
  const points: PilotageSeriesPoint[] = buckets.map((bucket) => ({ ...bucket, received: 0, signed: 0 }));
  for (const instant of receivedAt) {
    const index = bucketIndexOf(buckets, instant);
    if (index >= 0) points[index]!.received += 1;
  }
  for (const instant of signedAt) {
    const index = bucketIndexOf(buckets, instant);
    if (index >= 0) points[index]!.signed += 1;
  }
  return points;
}

/** Origins of the requests of two periods: most frequent first, ties by source name. */
export function buildOrigins(current: readonly Source[], previous: readonly Source[]): PilotageOrigin[] {
  const counts = new Map<Source, { count: number; previousCount: number }>();
  const bump = (source: Source, field: "count" | "previousCount") => {
    const entry = counts.get(source) ?? { count: 0, previousCount: 0 };
    entry[field] += 1;
    counts.set(source, entry);
  };
  for (const source of current) bump(source, "count");
  for (const source of previous) bump(source, "previousCount");
  return [...counts.entries()]
    .map(([source, entry]) => ({ source, ...entry }))
    .sort((first, second) => second.count - first.count || second.previousCount - first.previousCount || first.source.localeCompare(second.source));
}

// -----------------------------------------------------------------------------
// First handling
// -----------------------------------------------------------------------------

/** Activities that ARE the creation of the file, not a handling of it. */
export const CREATION_ACTIVITY_TYPES: ReadonlySet<string> = new Set(["contact_created", "contact_created_from_lead"]);

/**
 * Delay of first handling of the given dossiers (the ones created in a period).
 *
 * The first handling is the earliest activity of the dossier authored by an AI
 * agent or a user, that is not the creation of the file and not earlier than
 * the creation. A dossier with none is `unhandled` (not measured, not a zero).
 */
export function firstHandlingDelay(
  contacts: ReadonlyArray<{ id: string; createdAt: string }>,
  activities: readonly PilotageActivityRow[],
): PilotageHandlingDelay {
  const created = new Map<string, number>();
  for (const contact of contacts) {
    const time = Date.parse(contact.createdAt);
    if (!Number.isNaN(time)) created.set(contact.id, time);
  }

  const first = new Map<string, number>();
  for (const activity of activities) {
    if (!activity.contactId || !created.has(activity.contactId)) continue;
    if (activity.actorType !== "user" && activity.actorType !== "ai_agent") continue;
    if (CREATION_ACTIVITY_TYPES.has(activity.type)) continue;
    const time = Date.parse(activity.occurredAt);
    if (Number.isNaN(time) || time < created.get(activity.contactId)!) continue;
    const known = first.get(activity.contactId);
    if (known === undefined || time < known) first.set(activity.contactId, time);
  }

  const delays = [...first.entries()].map(([id, time]) => (time - created.get(id)!) / 60_000);
  return {
    medianMinutes: median(delays),
    measured: delays.length,
    unhandled: created.size - delays.length,
    created: created.size,
  };
}

// -----------------------------------------------------------------------------
// Cohort flow
// -----------------------------------------------------------------------------

function activityForFunnel(row: PilotageActivityRow): { type: string; payload: unknown } {
  return { type: row.type, payload: { previous_stage: row.previousStage, stage: row.stage } };
}

/**
 * Flow of the given dossiers (created in the period) to where they stand today.
 * Same rules as the pipeline funnel (`furthestStageFromActivities`), restricted
 * to a cohort. `activities` may hold other dossiers' rows: they are ignored.
 */
export function computeFlow(
  cohort: ReadonlyArray<{ id: string; stage: Stage }>,
  activities: readonly PilotageActivityRow[],
): PilotageFlow {
  const cohortIds = new Set(cohort.filter((contact) => contact.stage === "perdu").map((contact) => contact.id));
  const history = new Map<string, Array<{ type: string; payload: unknown }>>();
  const reasonRecorded = new Set<string>();
  for (const row of activities) {
    if (!row.contactId || !cohortIds.has(row.contactId)) continue;
    const list = history.get(row.contactId) ?? [];
    list.push(activityForFunnel(row));
    history.set(row.contactId, list);
    if (
      row.actorType === "user" &&
      row.type === "contact_stage_changed" &&
      row.stage === "perdu" &&
      typeof row.reason === "string" &&
      row.reason.trim().length > 0
    ) {
      reasonRecorded.add(row.contactId);
    }
  }

  const rankOf = (stage: PipelineFunnelStage) => PIPELINE_FUNNEL_STAGES.indexOf(stage);
  const reached = Object.fromEntries(PIPELINE_FUNNEL_STAGES.map((stage) => [stage, 0])) as Record<PipelineFunnelStage, number>;
  const byFurthest = Object.fromEntries(PIPELINE_FUNNEL_STAGES.map((stage) => [stage, 0])) as Record<PipelineFunnelStage, number>;
  let signed = 0;
  let lost = 0;
  let untraced = 0;

  for (const contact of cohort) {
    let furthest: PipelineFunnelStage;
    if (contact.stage === "perdu") {
      const result = furthestStageFromActivities(history.get(contact.id) ?? []);
      furthest = result.stage;
      byFurthest[furthest] += 1;
      lost += 1;
      if (!result.traced) untraced += 1;
    } else {
      furthest = contact.stage;
      if (contact.stage === "mandat_signe") signed += 1;
    }
    for (let rank = 0; rank <= rankOf(furthest); rank += 1) reached[PIPELINE_FUNNEL_STAGES[rank]!] += 1;
  }

  const recorded = [...reasonRecorded].length;
  return {
    entrants: cohort.length,
    steps: PIPELINE_FUNNEL_STAGES.map((stage) => ({ stage, reached: reached[stage] })),
    signed,
    inProgress: cohort.length - signed - lost,
    lost: {
      total: lost,
      byFurthestStage: byFurthest,
      untraced,
      reasons: { available: recorded > 0, recorded },
    },
  };
}

// -----------------------------------------------------------------------------
// Dossiers without a next action
// -----------------------------------------------------------------------------

export const WITHOUT_NEXT_ACTION_SAMPLE = 5;

export type OpenContactRow = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  stage: Stage;
  updatedAt: string;
};

/**
 * Open dossiers with no open task, no upcoming appointment and no draft waiting
 * for a human. `NO_NAME_LABEL` is injected so this file stays free of UI text.
 */
export function computeWithoutNextAction(input: {
  openContacts: readonly OpenContactRow[];
  contactsWithOpenTask: ReadonlySet<string>;
  contactsWithUpcomingAppointment: ReadonlySet<string>;
  contactsWithPendingDraft: ReadonlySet<string>;
  noNameLabel: string;
}): PilotageWithoutNextAction {
  const alone = input.openContacts.filter(
    (contact) =>
      !input.contactsWithOpenTask.has(contact.id) &&
      !input.contactsWithUpcomingAppointment.has(contact.id) &&
      !input.contactsWithPendingDraft.has(contact.id),
  );
  const oldestFirst = [...alone].sort(
    (first, second) => Date.parse(first.updatedAt) - Date.parse(second.updatedAt) || first.id.localeCompare(second.id),
  );
  return {
    count: alone.length,
    openTotal: input.openContacts.length,
    sample: oldestFirst.slice(0, WITHOUT_NEXT_ACTION_SAMPLE).map((contact) => {
      const name = [contact.firstName, contact.lastName]
        .map((part) => (part ?? "").trim())
        .filter((part) => part.length > 0)
        .join(" ");
      return {
        contactId: contact.id,
        contactName: name.length > 0 ? name : input.noNameLabel,
        stage: contact.stage,
        updatedAt: contact.updatedAt,
      };
    }),
  };
}

// -----------------------------------------------------------------------------
// Agents
// -----------------------------------------------------------------------------

export type AgentRunCountsRow = {
  agent_name: AgentName;
  window_total: number | string;
  window_succeeded: number | string;
  window_failed: number | string;
  window_blocked: number | string;
  window_running: number | string;
};

function toCount(value: number | string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0;
}

/**
 * The five agents' counters. An agent with no run in the window has no row in
 * the SQL aggregate: its counters are real zeros (the aggregate succeeded).
 * `recordedActions` counts the history entries authored by the agent (and only
 * by an AI agent) inside the range.
 */
export function buildAgentActivity(input: {
  runRows: readonly AgentRunCountsRow[];
  activities: readonly PilotageActivityRow[];
  range: PilotageRange;
  lastActivityAt: Readonly<Partial<Record<AgentName, string | null>>>;
}): PilotageAgentActivity[] {
  const actions = new Map<string, number>();
  for (const activity of input.activities) {
    if (activity.actorType !== "ai_agent" || !activity.actorAgent) continue;
    if (!isInRange(input.range, activity.occurredAt)) continue;
    actions.set(activity.actorAgent, (actions.get(activity.actorAgent) ?? 0) + 1);
  }
  const runsByAgent = new Map(input.runRows.map((row) => [row.agent_name, row]));

  return PILOTAGE_AGENT_ORDER.map((agent) => {
    const row = runsByAgent.get(agent);
    return {
      agent,
      runs: {
        total: row ? toCount(row.window_total) : 0,
        succeeded: row ? toCount(row.window_succeeded) : 0,
        blocked: row ? toCount(row.window_blocked) : 0,
        failed: row ? toCount(row.window_failed) : 0,
        running: row ? toCount(row.window_running) : 0,
      },
      recordedActions: actions.get(agent) ?? 0,
      lastActivityAt: input.lastActivityAt[agent] ?? null,
    };
  });
}

/** The later of two ISO instants (either may be missing). */
export function latestInstant(first: string | null | undefined, second: string | null | undefined): string | null {
  const times = [first, second]
    .map((value) => (value ? Date.parse(value) : Number.NaN))
    .filter((time) => !Number.isNaN(time));
  return times.length === 0 ? null : new Date(Math.max(...times)).toISOString();
}
