import { describe, expect, it } from "vitest";

import type { RecordedRunStep } from "@/lib/agents/steps";

import type { AgentRunStepView } from "../types";
import {
  buildReplaySchedule,
  REPLAY_MIN_READABLE_MS,
  replayLengthMs,
  replaySpeedFactor,
  replayStepsFromRecorded,
  replayStepsFromView,
  stepAuthor,
  totalDurationMs,
  type ReplayStep,
} from "./replay";

function step(overrides: Partial<ReplayStep> = {}): ReplayStep {
  return {
    key: "k",
    phase: "guardrails",
    phaseLabel: "Garde-fous",
    label: "Garde-fous vérifiés.",
    status: "ok",
    statusLabel: "Terminé",
    detail: {},
    startedAt: "2026-09-17T08:00:00.000Z",
    finishedAt: "2026-09-17T08:00:00.120Z",
    durationMs: 120,
    ...overrides,
  };
}

describe("replay helpers", () => {
  it("sums the measured durations, without touching them", () => {
    expect(totalDurationMs([step({ durationMs: 120 }), step({ durationMs: 37 })])).toBe(157);
  });

  it("attributes every phase to the code, except the call to the AI provider", () => {
    expect(stepAuthor("ai_call")).toBe("ai");
    for (const phase of ["guardrails", "context_loaded", "prompt_built", "output_validated", "decision", "persisted"] as const) {
      expect(stepAuthor(phase)).toBe("code");
    }
  });

  it("never speeds a replay up, and only slows short runs down", () => {
    // A run long enough to be watched is replayed at its real speed.
    expect(replaySpeedFactor(REPLAY_MIN_READABLE_MS)).toBe(1);
    expect(replaySpeedFactor(12_000)).toBe(1);
    // A very short run gets a factor, which the UI displays as such.
    expect(replaySpeedFactor(400)).toBe(10);
    expect(replaySpeedFactor(0)).toBe(1);
    expect(replaySpeedFactor(Number.NaN)).toBe(1);
  });

  it("schedules each step for exactly its measured duration × the factor", () => {
    const steps = [step({ durationMs: 100 }), step({ durationMs: 250 }), step({ durationMs: 0 })];

    expect(buildReplaySchedule(steps, 1)).toEqual([
      { index: 0, startAt: 0, endAt: 100 },
      { index: 1, startAt: 100, endAt: 350 },
      { index: 2, startAt: 350, endAt: 350 },
    ]);
    expect(buildReplaySchedule(steps, 10)).toEqual([
      { index: 0, startAt: 0, endAt: 1000 },
      { index: 1, startAt: 1000, endAt: 3500 },
      { index: 2, startAt: 3500, endAt: 3500 },
    ]);
    expect(replayLengthMs(steps, 10)).toBe(3500);
    expect(replayLengthMs([], 10)).toBe(0);
  });

  it("keeps the labels the server already produced", () => {
    const view: AgentRunStepView = {
      id: "run-1-step-0",
      runId: "run-1",
      index: 0,
      phase: "decision",
      phaseLabel: "Décision du code",
      label: "Règles du code appliquées.",
      status: "ok",
      statusLabel: "Terminé",
      detail: { stage: "chaud" },
      startedAt: "2026-09-17T08:00:00.000Z",
      finishedAt: "2026-09-17T08:00:00.042Z",
      durationMs: 42,
    };

    expect(replayStepsFromView([view])[0]).toMatchObject({
      key: "run-1-step-0",
      phaseLabel: "Décision du code",
      statusLabel: "Terminé",
      durationMs: 42,
    });
  });

  it("labels the steps a server action returns with the same centralised maps", () => {
    const recorded: RecordedRunStep = {
      index: 3,
      phase: "ai_call",
      label: "Réponse reçue du fournisseur IA.",
      status: "ok",
      detail: {},
      startedAt: "2026-09-17T08:00:00.000Z",
      finishedAt: "2026-09-17T08:00:00.310Z",
      durationMs: 310,
      persisted: true,
    };

    expect(replayStepsFromRecorded("run-9", [recorded])[0]).toMatchObject({
      key: "run-9-3",
      phaseLabel: "Appel du fournisseur IA",
      statusLabel: "Terminé",
      durationMs: 310,
    });
  });
});
