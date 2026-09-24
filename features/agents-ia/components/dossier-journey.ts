/**
 * Journey of ONE dossier across the agents, read from its recorded history.
 *
 * Pure presentation mapping of `getContactTimeline()` (features/contacts): no
 * query, no rule, no write. Every stage state comes from a recorded row —
 * an AI run and its journaled outcome, a message and its human review, an
 * appointment and its status, a human stage change. A stage with nothing
 * recorded is `pending`; if a LATER stage was recorded, it is `untraced`
 * (« Aucune trace pour ce dossier ») — never filled in, never assumed.
 *
 * Kept free of React so it can be unit-tested on its own.
 */

import { APP_TEXTS, RUN_OUTCOME_LABELS } from "@/components/texts";
import { AGENT_LABELS } from "@/lib/agents/messages";
import type { AgentRunStatus } from "@/lib/agents/messages";
import {
  APPOINTMENT_STATUS_LABELS,
  type AiAgentName,
  type TimelineEntry,
} from "@/features/contacts/types";

import type { RailState } from "./OperationalRail";

const TEXTS = APP_TEXTS.dossierJourney;

/** Stage-change activity type written by the pipeline (features/contacts/data.ts). */
const STAGE_CHANGE_TYPE = "contact_stage_changed";

export const JOURNEY_STAGES = [
  "prospect",
  "lea",
  "first_review",
  "hugo",
  "emma",
  "follow_up_review",
  "louis",
  "appointment",
  "sarah",
  "mandate",
] as const;

export type JourneyStageKey = (typeof JOURNEY_STAGES)[number];

export type JourneyStage = {
  key: JourneyStageKey;
  state: RailState;
  statusLabel: string;
  /** Recorded sentence behind the stage (journaled decision), or null. */
  detail: string | null;
  /** Run to replay, for an agent stage. */
  runId: string | null;
  /** When the recorded row happened (ISO), or null. */
  at: string | null;
};

type Found = Omit<JourneyStage, "key">;

const RUN_STATES: Record<AgentRunStatus, RailState> = {
  running: "running",
  succeeded: "done",
  failed: "failed",
  blocked: "blocked",
};

function isRunStatus(value: string | null): value is AgentRunStatus {
  return value === "running" || value === "succeeded" || value === "failed" || value === "blocked";
}

/** Entries are sorted newest first by the server; this keeps that order. */
function newest(entries: readonly TimelineEntry[], match: (entry: TimelineEntry) => boolean): TimelineEntry | null {
  return entries.find(match) ?? null;
}

function oldest(entries: readonly TimelineEntry[], match: (entry: TimelineEntry) => boolean): TimelineEntry | null {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (entry && match(entry)) return entry;
  }
  return null;
}

/** « Hugo — Qualifié… » → « Qualifié… » (the journaled decision, as written). */
function runDetail(agent: AiAgentName, entry: TimelineEntry): string | null {
  const prefix = `${AGENT_LABELS[agent]} — `;
  return entry.title.startsWith(prefix) ? entry.title.slice(prefix.length) : entry.title;
}

function agentStage(entries: readonly TimelineEntry[], agent: Exclude<AiAgentName, "lea">): Found | null {
  const run = newest(entries, (entry) => entry.kind === "ai_run" && entry.actor.agent === agent);
  if (!run || !isRunStatus(run.status)) return null;
  return {
    state: RUN_STATES[run.status],
    statusLabel: RUN_OUTCOME_LABELS[run.status],
    detail: runDetail(agent, run),
    runId: run.id,
    at: run.occurredAt,
  };
}

function reviewStage(message: TimelineEntry | null): Found | null {
  if (!message) return null;
  const outcome = message.meta.review_outcome;
  const base = { detail: message.title, runId: null, at: message.occurredAt };
  if (outcome === "approved") return { ...base, state: "done", statusLabel: TEXTS.status.reviewApproved };
  if (outcome === "rejected") return { ...base, state: "stopped", statusLabel: TEXTS.status.reviewRejected };
  return { ...base, state: "human", statusLabel: TEXTS.status.reviewPending };
}

function appointmentStage(entries: readonly TimelineEntry[]): Found | null {
  const appointment = newest(entries, (entry) => entry.kind === "appointment");
  if (!appointment) return null;
  const base = { detail: null, runId: null, at: appointment.occurredAt };
  switch (appointment.status) {
    case "proposed":
      return { ...base, state: "human", statusLabel: TEXTS.status.appointmentProposed };
    case "confirmed":
      return { ...base, state: "done", statusLabel: APPOINTMENT_STATUS_LABELS.confirmed };
    case "done":
      return { ...base, state: "done", statusLabel: APPOINTMENT_STATUS_LABELS.done };
    case "cancelled":
      return { ...base, state: "stopped", statusLabel: APPOINTMENT_STATUS_LABELS.cancelled };
    default:
      return null;
  }
}

function mandateStage(entries: readonly TimelineEntry[]): Found | null {
  // Only the LATEST human stage change counts: a mandate later withdrawn is not shown as signed.
  const change = newest(entries, (entry) => entry.kind === "activity" && entry.meta.type === STAGE_CHANGE_TYPE);
  if (!change || change.meta.stage !== "mandat_signe" || change.actor.type !== "user") return null;
  return { state: "done", statusLabel: TEXTS.status.mandateDone, detail: null, runId: null, at: change.occurredAt };
}

/**
 * The ten stages of a dossier, in the order of the seller's journey, from
 * its recorded history (newest first, as `getContactTimeline` returns it).
 */
export function buildDossierJourney(entries: readonly TimelineEntry[]): JourneyStage[] {
  const firstMessage = oldest(entries, (entry) => entry.kind === "message");
  const emmaMessage = newest(
    entries,
    (entry) => entry.kind === "message" && entry.actor.agent === "emma" && entry.id !== firstMessage?.id,
  );
  const leaTrace = newest(entries, (entry) => entry.actor.agent === "lea");

  const found: Record<JourneyStageKey, Found | null> = {
    // The dossier exists: that is what is displayed.
    prospect: { state: "done", statusLabel: TEXTS.status.prospectDone, detail: null, runId: null, at: null },
    lea: leaTrace
      ? { state: "done", statusLabel: TEXTS.status.leaDone, detail: leaTrace.title, runId: null, at: leaTrace.occurredAt }
      : null,
    first_review: reviewStage(firstMessage),
    hugo: agentStage(entries, "hugo"),
    emma: agentStage(entries, "emma"),
    follow_up_review: reviewStage(emmaMessage),
    louis: agentStage(entries, "louis"),
    appointment: appointmentStage(entries),
    sarah: agentStage(entries, "sarah"),
    mandate: mandateStage(entries),
  };

  const lastReached = JOURNEY_STAGES.reduce((last, key, index) => (found[key] ? index : last), -1);

  return JOURNEY_STAGES.map((key, index) => {
    const stage = found[key];
    if (stage) return { key, ...stage };
    return {
      key,
      state: index < lastReached ? "untraced" : "pending",
      statusLabel: index < lastReached ? TEXTS.status.untraced : TEXTS.status.pending,
      detail: null,
      runId: null,
      at: null,
    };
  });
}
