/**
 * Ambient fictitious prospects of the living background: small grey points that
 * drift towards the entry of the path (or towards the mandate in the final
 * scene), or wander when the flow is broken (problem scene). Pure function of time.
 *
 * In the scenes that draw the mesh (`mesh > 0`), each prospect also gives the
 * mesh one vertex (its resting place), sits on a near or a far plane (the far
 * one paler and smaller) and follows the scroll parallax of its plane. With a
 * mesh weight of 0 every one of those terms is neutral: same prospects as before.
 */

import type { MeshPointDraw, MoteDraw, SceneState, Viewport } from "./types";
import { GOAL_STOP, SCENES } from "./scenes";
import { hash01, valueAt } from "./timeline";

const MOTES_WIDE = 64;
const MOTES_COMPACT = 20;
/** Share of prospects on the far plane. */
const FAR_SHARE = 0.45;
/** Far plane: parallax share, size and opacity reductions (at full mesh weight). */
export const FAR_PLANE = { parallax: 0.4, shrink: 0.3, fade: 0.35 };

export function moteCount(viewport: Viewport): number {
  return viewport.compact ? MOTES_COMPACT : MOTES_WIDE;
}

/** Whether a prospect (and its mesh vertex) belongs to the far plane. Stable. */
export function isFar(index: number, seed: number): boolean {
  return hash01(index, 11, 5, seed) < FAR_SHARE;
}

/** Resting place of a prospect inside the box around the stops (no drift). */
export function moteBase(index: number, box: Box, seed: number): [number, number] {
  return [box.x + hash01(index, 11, 1, seed) * box.width, box.y + hash01(index, 11, 2, seed) * box.height];
}

export function buildMotes(
  state: SceneState,
  points: readonly number[],
  time: number,
  k: number,
  viewport: Viewport,
  seed: number,
  mesh = 0,
  parallax = 0,
  vertices?: MeshPointDraw[],
): MoteDraw[] {
  const motes: MoteDraw[] = [];
  const count = moteCount(viewport);
  const box = bounds(points, viewport);
  const targetStop = state.scene === "final" ? GOAL_STOP : 0;
  const targetX = valueAt(points, targetStop * 2);
  const targetY = valueAt(points, targetStop * 2 + 1);
  const inflowNow = SCENES[state.scene].inflow ? 1 : 0;
  const inflowBefore = state.previous ? (SCENES[state.previous].inflow ? 1 : 0) : inflowNow;
  const inflow = inflowBefore + (inflowNow - inflowBefore) * k;
  for (let index = 0; index < count; index++) {
    const r1 = hash01(index, 11, 1, seed);
    const r2 = hash01(index, 11, 2, seed);
    const r3 = hash01(index, 11, 3, seed);
    const r4 = hash01(index, 11, 4, seed);
    const far = isFar(index, seed);
    const shift = parallax * (far ? FAR_PLANE.parallax : 1);
    const baseX = box.x + r1 * box.width;
    const baseY = box.y + r2 * box.height;
    const wanderX = baseX + Math.sin(time * 0.13 * (1 + r3) + r4 * 6.283) * 18;
    const wanderY = baseY + Math.cos(time * 0.11 * (1 + r4) + r3 * 6.283) * 14;
    const flows = r3 < 0.6 ? inflow : 0;
    const cycle = 9 + r4 * 7;
    const f = (time / cycle + r1) % 1;
    const pull = f * f;
    const flowX = baseX + (targetX - baseX) * pull;
    const flowY = baseY + (targetY - baseY) * pull;
    const flowAlpha = Math.sin(Math.PI * f);
    const wanderAlpha = 0.55 + 0.45 * Math.sin(time * 0.35 + r2 * 6.283);
    motes.push({
      x: wanderX + (flowX - wanderX) * flows,
      y: wanderY + (flowY - wanderY) * flows + shift,
      r: ((viewport.compact ? 0.8 : 0.9) + r4 * 0.7) * (far ? 1 - FAR_PLANE.shrink * mesh : 1),
      alpha: (wanderAlpha + (flowAlpha - wanderAlpha) * flows) * (far ? 1 - FAR_PLANE.fade * mesh : 1),
    });
    // The vertex stays at the resting place; its own dot shows only once the
    // prospect has left it (otherwise the prospect is drawn right there).
    if (vertices && mesh > 0) vertices.push({ x: wanderX, y: wanderY + shift, alpha: flows, far });
  }
  return motes;
}

export type Box = { x: number; y: number; width: number; height: number };

/** Box around the stops, widened: denser in the large empty zones around the path. */
export function bounds(points: readonly number[], viewport: Viewport): Box {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let index = 0; index < points.length; index += 2) {
    const x = valueAt(points, index);
    const y = valueAt(points, index + 1);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const padX = viewport.width * 0.08;
  const padY = viewport.height * 0.08;
  return { x: minX - padX, y: minY - padY, width: maxX - minX + padX * 2, height: maxY - minY + padY * 2 };
}
