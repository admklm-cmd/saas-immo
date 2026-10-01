import { describe, expect, it } from "vitest";

import { LANDING_TEXTS } from "@/components/landing-texts";

import {
  finalFrame,
  isFinalFrame,
  JOURNEY_TOTAL_MS,
  journeySequence,
  stepState,
  type JourneyStepKind,
} from "./journey-timeline";

const KINDS: JourneyStepKind[] = LANDING_TEXTS.journey.steps.map((step) => step.kind);
const HUMAN_STEPS = KINDS.filter((kind) => kind === "human").length;

describe("journeySequence (played once, docs/design-system.md §2.11.5)", () => {
  const frames = journeySequence(KINDS);

  it("lasts 4 700 ms in total", () => {
    const total = frames.reduce((sum, frame) => sum + frame.duration, 0);
    expect(total).toBe(4700);
    expect(total).toBe(JOURNEY_TOTAL_MS);
  });

  it("starts with nothing started and ends on the final frame, with no reset frame after it", () => {
    expect(frames[0]?.cursor).toBe(-1);
    const last = frames.at(-1);
    expect(last).toMatchObject({ cursor: finalFrame(KINDS).cursor, awaiting: false });
    expect(last && isFinalFrame(last, KINDS)).toBe(true);
    // Only the last frame is final: nothing is played after it.
    expect(frames.filter((frame) => isFinalFrame(frame, KINDS))).toHaveLength(1);
  });

  it("holds one frame per step, plus one wait per human step, plus the start", () => {
    expect(frames).toHaveLength(1 + KINDS.length + HUMAN_STEPS);
  });

  it("stops in front of every human step before going on", () => {
    KINDS.forEach((kind, index) => {
      const awaiting = frames.filter((frame) => frame.cursor === index && frame.awaiting);
      expect(awaiting).toHaveLength(kind === "human" ? 1 : 0);
    });
  });

  it("never goes backwards and every frame has a positive duration", () => {
    for (let index = 1; index < frames.length; index++) {
      expect(frames[index]?.cursor ?? NaN).toBeGreaterThanOrEqual(frames[index - 1]?.cursor ?? NaN);
    }
    expect(frames.every((frame) => frame.duration > 0)).toBe(true);
  });
});

describe("finalFrame and stepState", () => {
  it("renders every step done in the final state (no JavaScript, reduced motion)", () => {
    const frame = finalFrame(KINDS);
    expect(KINDS.map((_, index) => stepState(index, frame))).toEqual(KINDS.map(() => "done"));
  });

  it("marks the waiting, active and awaiting steps around the cursor", () => {
    expect(stepState(0, { cursor: 1, awaiting: false, duration: 1 })).toBe("done");
    expect(stepState(1, { cursor: 1, awaiting: false, duration: 1 })).toBe("active");
    expect(stepState(1, { cursor: 1, awaiting: true, duration: 1 })).toBe("awaiting");
    expect(stepState(2, { cursor: 1, awaiting: false, duration: 1 })).toBe("waiting");
  });
});
