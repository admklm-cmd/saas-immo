/**
 * Pure timing helpers of the living background: a fictitious file's position
 * along the path is a function of time only (no accumulated state), so any
 * instant can be drawn again identically — the reduced-motion composition and
 * the tests rely on it.
 */

import { GATE_STOP, STOP_COUNT, type SceneSpec } from "./scenes";

/** Seconds to travel one link (slow: nothing fast runs behind a paragraph). */
export const SEGMENT_SECONDS = 1.9;
/** Seconds a file rests on an agent before leaving. */
export const DWELL_SECONDS = 0.45;
/** Seconds a finished, blocked or lost file takes to fade out. */
export const FADE_SECONDS = 1.3;
/** Where a halted impulse stops on its link (share of the link). */
export const HALT_AT = 0.46;

export type Schedule = {
  /** Arrival time at each stop, from the file's own birth. */
  arrive: number[];
  /** Departure time from each stop. */
  depart: number[];
  /** Arrival at the mandate. */
  end: number;
};

/**
 * Guarded read of a numeric array (strict indexed access). The living
 * background only indexes arrays it built itself; the fallback keeps an
 * out-of-range read harmless instead of producing NaN.
 */
export function valueAt(values: readonly number[], index: number, fallback = 0): number {
  const value = values[index];
  return value === undefined ? fallback : value;
}

export function buildSchedule(spec: SceneSpec): Schedule {
  const arrive: number[] = [];
  const depart: number[] = [];
  let clock = 0;
  for (let stop = 0; stop < STOP_COUNT; stop++) {
    arrive.push(clock);
    const dwell = stop === 0 || stop === STOP_COUNT - 1 ? 0 : stop === GATE_STOP ? spec.gateHold : DWELL_SECONDS;
    const leave = clock + dwell;
    depart.push(leave);
    clock = leave + SEGMENT_SECONDS;
  }
  return { arrive, depart, end: valueAt(arrive, STOP_COUNT - 1) };
}

export type Progress =
  /** On the link `segment` → `segment + 1`, at share `u`. */
  | { kind: "moving"; segment: number; u: number }
  /** Resting on `stop` (waiting for the human validation when it is the gate). */
  | { kind: "resting"; stop: number; since: number; left: number }
  /** Arrived at the mandate `since` seconds ago. */
  | { kind: "arrived"; since: number };

/** Where a file born `age` seconds ago stands on the path. */
export function progressAt(schedule: Schedule, age: number): Progress {
  if (age >= schedule.end) return { kind: "arrived", since: age - schedule.end };
  for (let stop = 0; stop < STOP_COUNT - 1; stop++) {
    const leave = valueAt(schedule.depart, stop);
    if (age < leave) {
      return { kind: "resting", stop, since: age - valueAt(schedule.arrive, stop), left: leave - age };
    }
    if (age < valueAt(schedule.arrive, stop + 1)) {
      return { kind: "moving", segment: stop, u: ease((age - leave) / SEGMENT_SECONDS) };
    }
  }
  return { kind: "arrived", since: 0 };
}

/** Birth-relative time at which a file halted on `segment` stops moving. */
export function haltTime(schedule: Schedule, segment: number): number {
  return valueAt(schedule.depart, segment) + SEGMENT_SECONDS * inverseEaseApprox(HALT_AT);
}

export function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

export function smoothstep(value: number): number {
  const q = clamp01(value);
  return q * q * (3 - 2 * q);
}

/** Ease in and out along a link: the signal slows down near each agent. */
export function ease(value: number): number {
  const q = clamp01(value);
  return q < 0.5 ? 2 * q * q : 1 - (-2 * q + 2) ** 2 / 2;
}

/** Inverse of `ease` (exact for this quadratic). */
function inverseEaseApprox(target: number): number {
  const q = clamp01(target);
  return q < 0.5 ? Math.sqrt(q / 2) : 1 - Math.sqrt((1 - q) / 2);
}

/** Deterministic hash of integers to [0, 1). Decorative only. */
export function hash01(a: number, b: number, c: number, seed: number): number {
  let x = (Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1) ^ seed) >>> 0;
  x = Math.imul(x ^ (x >>> 15), x | 1);
  x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
}
