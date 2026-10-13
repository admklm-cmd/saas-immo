/**
 * Ordering of the phases of the hero opening (docs/design-system.md T.2): the big sphere, the left
 * hand that takes the ball, the ball that becomes the right hand. Pure: the sequence time in, the
 * phase and its progress out. Durations in ms.
 */

export const PHASES = ["sphere", "to-hand", "hand", "to-hands", "hands"] as const;
export type Phase = (typeof PHASES)[number];

type Slot = { readonly phase: Phase; readonly from: number; readonly to: number };

/** Start and end (ms of the sequence) of each phase; `hands` has no end. */
export const SCHEDULE: readonly Slot[] = [
  { phase: "sphere", from: 0, to: 3800 },
  { phase: "to-hand", from: 3800, to: 6600 },
  { phase: "hand", from: 6600, to: 8200 },
  { phase: "to-hands", from: 8200, to: 10_600 },
  { phase: "hands", from: 10_600, to: Infinity },
];

/** The sequence stops here: the final image (and the cobalt point) is complete. */
export const SEQUENCE_END_MS = 10_600;
/** The cobalt contact point fades in over the 300 ms after the end of the sequence. */
export const CONTACT_FADE_MS = 300;
/** The sphere is born over its first 800 ms (opacity 0 to 1). */
export const BIRTH_MS = 800;
/** The sequence time stops growing here (data-sequence-ms plateau). */
export const SEQUENCE_CAP_MS = SEQUENCE_END_MS + CONTACT_FADE_MS;

export type TransitionKind = "to-hand" | "to-hands";

export type PhaseState = {
  readonly phase: Phase;
  /** Index in `PHASES`. */
  readonly index: number;
  /** Milliseconds since the phase began. */
  readonly local: number;
  /** 0..1 inside the phase (0 for `hands`). */
  readonly progress: number;
  readonly transition: boolean;
};

/** Phase at the sequence time `ms` (negative counts as 0). */
export function phaseAt(ms: number): PhaseState {
  const t = Math.max(0, ms);
  for (let index = 0; index < SCHEDULE.length; index++) {
    const slot = SCHEDULE[index]!;
    if (t < slot.to) {
      const span = slot.to - slot.from;
      return { phase: slot.phase, index, local: t - slot.from, progress: Number.isFinite(span) ? (t - slot.from) / span : 0, transition: slot.phase.startsWith("to-") };
    }
  }
  const last = SCHEDULE[SCHEDULE.length - 1]!;
  return { phase: last.phase, index: SCHEDULE.length - 1, local: t - last.from, progress: 0, transition: false };
}

/** Duration (ms) of a phase. */
export function phaseDuration(phase: Phase): number {
  const slot = SCHEDULE.find((entry) => entry.phase === phase)!;
  return slot.to - slot.from;
}

/** Start (ms) of a phase. */
export function phaseStart(phase: Phase): number {
  return SCHEDULE.find((entry) => entry.phase === phase)!.from;
}

/** Opacity of the sphere at its birth, 0..1. */
export function birthOpacity(ms: number): number {
  return Math.min(1, Math.max(0, ms / BIRTH_MS));
}

/** Opacity of the cobalt contact point: 0 until the sequence ends, then 300 ms to 1. */
export function contactOpacity(ms: number): number {
  return Math.min(1, Math.max(0, (ms - SEQUENCE_END_MS) / CONTACT_FADE_MS));
}
