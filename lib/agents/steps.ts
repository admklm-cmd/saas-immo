/**
 * Step journal of an AI agent run — shared by Léa, Hugo, Emma, Louis and Sarah.
 *
 * The agency must be able to WATCH its agents work, not only read a verdict.
 * The UI replays a run step by step, so the steps have to be REAL: every entry
 * below is written when the corresponding work actually happened, with the
 * timestamps that were actually measured. Nothing here is decorative, and the
 * duration is recomputed by the database from `started_at` / `finished_at`
 * (`private.stamp_ai_agent_run_step`), so it cannot be faked from the client.
 *
 * How the clock is handled, precisely:
 *   * the recorder keeps a cursor, initialised when the recorder is created;
 *   * `step()` closes the interval `[cursor, now]`, stores it, and then moves
 *     the cursor to the instant AFTER the row was written, so the latency of
 *     the journal itself is never charged to the next step;
 *   * `mark()` moves the cursor to now without recording anything, for the
 *     rare case where an agent does work it does not want to attribute.
 * Consequence: a step measures the business work, and the small gaps between
 * steps are the journalling itself. Nothing is invented, nothing is padded.
 *
 * Failure policy — same principle as `finishRun`: **a journalling failure must
 * never break the run, nor hide its result.** Every write is wrapped; an error
 * is logged server-side and the step is still kept in memory, so the caller can
 * return what it has.
 *
 * Usage (see `features/agents-ia/hugo-qualification/hugo.ts` for a full agent):
 *
 *   const started = await startGuardedRun(client, context, { … });
 *   const steps = started.data.steps;          // `guardrails` already recorded
 *   …read the CRM…
 *   await steps.step({ phase: "context_loaded", label: "…", detail: { … } });
 *   …
 *   await steps.step({ phase: "persisted", label: "…", detail: { … } });
 */

import type { Json } from "@/types/database";

import type { Enums, TypedClient } from "./types";

export type AgentRunPhase = Enums["ai_agent_run_phase"];
export type AgentRunStepStatus = Enums["ai_agent_run_step_status"];

/** Ordered vocabulary of the phases, as the code really performs them. */
export const AGENT_RUN_PHASES = [
  "guardrails",
  "context_loaded",
  "prompt_built",
  "ai_call",
  "output_validated",
  "decision",
  "persisted",
] as const satisfies readonly AgentRunPhase[];

export const AGENT_RUN_STEP_STATUSES = ["ok", "blocked", "failed", "skipped"] as const satisfies
  readonly AgentRunStepStatus[];

/** French labels of the phases, for the UI (texts are centralised, CLAUDE.md). */
export const AGENT_RUN_PHASE_LABELS: Record<AgentRunPhase, string> = {
  guardrails: "Garde-fous",
  context_loaded: "Dossier chargé",
  prompt_built: "Prompt construit",
  ai_call: "Appel du fournisseur IA",
  output_validated: "Sortie validée",
  decision: "Décision du code",
  persisted: "Écritures",
};

export const AGENT_RUN_STEP_STATUS_LABELS: Record<AgentRunStepStatus, string> = {
  ok: "Terminé",
  blocked: "Bloqué",
  failed: "Échec",
  skipped: "Ignoré",
};

/** Displayable summary of a step. Never the prospect's free text. */
export type AgentStepDetail = Readonly<Record<string, Json>>;

export type AgentStepInput = {
  phase: AgentRunPhase;
  /** Short French sentence, displayed as-is. Truncated to 200 characters. */
  label: string;
  /** Defaults to `ok`. */
  status?: AgentRunStepStatus;
  detail?: AgentStepDetail;
};

/** A step as it was measured, before/independently of its persistence. */
export type RecordedRunStep = {
  index: number;
  phase: AgentRunPhase;
  label: string;
  status: AgentRunStepStatus;
  detail: AgentStepDetail;
  /** Canonical ISO-8601 UTC. */
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  /** False when the row could not be written (the run itself is unaffected). */
  persisted: boolean;
};

