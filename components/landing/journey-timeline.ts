/**
 * Sequence of the hero demonstration: a fictitious prospect goes through the
 * five agents, stops in front of the human validation, and ends on a mandate
 * confirmed by a human. Pure data, so the rendered states are testable.
 *
 * It is an illustration replayed in a loop, labelled « Exemple fictif —
 * simulation ». No duration here is presented as a measure.
 */

export type JourneyStepKind = "agent" | "human";
export type JourneyStepState = "waiting" | "active" | "awaiting" | "done";

export type JourneyFrame = {
  /** Step being worked on; every step before it is done. `-1`: nothing started. */
  cursor: number;
  /** A human decision is awaited on the cursor step. */
  awaiting: boolean;
  /** How long this frame stays on screen, in ms. */
  duration: number;
};

const AGENT_MS = 1500;
const AWAITING_MS = 2600;
const VALIDATED_MS = 700;
const FINAL_HOLD_MS = 3600;
const RESET_MS = 900;

export function journeySequence(kinds: readonly JourneyStepKind[]): JourneyFrame[] {
  const frames: JourneyFrame[] = [{ cursor: -1, awaiting: false, duration: RESET_MS }];
  kinds.forEach((kind, cursor) => {
    if (kind === "human") {
      frames.push({ cursor, awaiting: true, duration: AWAITING_MS });
      frames.push({ cursor: cursor + 1, awaiting: false, duration: VALIDATED_MS });
    } else {
      frames.push({ cursor, awaiting: false, duration: AGENT_MS });
    }
  });
  // Every step done: the state that is also rendered without JavaScript.
  frames.push({ cursor: kinds.length, awaiting: false, duration: FINAL_HOLD_MS });
  return frames;
}

/** Final state: every step done. Server HTML, no JavaScript, reduced motion. */
export function finalFrame(kinds: readonly JourneyStepKind[]): JourneyFrame {
  return { cursor: kinds.length, awaiting: false, duration: 0 };
}

export function stepState(index: number, frame: JourneyFrame): JourneyStepState {
  if (index < frame.cursor) return "done";
  if (index > frame.cursor) return "waiting";
  return frame.awaiting ? "awaiting" : "active";
}
