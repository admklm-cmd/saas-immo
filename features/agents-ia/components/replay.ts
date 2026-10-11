/**
 * Pure helpers of the "agent au travail" replay.
 *
 * NON-NEGOTIABLE RULE OF THIS MODULE: the interface never invents a rhythm.
 * Every delay it schedules comes from `durationMs`, which the server measured
 * and the database recomputed from `started_at` / `finished_at`. There is no
 * fake progress bar, no rounded "nicer" duration and no artificial pause.
 *
 * The only liberty taken is a SLOWDOWN factor, and it is a liberty only because
 * it is displayed as such next to the real figures (`replaySpeedFactor`): a run
 * of 180 ms would otherwise be over before a human could read the first step.
 * The factor can never be lower than 1 — speeding a replay up would understate
 * what the agents really cost.
 *
 * Kept free of React and of any server import so it can be unit-tested alone
 * and imported by a client component.
 */

import {
  AGENT_RUN_PHASE_LABELS,
  AGENT_RUN_STEP_STATUS_LABELS,
  type AgentRunPhase,
  type AgentRunStepStatus,
  type RecordedRunStep,
} from "@/lib/agents/steps";
import type { Json } from "@/types/database";

import type { AgentRunStepView } from "../types";

/** One step, in the minimal shape the replay needs to render it. */
export type ReplayStep = {
  /** Stable React key. */
  key: string;
  phase: AgentRunPhase;
  phaseLabel: string;
  label: string;
  status: AgentRunStepStatus;
  statusLabel: string;
  detail: Readonly<Record<string, Json>>;
  /** Canonical ISO-8601 UTC, as recorded. */
  startedAt: string;
  finishedAt: string;
  /** Measured server-side, recomputed by the database. Never adjusted here. */
  durationMs: number;
};

/** Steps read back from the journal (`getRunSteps`), already French-labelled. */
export function replayStepsFromView(steps: readonly AgentRunStepView[]): ReplayStep[] {
  return steps.map((step) => ({
    key: step.id,
    phase: step.phase,
    phaseLabel: step.phaseLabel,
    label: step.label,
    status: step.status,
    statusLabel: step.statusLabel,
    detail: step.detail,
    startedAt: step.startedAt,
    finishedAt: step.finishedAt,
    durationMs: step.durationMs,
  }));
}

/**
 * Steps returned directly by a server action, right after a human launched an
 * agent: same measurements, but the labels of the phase and of the status are
 * not attached yet (the journal read does that). They are taken from the same
 * centralised maps the server uses, never re-worded here.
 */
export function replayStepsFromRecorded(
  runId: string,
  steps: readonly RecordedRunStep[],
): ReplayStep[] {
  return steps.map((step) => ({
    key: `${runId}-${step.index}`,
    phase: step.phase,
    phaseLabel: AGENT_RUN_PHASE_LABELS[step.phase],
    label: step.label,
    status: step.status,
    statusLabel: AGENT_RUN_STEP_STATUS_LABELS[step.status],
    detail: step.detail,
    startedAt: step.startedAt,
    finishedAt: step.finishedAt,
    durationMs: step.durationMs,
  }));
}

/**
 * Who performed a step: the agency's own code, or the AI provider.
 *
 * This is the argument the screen exists for: of the seven phases, exactly one
 * leaves the code (`ai_call`). The decision is a phase of its own — and for
 * Louis it is recorded BEFORE the call, because the code computes the free
 * slots and the model only picks one of them.
 */
export function stepAuthor(phase: AgentRunPhase): "ai" | "code" {
  return phase === "ai_call" ? "ai" : "code";
}

/** Sum of the measured durations, in milliseconds. */
export function totalDurationMs(steps: readonly ReplayStep[]): number {
  return steps.reduce((total, step) => total + Math.max(0, step.durationMs), 0);
}

/** Round factors only, so the label ("×10") stays honest and legible. */
export const REPLAY_SPEED_FACTORS = [1, 2, 5, 10, 20, 50] as const;

/** A replay shorter than this is unreadable: it gets an ANNOUNCED slowdown. */
export const REPLAY_MIN_READABLE_MS = 4_000;

/**
 * Slowdown factor of the replay. Always ≥ 1, always displayed next to the real
 * durations when it is greater than 1.
 */
export function replaySpeedFactor(measuredTotalMs: number): number {
  if (!Number.isFinite(measuredTotalMs) || measuredTotalMs <= 0) return 1;
  const slowest = REPLAY_SPEED_FACTORS[REPLAY_SPEED_FACTORS.length - 1] ?? 1;
  for (const factor of REPLAY_SPEED_FACTORS) {
    if (measuredTotalMs * factor >= REPLAY_MIN_READABLE_MS) return factor;
  }
  return slowest;
}

/** When a step opens and closes during the replay, in ms from the start. */
export type ReplayTick = { index: number; startAt: number; endAt: number };

/**
 * Timeline of the replay: cumulative measured durations × the factor.
 *
 * A step is shown "in progress" for exactly the time it really took (scaled by
 * the announced factor), then closed. Nothing is padded between two steps.
 */
export function buildReplaySchedule(steps: readonly ReplayStep[], factor: number): ReplayTick[] {
  const scale = Number.isFinite(factor) && factor >= 1 ? factor : 1;
  let cursor = 0;
  return steps.map((step, index) => {
    const startAt = cursor;
    cursor += Math.max(0, step.durationMs) * scale;
    return { index, startAt, endAt: cursor };
  });
}

/** Total length of the replay itself, in milliseconds (measured × factor). */
export function replayLengthMs(steps: readonly ReplayStep[], factor: number): number {
  const ticks = buildReplaySchedule(steps, factor);
  return ticks.length === 0 ? 0 : (ticks[ticks.length - 1]?.endAt ?? 0);
}
