import { createPrng } from "./prng";

/**
 * Depth of the full-page background (docs/design-system.md §2.5.8).
 *
 * Every particle belongs, once and for all, to one of three planes: far
 * (smaller, paler, barely moving), mid, near (bigger, more opaque, the widest
 * drift). The planes sway together along one slow path, each with its own
 * amplitude: the relative speed between planes reads as parallax. Pure data
 * and pure functions, deterministic (seeded), allocation-free per frame.
 * Only the background mode uses them; zone previews are unchanged.
 */
export const PLANE_FAR = 0;
export const PLANE_MID = 1;
export const PLANE_NEAR = 2;
export type PlaneIndex = typeof PLANE_FAR | typeof PLANE_MID | typeof PLANE_NEAR;

export type DepthPlane = {
  name: "far" | "mid" | "near";
  /** Share of the particles on this plane (the three shares sum to 1). */
  share: number;
  /** Multiplier of the point size. */
  size: number;
  /** Multiplier of the mapped opacity (<= 1: the output ceiling is never exceeded). */
  opacity: number;
  /** Multiplier of the parallax drift (near = 1). */
  drift: number;
};

/** Index = plane. Tuned so the ink (opacity x area) grows by about 30 % over the flat rendering. */
export const DEPTH_PLANES: readonly [DepthPlane, DepthPlane, DepthPlane] = [
  { name: "far", share: 0.4, size: 0.75, opacity: 0.65, drift: 0.3 },
  { name: "mid", share: 0.35, size: 1, opacity: 0.85, drift: 0.6 },
  { name: "near", share: 0.25, size: 1.5, opacity: 1, drift: 1 },
];

/** Largest drift of the near plane, in CSS px (the fit keeps this much free space at the edges). */
export const PARALLAX_MAX_PX = 12;
/** Angular speeds of the sway (rad/s): one full sway takes about a minute, never a jolt. */
const SWAY_X = 0.105;
const SWAY_Y = 0.077;
/** Vertical sway is flatter than the horizontal one. */
const SWAY_Y_RATIO = 0.6;

export const DEPTH_SEED = 20260926;

/** Plane of a uniform draw in [0, 1): far below .40, mid below .75, near above. */
export function planeForDraw(draw: number): PlaneIndex {
  if (draw < DEPTH_PLANES[PLANE_FAR].share) return PLANE_FAR;
  if (draw < DEPTH_PLANES[PLANE_FAR].share + DEPTH_PLANES[PLANE_MID].share) return PLANE_MID;
  return PLANE_NEAR;
}

/**
 * One plane per particle, from its own seeded generator (independent of the
 * shape seeds, so a plane never correlates with a position). The plane of
 * particle i never depends on the capacity.
 */
export function createDepthPlanes(capacity: number, seed = DEPTH_SEED): Uint8Array {
  const random = createPrng(seed);
  const planes = new Uint8Array(capacity);
  for (let i = 0; i < capacity; i++) planes[i] = planeForDraw(random());
  return planes;
}

/** Size multiplier per plane, indexed by plane. */
export const PLANE_SIZE = Float32Array.from(DEPTH_PLANES, (plane) => plane.size);
/** Opacity multiplier per plane, indexed by plane. */
export const PLANE_OPACITY = Float32Array.from(DEPTH_PLANES, (plane) => plane.opacity);

/**
 * Normalised offset of each plane at time `t` (s) for a width x height canvas:
 * writes dx, dy of plane p at out[p * 2], out[p * 2 + 1]. Same path for every
 * plane, amplitude scaled by its drift. Allocation-free.
 */
export function computePlaneOffsets(t: number, width: number, height: number, out: Float32Array): Float32Array {
  const swayX = Math.sin(t * SWAY_X) * PARALLAX_MAX_PX;
  const swayY = Math.sin(t * SWAY_Y + 1.3) * PARALLAX_MAX_PX * SWAY_Y_RATIO;
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  for (let p = 0; p < DEPTH_PLANES.length; p++) {
    const drift = DEPTH_PLANES[p as PlaneIndex].drift;
    out[p * 2] = (swayX * drift) / w;
    out[p * 2 + 1] = (swayY * drift) / h;
  }
  return out;
}

/**
 * Mean ink (opacity x area) of the depth rendering relative to a flat one with
 * the same opacity: sum of share x opacity x size². Documented in the design
 * system; tested so a retune cannot silently change the visibility.
 */
export function depthInkFactor(): number {
  return DEPTH_PLANES.reduce((sum, plane) => sum + plane.share * plane.opacity * plane.size * plane.size, 0);
}
