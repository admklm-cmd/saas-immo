import { lerp, smoothstep, TAU } from "../engine/math";
import { depthAlpha, spherePoint } from "./sphere";
import { MAX_ALPHA, MIN_ALPHA, POINT_STRIDE, type ShapeDefinition, type ShapeFn } from "./types";

export const AGENTS_CYCLE = 14;

/** Group centres (x, y), y pointing down: two forms on each side of the centre. */
export const AGENT_GROUP_CENTERS: readonly (readonly [number, number])[] = [
  [-1.9, 0.05], // 0 — three-lobed organic mass
  [-0.63, -0.08], // 1 — twisted, rotating torus
  [0.63, 0.05], // 2 — soft vertical helix
  [1.9, -0.05], // 3 — five-lobed star membrane
];
/** Each form lives with its own phase. */
const GROUP_PHASE = [0, 1.7, 3.1, 4.4] as const;

const scratch = new Float32Array(3);

/**
 * Split factor of the 14 s loop (spec §4-D):
 * smoothstep((cycle - 2)/3) * (1 - smoothstep((cycle - 11)/3)).
 * 0 on [0, 2] and at 14, 1 on [5, 11].
 */
export function agentsSplit(cycle: number): number {
  return smoothstep((cycle - 2) / 3) * (1 - smoothstep((cycle - 11) / 3));
}

/**
 * Point of a group form, relative to the group centre, at local time `lt`.
 * Writes x, y, alpha into out[o..o+2]. Exported for the "four distinct forms" test.
 */
export function agentFormPoint(group: number, s0: number, s1: number, s2: number, lt: number, out: Float32Array, o: number): void {
  const a = s0 * TAU;
  if (group === 0) {
    // Three-lobed mass that slowly deforms and turns.
    const r = Math.pow(s1, 0.45);
    const boundary = 0.4 * (1 + 0.26 * Math.sin(3 * a + 0.7 * lt) + 0.07 * Math.sin(5 * a - 1.3 * lt));
    const turn = a + 0.12 * lt;
    out[o] = r * boundary * Math.cos(turn);
    out[o + 1] = r * boundary * Math.sin(turn) * 0.92;
    out[o + 2] = MIN_ALPHA + (0.3 + 0.7 * Math.sqrt(1 - r * r)) * (MAX_ALPHA - MIN_ALPHA) * 0.9;
  } else if (group === 1) {
    // Elliptical torus: a travelling warp twists it while it spins and rocks.
    const b = s1 * TAU;
    const spin = a + 0.5 * lt;
    const tube = 0.075 + 0.025 * Math.sin(3 * a + 1.1 * lt);
    const ring = 0.4 + tube * Math.cos(b);
    const px = ring * Math.cos(spin);
    const py = ring * Math.sin(spin);
    const pz = tube * Math.sin(b) + 0.065 * Math.sin(2 * spin + 1.4 * lt);
    const tilt = 1 + 0.12 * Math.sin(0.6 * lt);
    const yaw = 0.3 * Math.sin(0.5 * lt);
    const z = py * Math.sin(tilt) + pz * Math.cos(tilt);
    out[o] = px * Math.cos(yaw) + z * Math.sin(yaw);
    out[o + 1] = py * Math.cos(tilt) - pz * Math.sin(tilt);
    out[o + 2] = depthAlpha(Math.max(-1, Math.min(1, z / 0.5)));
  } else if (group === 2) {
    // Two-strand helix, softly swaying.
    const h = s0;
    const angle = h * TAU * 2.2 + 1.3 * lt + (s1 < 0.5 ? 0 : Math.PI);
    const radius = 0.18 + 0.04 * Math.sin(h * 6.3 + lt);
    const z = Math.sin(angle);
    out[o] = radius * Math.cos(angle) + 0.07 * Math.sin(h * 3.1 + 0.8 * lt) + (s2 - 0.5) * 0.03;
    out[o + 1] = (h - 0.5) * 1.5 + 0.05 * z;
    out[o + 2] = depthAlpha(z);
  } else {
    // Five-lobed membrane that breathes, with a ripple running outwards.
    const rr = Math.pow(s1, 0.6);
    const boundary = 0.36 * (1 + 0.08 * Math.sin(0.9 * lt)) * (1 + 0.3 * Math.cos(5 * a + 0.3 * lt));
    const r = rr * boundary + 0.025 * rr * Math.sin(rr * 14 - 2.2 * lt);
    out[o] = r * Math.cos(a);
    out[o + 1] = r * Math.sin(a);
    out[o + 2] = MIN_ALPHA + (0.35 + 0.65 * rr) * (MAX_ALPHA - MIN_ALPHA) * 0.85;
  }
}

/**
 * Agents IA — one sphere that splits into four living forms and recomposes
 * (spec §4-D). Same particles throughout: group = index % 4 ;
 * position = lerp(pointOnSphere, groupCentre + formPoint, split).
 * The sphere spin uses a time that wraps at 8 s, while split = 1 and the
 * sphere carries no weight, so the loop joins exactly at 14 s.
 */
export const agentsShape: ShapeFn = (index, _count, t, seeds, out) => {
  const cycle = ((t % AGENTS_CYCLE) + AGENTS_CYCLE) % AGENTS_CYCLE;
  const split = agentsSplit(cycle);
  const s = index * 4;
  const s0 = seeds[s] ?? 0;
  const s1 = seeds[s + 1] ?? 0;
  const o = index * POINT_STRIDE;

  const group = index % 4;
  const center = AGENT_GROUP_CENTERS[group] ?? [0, 0];
  if (split >= 1) {
    // Four forms only (5–11 s): the sphere carries no weight, skip it.
    agentFormPoint(group, s0, s1, seeds[s + 2] ?? 0, cycle + (GROUP_PHASE[group] ?? 0), out, o);
    out[o] = center[0] + (out[o] ?? 0);
    out[o + 1] = center[1] + (out[o + 1] ?? 0);
    return;
  }
  const sphereTime = cycle < 8 ? cycle : cycle - AGENTS_CYCLE;
  spherePoint(s0, s1, sphereTime * 1.6, sphereTime, 1, out, o);
  const sphereX = out[o] ?? 0;
  const sphereY = out[o + 1] ?? 0;
  const sphereAlpha = depthAlpha(out[o + 2] ?? 0);
  if (split <= 0) {
    out[o + 2] = sphereAlpha;
    return;
  }
  agentFormPoint(group, s0, s1, seeds[s + 2] ?? 0, cycle + (GROUP_PHASE[group] ?? 0), scratch, 0);
  out[o] = lerp(sphereX, center[0] + (scratch[0] ?? 0), split);
  out[o + 1] = lerp(sphereY, center[1] + (scratch[1] ?? 0), split);
  out[o + 2] = lerp(sphereAlpha, scratch[2] ?? 0, split);
};

export const agents: ShapeDefinition = {
  shape: agentsShape,
  // Forms reach at most 0.54 from their centre (0.8 vertically for the helix);
  // a lerp between two points inside the box stays inside the box.
  bounds: { minX: -2.45, maxX: 2.45, minY: -1, maxY: 1 },
  cycle: AGENTS_CYCLE,
  staticTime: 8,
  maxStretch: 1,
};
