export const TAU = Math.PI * 2;

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** Spec §4-D: q = clamp(q, 0, 1); q * q * (3 - 2q). */
export function smoothstep(q: number): number {
  const x = clamp(q, 0, 1);
  return x * x * (3 - 2 * x);
}

/** Softer ease with zero velocity and acceleration at both ends (used by transitions). */
export function smootherstep(q: number): number {
  const x = clamp(q, 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Positive modulo: wrap(value, min, max) always lands in [min, max). */
export function wrap(value: number, min: number, max: number): number {
  const range = max - min;
  return min + ((((value - min) % range) + range) % range);
}
