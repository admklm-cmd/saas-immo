import { describe, expect, it } from "vitest";

import { LANDING_TEXTS } from "@/components/landing-texts";

import { finalFrame, journeySequence, stepState, type JourneyStepKind } from "./journey-timeline";

const KINDS: JourneyStepKind[] = LANDING_TEXTS.journey.steps.map((step) => step.kind);

describe("journeySequence", () => {
  const frames = journeySequence(KINDS);

  it("starts with nothing started and ends with every step done", () => {
    expect(frames[0]?.cursor).toBe(-1);
    expect(frames.at(-1)).toMatchObject({ cursor: KINDS.length, awaiting: false });
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
