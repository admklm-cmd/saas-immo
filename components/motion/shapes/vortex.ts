import { lerp, smoothstep, TAU } from "../engine/math";
import { depthAlpha } from "./sphere";
import { MAX_ALPHA, MIN_ALPHA, POINT_STRIDE, type ShapeDefinition, type ShapeFn } from "./types";

export const VORTEX_CYCLE = 18;
export const VORTEX_INNER_RADIUS = 0.3;
export const VORTEX_OUTER_RADIUS = 1.25;
const OUTER_RADIUS = VORTEX_OUTER_RADIUS;
/** Inclination of the disk: vertical squash of the orbit. */
export const VORTEX_TILT = 0.36;

const PEAK_X = [-0.58, 0.02, 0.56, -0.12] as const;
const PEAK_Z = [-0.22, 0.38, -0.08, -0.62] as const;
const PEAK_H = [0.66, 0.48, 0.86, 0.58] as const;
const PEAK_SPREAD = [0.07, 0.06, 0.08, 0.05] as const;

/** Spec §4-E: morph = smoothstep((cycle - 3)/4) * (1 - smoothstep((cycle - 14)/4)). */
export function vortexMorph(cycle: number): number {
  return smoothstep((cycle - 3) / 4) * (1 - smoothstep((cycle - 14) / 4));
}

/** Share of the orbit speed kept while the relief is fully formed (the relief drifts slowly). */
const TERRAIN_DRIFT = 0.25;
const PHASE_STEP = 0.01;

/**
 * Orbit phase P(c) = integral of (1 - (1 - TERRAIN_DRIFT) * morph) from 0 to c,
 * tabulated once (deterministic). The orbit slows down while the vortex becomes
 * a relief, so each particle lands on the terrain along its own radius.
 */
const ORBIT_PHASE = (() => {
  const samples = Math.round(VORTEX_CYCLE / PHASE_STEP);
  const table = new Float64Array(samples + 1);
  const rate = (c: number) => 1 - (1 - TERRAIN_DRIFT) * vortexMorph(c);
  for (let k = 1; k <= samples; k++) {
    table[k] = (table[k - 1] ?? 0) + ((rate((k - 1) * PHASE_STEP) + rate(k * PHASE_STEP)) / 2) * PHASE_STEP;
  }
  return table;
})();
const ORBIT_PERIOD = ORBIT_PHASE[ORBIT_PHASE.length - 1] ?? 1;

/** Normalised orbit progress in [0, 1] over one cycle (linear interpolation of the table). */
export function orbitProgress(cycle: number): number {
  const position = cycle / PHASE_STEP;
  const k = Math.min(ORBIT_PHASE.length - 2, Math.floor(position));
  const f = position - k;
  return ((ORBIT_PHASE[k] ?? 0) * (1 - f) + (ORBIT_PHASE[k + 1] ?? 0) * f) / ORBIT_PERIOD;
}

/**
 * Whole number of turns per cycle (so the 18 s loop closes exactly): mostly 3
 * near the centre, 1 at the rim, mixed per particle so no band is visible.
 */
function orbitTurns(radiusRatio: number, seed: number): number {
  const turns = 1 + 2.2 * Math.pow(1 - radiusRatio, 1.6) + (seed - 0.5) * 0.9;
  const rounded = Math.min(3, Math.max(1, Math.round(turns)));
  return rounded === 3 && radiusRatio > 0.35 ? 2 : rounded;
}

/**
 * Relief height at plane coordinates (u, v) in [-1, 1]: four gaussian peaks
 * whose positions and heights drift, plus small seismic undulations (spec §4-E:
 * peak(u, v, cx, cz, spread, h) = h * exp(-((u - cx)^2 + (v - cz)^2) / spread)).
 */
export function terrainHeight(u: number, v: number, cycle: number): number {
  if (cycle !== peakCycle) updatePeaks(cycle);
  let height = 0;
  for (let k = 0; k < 4; k++) {
    const du = u - (peakParams[k * 4] ?? 0);
    const dv = v - (peakParams[k * 4 + 1] ?? 0);
    height += (peakParams[k * 4 + 2] ?? 0) * Math.exp(-(du * du + dv * dv) / (peakParams[k * 4 + 3] ?? 0.06));
  }
  const du = u - 0.2;
  const dv = v - 0.1;
  const distance = Math.sqrt(du * du + dv * dv);
  height += 0.03 * Math.sin(9 * u + 4 * v - 3.1 * cycle) * seismicGain;
  height += 0.018 * Math.sin(15 * distance - 4 * cycle) * Math.exp(-1.5 * distance);
  return height;
}

// Peak centres, heights and spreads depend on time only: computed once per
// instant instead of once per particle (pure memo, same results).
const peakParams = new Float64Array(16);
let peakCycle = Number.NaN;
let seismicGain = 0;
function updatePeaks(cycle: number): void {
  peakCycle = cycle;
  seismicGain = 0.6 + 0.4 * Math.sin(1.3 * cycle);
  for (let k = 0; k < 4; k++) {
    peakParams[k * 4] = (PEAK_X[k] ?? 0) + 0.08 * Math.sin(0.31 * cycle + k * 1.3);
    peakParams[k * 4 + 1] = (PEAK_Z[k] ?? 0) + 0.06 * Math.cos(0.27 * cycle + k);
    peakParams[k * 4 + 2] = (PEAK_H[k] ?? 0) * (0.78 + 0.22 * Math.sin(0.9 * cycle + k * 2.1));
    peakParams[k * 4 + 3] = PEAK_SPREAD[k] ?? 0.06;
  }
}

