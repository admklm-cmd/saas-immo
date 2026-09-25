import { describe, expect, it } from "vitest";

import type { TimelineEntry } from "@/features/contacts/types";

import { STAGE_CHANGE_TYPE, timelineMark } from "./timeline-mark";

function entry(overrides: Partial<TimelineEntry>): TimelineEntry {
  return {
    id: "1",
    kind: "activity",
    occurredAt: "2026-09-14T08:30:00.000Z",
    title: "Événement",
    description: null,
    isSimulation: false,
    actor: { type: "system", agent: null, userId: null },
    status: null,
    meta: {},
    ...overrides,
  };
}

describe("timelineMark — the symbol says what, the shape says who", () => {
  it("an AI run is the agent's own tile", () => {
    expect(timelineMark(entry({ kind: "ai_run", actor: { type: "ai_agent", agent: "hugo", userId: null } }))).toEqual({
      glyph: "hugo",
      kind: "agent",
    });
  });

  it("a message, a task, an appointment keep their symbol and take the actor's shape", () => {
    expect(timelineMark(entry({ kind: "message", actor: { type: "ai_agent", agent: "louis", userId: null } }))).toEqual({
      glyph: "mail",
      kind: "agent",
    });
    expect(timelineMark(entry({ kind: "task", actor: { type: "user", agent: null, userId: "u" } }))).toEqual({
      glyph: "tasks",
      kind: "human",
    });
    expect(timelineMark(entry({ kind: "appointment" }))).toEqual({ glyph: "appointment", kind: "neutral" });
  });

  it("a human stage change into « Mandat signé » is the outcome shape; any other is the pipeline line", () => {
    const human = { type: "user", agent: null, userId: "u" } as const;
    expect(
      timelineMark(entry({ actor: human, meta: { type: STAGE_CHANGE_TYPE, stage: "mandat_signe", previous_stage: "chaud" } })),
    ).toEqual({ glyph: "mandate", kind: "outcome" });
    expect(
      timelineMark(entry({ actor: human, meta: { type: STAGE_CHANGE_TYPE, stage: "chaud", previous_stage: "qualifie" } })),
    ).toEqual({ glyph: "pipeline", kind: "human" });
  });

  it("anything else is a document of the system", () => {
    expect(timelineMark(entry({}))).toEqual({ glyph: "document", kind: "neutral" });
  });
});