export interface AgentStepRecorder {
  /** Run the steps belong to, or `null` for the no-op recorder. */
  readonly runId: string | null;
  /** Everything measured so far, in order. */
  readonly steps: readonly RecordedRunStep[];
  /** Records one step, from the cursor to now. Never throws. */
  step(input: AgentStepInput): Promise<RecordedRunStep>;
  /** Moves the cursor to now without recording anything. */
  mark(): void;
}

export const MAX_STEP_LABEL_LENGTH = 200;
/** Hard stop: the database refuses `step_index` above 200. */
export const MAX_STEPS_PER_RUN = 201;

function truncate(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) return "Étape";
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}

export type CreateStepRecorderInput = {
  agencyId: string;
  runId: string;
  /** Start of the first step. Defaults to now (recorder creation). */
  startedAt?: Date;
};

/**
 * Builds a recorder bound to one run. The caller owns the run id, so a step can
 * never be attached to somebody else's execution; RLS refuses it anyway.
 */
export function createStepRecorder(
  client: TypedClient,
  input: CreateStepRecorderInput,
): AgentStepRecorder {
  const steps: RecordedRunStep[] = [];
  let cursor = input.startedAt ?? new Date();

  return {
    runId: input.runId,
    steps,
    mark(): void {
      cursor = new Date();
    },
    async step(stepInput: AgentStepInput): Promise<RecordedRunStep> {
      const finishedAt = new Date();
      // Defensive: a clock that went backwards must not produce a negative
      // duration, and a cursor left far behind must not exceed the database's
      // one-hour sanity bound.
      const startedAt = new Date(
        Math.min(Math.max(cursor.getTime(), finishedAt.getTime() - 3_540_000), finishedAt.getTime()),
      );

      const recorded: RecordedRunStep = {
        index: steps.length,
        phase: stepInput.phase,
        label: truncate(stepInput.label, MAX_STEP_LABEL_LENGTH),
        status: stepInput.status ?? "ok",
        detail: stepInput.detail ?? {},
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        persisted: false,
      };
      steps.push(recorded);

      if (recorded.index >= MAX_STEPS_PER_RUN) {
        console.error(`[agents] run ${input.runId}: too many steps, step ${recorded.index} not journaled.`);
        cursor = new Date();
        return recorded;
      }

      try {
        const { error } = await client.from("ai_agent_run_steps").insert({
          agency_id: input.agencyId,
          run_id: input.runId,
          step_index: recorded.index,
          phase: recorded.phase,
          label: recorded.label,
          status: recorded.status,
          detail: recorded.detail as Json,
          started_at: recorded.startedAt,
          finished_at: recorded.finishedAt,
        });
        if (error) {
          // Never rethrow: the business result of the run must survive a
          // journalling problem (same rule as finishRun).
          console.error(
            `[agents] step journal failed (${error.code ?? "?"}) for run ${input.runId}, phase ${recorded.phase}: ${error.message}`,
          );
        } else {
          recorded.persisted = true;
        }
      } catch (cause) {
        console.error(`[agents] step journal threw for run ${input.runId}, phase ${recorded.phase}:`, cause);
      }

      cursor = new Date();
      return recorded;
    },
  };
}

/**
 * No-op recorder: measures nothing, writes nothing, never throws. Used when no
 * run could be opened at all, so that calling code never has to test for null.
 */
export function createNullStepRecorder(): AgentStepRecorder {
  return {
    runId: null,
    steps: [],
    mark(): void {},
    async step(stepInput: AgentStepInput): Promise<RecordedRunStep> {
      const now = new Date().toISOString();
      return {
        index: 0,
        phase: stepInput.phase,
        label: truncate(stepInput.label, MAX_STEP_LABEL_LENGTH),
        status: stepInput.status ?? "ok",
        detail: stepInput.detail ?? {},
        startedAt: now,
        finishedAt: now,
        durationMs: 0,
        persisted: false,
      };
    },
  };
}