/** Height multiplier: peaks emerge once the disk has flattened, then sink. */
export function reliefAmplitude(cycle: number): number {
  return smoothstep((cycle - 3.6) / 3.2) * (1 - smoothstep((cycle - 13.6) / 3));
}

/**
 * Terrain projection. The relief is the vortex disk itself, seen in perspective:
 * same plane, same orbit angle, same outer radius. Compatible outlines are what
 * make position = lerp(vortex, terrain, morph) read as one surface rising and
 * sinking. (A square terrain, narrower than the vortex at mid-depth, used to make
 * the reforming vortex visibly contract then widen again around 15–17 s.)
 */
export const TERRAIN_TILT = 0.34;
/** Perspective strength k: front/back scale ratio (1 + k) / (1 - k) ≈ 1.8, scale 1 at mid-depth. */
const TERRAIN_PERSPECTIVE = 0.286;
const TERRAIN_HEIGHT = 0.82;

/**
 * Terrain point at plane radius `planeRadius` (0 to the outer radius) and orbit
 * angle `angle`. Writes x, y and opacity into out[o..o+2].
 */
export function terrainPoint(planeRadius: number, angle: number, cycle: number, out: Float32Array, o: number): void {
  const u = (planeRadius / OUTER_RADIUS) * Math.cos(angle);
  const v = (planeRadius / OUTER_RADIUS) * Math.sin(angle);
  const height = terrainHeight(u, v, cycle) * reliefAmplitude(cycle) * TERRAIN_HEIGHT;
  const scale = 1 / (1 - TERRAIN_PERSPECTIVE * v);
  out[o] = u * OUTER_RADIUS * scale;
  out[o + 1] = (v * OUTER_RADIUS * TERRAIN_TILT - height) * scale;
  out[o + 2] = Math.min(MAX_ALPHA, MIN_ALPHA + ((v + 1) / 2) * 0.26 + Math.max(0, height) * 0.3);
}

/**
 * Messages à valider — black-hole vortex that becomes a mountain relief
 * (spec §4-E). Empty centre, dense inner crown, faster inner orbit, tilted disk;
 * position = lerp(vortex, terrain, morph). Vortex and terrain derive from the
 * same orbit angle on the same disk, so each particle rises and sinks along its
 * own radius, and every particle makes a whole number of turns per cycle: the
 * loop closes exactly.
 */
export const vortexShape: ShapeFn = (index, _count, t, seeds, out) => {
  const cycle = ((t % VORTEX_CYCLE) + VORTEX_CYCLE) % VORTEX_CYCLE;
  const morph = vortexMorph(cycle);
  const s = index * 4;
  const s0 = seeds[s] ?? 0;
  const s1 = seeds[s + 1] ?? 0;
  const s2 = seeds[s + 2] ?? 0;
  const o = index * POINT_STRIDE;

  const radius = VORTEX_INNER_RADIUS + (OUTER_RADIUS - VORTEX_INNER_RADIUS) * Math.pow(s1, 1.8);
  const radiusRatio = (radius - VORTEX_INNER_RADIUS) / (OUTER_RADIUS - VORTEX_INNER_RADIUS);
  const angle = s0 * TAU + TAU * orbitTurns(radiusRatio, seeds[s + 3] ?? 0) * orbitProgress(cycle);
  const vortexX = radius * Math.cos(angle);
  const vortexY = radius * Math.sin(angle) * VORTEX_TILT + (s2 - 0.5) * 0.04 * (radius / OUTER_RADIUS);
  const vortexAlpha = Math.max(MIN_ALPHA, depthAlpha(Math.sin(angle)) * (0.72 + 0.28 * (VORTEX_INNER_RADIUS / radius)));
  if (morph <= 0) {
    out[o] = vortexX;
    out[o + 1] = vortexY;
    out[o + 2] = vortexAlpha;
    return;
  }

  // Terrain: same angle, radius spread uniformly over the whole disk (no hole).
  terrainPoint(OUTER_RADIUS * Math.sqrt(s1), angle, cycle, out, o);
  out[o] = lerp(vortexX, out[o] ?? 0, morph);
  out[o + 1] = lerp(vortexY, out[o + 1] ?? 0, morph);
  out[o + 2] = lerp(vortexAlpha, out[o + 2] ?? 0, morph);
};

export const vortex: ShapeDefinition = {
  shape: vortexShape,
  // Rim of the terrain disk reaches x ≈ ±1.304; highest peak y ≈ -0.74; front edge y ≈ 0.63 (measured, tested).
  bounds: { minX: -1.31, maxX: 1.31, minY: -0.76, maxY: 0.64 },
  cycle: VORTEX_CYCLE,
  staticTime: 10,
  maxStretch: 1,
};
