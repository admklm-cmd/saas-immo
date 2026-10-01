/**
 * Sequence of the hero demonstration: a fictitious prospect goes through the
 * five agents, stops in front of the human validation, and ends on a mandate
 * confirmed by a human. Pure data, so the rendered states are testable.
 *
 * It is an illustration played ONCE (docs/design-system.md §2.11.5), labelled
 * « Exemple fictif — simulation ». The last frame is the final state, which is
 * also the server HTML: nothing resets, nothing loops. No duration here is
 * presented as a measure.
 */

export type JourneyStepKind = "agent" | "human";
export type JourneyStepState = "waiting" | "active" | "awaiting" | "done";

export type JourneyFrame = {
  /** Step being worked on; every step before it is done. `-1`: nothing started. */
  cursor: number;
  /** A human decision is awaited on the cursor step. */
  awaiting: boolean;
  /** How long this frame stays on screen before the next one, in ms. */
  duration: number;
};

/** Everything « à venir », before the first agent starts. */
export const START_MS = 300;
export const AGENT_MS = 420;
/** First human step (validation of the first message): a longer wait. */
export const FIRST_AWAITING_MS = 1000;
/** Last human step (mandate): a shorter wait, the story is known by then. */
export const LAST_AWAITING_MS = 700;
/** The human step just validated, before the story goes on. */
export const VALIDATED_MS = 300;
/** Total length of the illustration (tested: 4 700 ms). */
export const JOURNEY_TOTAL_MS = 4700;

/**
 * Frames played once: the start, one frame per step (an agent working, or a
 * human step just validated) and one extra frame per human wait. The last one
 * is the final state (`cursor === kinds.length`); no frame follows it.
 */
export function journeySequence(kinds: readonly JourneyStepKind[]): JourneyFrame[] {
  const frames: JourneyFrame[] = [{ cursor: -1, awaiting: false, duration: START_MS }];
  const lastHuman = kinds.lastIndexOf("human");
  kinds.forEach((kind, cursor) => {
    if (kind === "human") {
      frames.push({ cursor, awaiting: true, duration: cursor === lastHuman ? LAST_AWAITING_MS : FIRST_AWAITING_MS });
      frames.push({ cursor: cursor + 1, awaiting: false, duration: VALIDATED_MS });
    } else {
      frames.push({ cursor, awaiting: false, duration: AGENT_MS });
    }
  });
  return frames;
}

/** Final state: every step done. Server HTML, no JavaScript, reduced motion, after the sequence. */
export function finalFrame(kinds: readonly JourneyStepKind[]): JourneyFrame {
  return { cursor: kinds.length, awaiting: false, duration: 0 };
}

export function isFinalFrame(frame: JourneyFrame, kinds: readonly JourneyStepKind[]): boolean {
  return frame.cursor >= kinds.length && !frame.awaiting;
}

export function stepState(index: number, frame: JourneyFrame): JourneyStepState {
  if (index < frame.cursor) return "done";
  if (index > frame.cursor) return "waiting";
  return frame.awaiting ? "awaiting" : "active";
}
