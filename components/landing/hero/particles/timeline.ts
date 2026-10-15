/**
 * The clock of the hero opening (docs/design-system.md T.2, U.4). There are no phases any more, only one
 * time `T` (ms of the sequence): every point is a continuous function of it. The labels below are
 * informative (`data-phase`, `data-phases`, the share of the hands in the image): nothing in the maths
 * branches on them. Pure.
 *
 * Without the held ball (`HELD_ENABLED` false, U.5(c)) the opening is one wave: the big sphere, always turning,
 * empties into the left hand then the right hand between `WAVE_START_MS` and `WAVE_END_MS`.
 */

/** Informative labels, in the order of their first appearance. */
export const PHASES = ["sphere", "to-hands", "hands"] as const;
export type Phase = (typeof PHASES)[number];

/** The wave of the points from the sphere to the hands (ms of the sequence): `D` 6 600, delays up to half of it. */
export const WAVE_START_MS = 3000;
export const WAVE_END_MS = 10400;
/** Share of the wave spent waiting: a point leaves at `start + c·D·rank` and takes at most `D·(1 − c)`. */
export const WAVE_WAIT = 0.5;

/** The breathing of the hands begins when the first hand has arrived (rampe 1,2 s), well before the act. */
export const BREATH_START_MS = 7000;

/** The cobalt contact point appears and the act begins here: the final image is complete. */
export const SEQUENCE_END_MS = 10_600;
/** The cobalt contact point fades in over the 300 ms after the end of the sequence. */
export const CONTACT_FADE_MS = 300;
/** The sphere is born over its first 800 ms (opacity 0 to 1). */
export const BIRTH_MS = 800;
/** The sequence time stops growing here (data-sequence-ms plateau). */
export const SEQUENCE_CAP_MS = SEQUENCE_END_MS + CONTACT_FADE_MS;

export type PhaseState = {
  /** Informative label: `sphere` until the wave starts, `to-hands` until the end of the sequence, then `hands`. */
  readonly phase: Phase;
};

/** Label at the sequence time `ms` (negative counts as 0). */
export function phaseAt(ms: number): PhaseState {
  if (ms < WAVE_START_MS) return { phase: "sphere" };
  return { phase: ms < SEQUENCE_END_MS ? "to-hands" : "hands" };
}

/** The motions running at `ms` (`data-phases`): the sphere while it still holds points, the wave, the hands from the first arrival. */
export function activeWaves(ms: number): Phase[] {
  const active: Phase[] = [];
  if (ms < WAVE_END_MS) active.push("sphere");
  if (ms >= WAVE_START_MS && ms < WAVE_END_MS) active.push("to-hands");
  if (ms >= BREATH_START_MS || ms >= WAVE_END_MS) active.push("hands");
  return active;
}

/** Share of the hands in the image, 0..1 (smooth over the wave): their stronger, larger look and the size of the robots follow it. */
export function handsShareAt(ms: number): number {
  const q = Math.min(1, Math.max(0, (ms - WAVE_START_MS) / (WAVE_END_MS - WAVE_START_MS)));
  return q * q * (3 - 2 * q);
}

/** Opacity of the sphere at its birth, 0..1. */
export function birthOpacity(ms: number): number {
  return Math.min(1, Math.max(0, ms / BIRTH_MS));
}

/** Opacity of the cobalt contact point: 0 until the sequence ends, then 300 ms to 1. */
export function contactOpacity(ms: number): number {
  return Math.min(1, Math.max(0, (ms - SEQUENCE_END_MS) / CONTACT_FADE_MS));
}
