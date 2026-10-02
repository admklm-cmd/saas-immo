/**
 * Centred composition, softened sides (docs/design-system.md §2.11.4,
 * « Composition centrée, bords atténués »). Pure:
 * - `edgeFade(u)`: rest opacity factor of a fiber or a body whose projected
 *   centre is at u (fraction of W) from the nearest side edge;
 * - `centerOffset(...)`: horizontal shift of the projection centre that
 *   brings the ink's centre of mass back to 0.5 W, at the reference pose,
 *   capped; computed on resize only, never per frame;
 * - `inkProfile(...)`: the ink measure used by both (and by the tests).
 *
 * « Ink » = Σ rest opacity × line width × projected length of the fiber
 * segments inside the window (bodies are left out: they weigh < 1 %).
 */

import { createProjector, nearness, REDUCED_POSE, setProjector, type Pose, type Projector } from "./camera";
import type { Network, ScreenClass } from "./network";

/** Opacity lost at the very edge (× 0.80 at u = 0). */
export const EDGE_FADE = 0.2;
/** Width of the soft band, fraction of W: × 1 from 15 % of W inwards. */
export const EDGE_FADE_BAND = 0.15;
/** Cap of the recentring shift, fraction of W (fallback 0.06 if a contrast threshold falls). */
export const CENTER_OFFSET_CAP = 0.1;
/** Fixed-point passes of the recentring. */
export const CENTER_OFFSET_PASSES = 3;

export function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** f(u) = 1 − EDGE_FADE × (1 − smoothstep(0, EDGE_FADE_BAND, u)); u < 0 counts as 0. */
export function edgeFade(u: number, fade = EDGE_FADE): number {
  return 1 - fade * (1 - smoothstep(0, EDGE_FADE_BAND, u < 0 ? 0 : u));
}

/** f of a screen x in a window of width W: distance to the nearest side edge, in W. */
export function edgeFadeAt(x: number, width: number, fade = EDGE_FADE): number {
  if (fade === 0 || width <= 0) return 1;
  return edgeFade(Math.min(x, width - x) / width, fade);
}

/** Rest opacity of a fiber, before the edge fade (reference formula, §2.11.4). */
export function fiberRestAlpha(near: number, ownAlpha: number): number {
  const value = (0.045 + Math.pow(near, 1.6) * 0.66) * ownAlpha;
  return value < 0.025 ? 0.025 : value > 0.95 ? 0.95 : value;
}

export type InkProfile = {
  total: number;
  /** Horizontal centre of mass, fraction of W. */
  center: number;
  /** Ink per tenth of the width (sums to `total`). */
  deciles: number[];
};

export type InkOptions = {
  pose?: Pose;
  offsetX?: number;
  fade?: number;
};

/**
 * Ink of the fibers in a window, along x: total, centre of mass and deciles.
 * Same projection, opacity, widths (three tapered sections) and edge fade as
 * the painter; a segment counts when its middle is inside the window.
 */
export function inkProfile(
  network: Network,
  width: number,
  height: number,
  screenClass: ScreenClass,
  { pose = REDUCED_POSE, offsetX = 0, fade = EDGE_FADE }: InkOptions = {},
): InkProfile {
  const projector = setProjector(createProjector(), pose.yaw, pose.pitch, width, height, screenClass, offsetX);
  const screen = projectPoints(network, projector);
  const deciles = new Array<number>(10).fill(0);
  let total = 0;
  let moment = 0;
  for (let f = 0; f < network.fiberCount; f++) {
    const owner = network.fiberOwner[f]!;
    const near = nearness(nodeDepth(network, projector, owner));
    const start = network.fiberStart[f]!;
    const last = network.fiberSize[f]! - 1;
    const middle = start + Math.floor(last / 2);
    const alpha = fiberRestAlpha(near, network.fiberAlpha[f]!) * edgeFadeAt(screen[middle * 2]!, width, fade);
    const spread = 0.48 + near * 0.62;
    for (let part = 0; part < 3; part++) {
      const lineWidth = Math.max(0.18, (network.fiberWidth[f]! * (1 - part / 3) + (network.fiberEndWidth[f]! * part) / 3) * spread);
      const first = start + Math.floor((last * part) / 3);
      const end = start + Math.floor((last * (part + 1)) / 3);
      for (let i = first; i < end; i++) {
        const x0 = screen[i * 2]!;
        const y0 = screen[i * 2 + 1]!;
        const x1 = screen[(i + 1) * 2]!;
        const y1 = screen[(i + 1) * 2 + 1]!;
        const mx = (x0 + x1) / 2;
        const my = (y0 + y1) / 2;
        if (mx < 0 || mx >= width || my < 0 || my >= height) continue;
        const ink = alpha * lineWidth * Math.hypot(x1 - x0, y1 - y0);
        total += ink;
        moment += ink * mx;
        deciles[Math.min(9, Math.floor((mx / width) * 10))]! += ink;
      }
    }
  }
  return { total, center: total > 0 ? moment / total / width : 0.5, deciles };
}

/**
 * Shift of the projection centre (CSS px) that puts the ink's centre of mass
 * at 0.5 W for the reference pose (yaw 0, pitch 0.055 = reduced-motion pose),
 * edge fade included; CENTER_OFFSET_PASSES fixed-point passes, capped to
 * ± cap × W. Deterministic.
 */
export function centerOffset(
  network: Network,
  width: number,
  height: number,
  screenClass: ScreenClass,
  { cap = CENTER_OFFSET_CAP, fade = EDGE_FADE }: { cap?: number; fade?: number } = {},
): number {
  if (width <= 0 || height <= 0) return 0;
  const limit = cap * width;
  let offset = 0;
  for (let pass = 0; pass < CENTER_OFFSET_PASSES; pass++) {
    const { center, total } = inkProfile(network, width, height, screenClass, { offsetX: offset, fade });
    if (total <= 0) break;
    offset = Math.min(limit, Math.max(-limit, offset - (center - 0.5) * width));
  }
  return offset;
}

function projectPoints(network: Network, projector: Projector): Float64Array {
  const { cosYaw, sinYaw, cosPitch, sinPitch, size, centerX, centerY } = projector;
  const screen = new Float64Array(network.pointCount * 2);
  const points = network.points;
  for (let i = 0; i < network.pointCount; i++) {
    const x = points[i * 3]!;
    const y = points[i * 3 + 1]!;
    const z = points[i * 3 + 2]!;
    const rx = x * cosYaw + z * sinYaw;
    const rz = -x * sinYaw + z * cosYaw;
    const ry = y * cosPitch - rz * sinPitch;
    const depth = y * sinPitch + rz * cosPitch;
    const scale = (size * 4.5) / (4.5 + depth);
    screen[i * 2] = centerX + rx * scale;
    screen[i * 2 + 1] = centerY + ry * scale;
  }
  return screen;
}

function nodeDepth(network: Network, projector: Projector, node: number): number {
  const z = network.nodeZ[node]!;
  const rz = -network.nodeX[node]! * projector.sinYaw + z * projector.cosYaw;
  return network.nodeY[node]! * projector.sinPitch + rz * projector.cosPitch;
}
