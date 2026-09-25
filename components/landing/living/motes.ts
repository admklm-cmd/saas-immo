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
import type { MeshLook } from "./mesh-style";
import { frameOf, GOAL_STOP, meshLookOf, SCENES, type FieldZone, type LivingScene } from "./scenes";
import { hash01, valueAt } from "./timeline";

const MOTES_WIDE = 64;
const MOTES_COMPACT = 20;
/** Share of prospects on the far plane. */
const FAR_SHARE = 0.45;
/** Far plane: parallax share, size and opacity reductions (at full mesh weight). */
export const FAR_PLANE = { parallax: 0.4, shrink: 0.3, fade: 0.35 };

/** Prospects of a scene (its mesh profile may ask for more), or the reference count. */
export function moteCount(viewport: Viewport, scene?: LivingScene): number {
  const look = scene ? meshLookOf(scene, viewport.compact) : null;
  return look ? look.points : viewport.compact ? MOTES_COMPACT : MOTES_WIDE;
}

/** Whether a prospect (and its mesh vertex) belongs to the far plane. Stable. */
export function isFar(index: number, seed: number): boolean {
  return hash01(index, 11, 5, seed) < FAR_SHARE;
}

/** Resting place of a prospect inside the box around the stops (no drift). */
export function moteBase(index: number, box: Box, seed: number): [number, number] {
  return [box.x + hash01(index, 11, 1, seed) * box.width, box.y + hash01(index, 11, 2, seed) * box.height];
}

/** Zones of a scene's field on this screen, or null (box around the stops). */
export function fieldOf(scene: LivingScene, viewport: Viewport): readonly FieldZone[] | null {
  const field = SCENES[scene].field;
  return !viewport.compact && field && field.length > 0 ? field : null;
}

/** A prospect's seat in a field: its zone, its rank there and how many share it. */
type Seat = { zone: FieldZone; rank: number; size: number };

const GOLDEN = 0.6180339887498949;
const seats = new WeakMap<readonly FieldZone[], Map<string, readonly Seat[]>>();

/**
 * Seats of the prospects in a field, computed once per field, count and seed.
 * A low-discrepancy sequence gives each zone its share of the prospects
 * (not left to chance: a narrow zone always holds its chain of points).
 */
function seatsOf(field: readonly FieldZone[], count: number, seed: number): readonly Seat[] {
  let byField = seats.get(field);
  if (!byField) {
    byField = new Map();
    seats.set(field, byField);
  }
  const key = `${count}|${seed}`;
  const known = byField.get(key);
  if (known) return known;
  const total = field.reduce((sum, zone) => sum + zone.share, 0);
  const offset = hash01(0, 11, 6, seed);
  const zones: FieldZone[] = [];
  const sizes = new Map<FieldZone, number>();
  for (let index = 0; index < count; index++) {
    let pick = (((index + 1) * GOLDEN + offset) % 1) * total;
    let chosen = field[field.length - 1] as FieldZone;
    for (const zone of field) {
      pick -= zone.share;
      if (pick < 0) {
        chosen = zone;
        break;
      }
    }
    zones.push(chosen);
    sizes.set(chosen, (sizes.get(chosen) ?? 0) + 1);
  }
  const ranks = new Map<FieldZone, number>();
  const result = zones.map((zone) => {
    const rank = ranks.get(zone) ?? 0;
    ranks.set(zone, rank + 1);
    return { zone, rank, size: sizes.get(zone) ?? 1 };
  });
  byField.set(key, result);
  return result;
}

/**
 * Resting place of a prospect in a scene's field, CSS px, and its wandering
 * scale. Along the long side of its zone the prospects are spread evenly
 * (jittered), across it at random: bands and columns keep a regular chain.
 */
export function fieldBase(
  index: number,
  field: readonly FieldZone[],
  frame: { x: number; width: number; height: number },
  viewport: Viewport,
  seed: number,
  count = moteCount(viewport),
): [number, number, number] {
  const seat = seatsOf(field, count, seed)[index];
  const zone = seat?.zone ?? (field[0] as FieldZone);
  const along = ((seat?.rank ?? 0) + 0.25 + 0.5 * hash01(index, 11, 2, seed)) / (seat?.size ?? 1);
  const across = hash01(index, 11, 1, seed);
  const wide = (zone.x1 - zone.x0) * frame.width >= (zone.y1 - zone.y0) * frame.height;
  return [
    frame.x + (zone.x0 + (wide ? along : across) * (zone.x1 - zone.x0)) * frame.width,
    (zone.y0 + (wide ? across : along) * (zone.y1 - zone.y0)) * frame.height,
    zone.sway ?? 1,
  ];
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
  // A scene with a mesh profile may carry more prospects: the extra ones fade
  // in and out with that scene (`own`), the others are shared by both scenes.
  const countNow = moteCount(viewport, state.scene);
  const countBefore = state.previous ? moteCount(viewport, state.previous) : countNow;
  const count = Math.max(countNow, countBefore);
  const kNow = state.previous ? k : 1;
  const box = bounds(points, viewport);
  const targetStop = state.scene === "final" ? GOAL_STOP : 0;
  const targetX = valueAt(points, targetStop * 2);
  const targetY = valueAt(points, targetStop * 2 + 1);
  const inflowNow = SCENES[state.scene].inflow ? 1 : 0;
  const inflowBefore = state.previous ? (SCENES[state.previous].inflow ? 1 : 0) : inflowNow;
  // Mesh profile (agents): every vertex drawn, resting prospects hidden behind
  // it, fewer prospects drifting towards the entry. `styled` blends it in.
  const lookNow = meshLookOf(state.scene, viewport.compact);
  const lookBefore = state.previous ? meshLookOf(state.previous, viewport.compact) : lookNow;
  const look = lookNow ?? lookBefore;
  const styled = (lookNow ? kNow : 0) + (state.previous && lookBefore ? 1 - k : 0);
  // Field of the scene (agents, desktop) and of the previous one: the resting
  // places blend from one to the other like the stops, no jump.
  const fieldNow = fieldOf(state.scene, viewport);
  const fieldBefore = state.previous ? fieldOf(state.previous, viewport) : null;
  const frameNow = frameOf(SCENES[state.scene], viewport);
  const frameBefore = state.previous ? frameOf(SCENES[state.previous], viewport) : frameNow;
  // Resting place of each scene's entry (static): which prospects drift never
  // changes while the displayed path moves between two layouts.
  const entryNow = lookNow ? restingStop(state.scene, targetStop, viewport) : null;
  const entryBefore = state.previous && lookBefore ? restingStop(state.previous, targetStop, viewport) : null;
  for (let index = 0; index < count; index++) {
    const r1 = hash01(index, 11, 1, seed);
    const r2 = hash01(index, 11, 2, seed);
    const r3 = hash01(index, 11, 3, seed);
    const r4 = hash01(index, 11, 4, seed);
    const far = isFar(index, seed);
    const shift = parallax * (far ? FAR_PLANE.parallax : 1);
    let baseX = box.x + r1 * box.width;
    let baseY = box.y + r2 * box.height;
    let sway = 1;
    let now: readonly number[] = [baseX, baseY, 1];
    let before: readonly number[] = now;
    if (fieldNow || fieldBefore) {
      now = fieldNow ? fieldBase(index, fieldNow, frameNow, viewport, seed, countNow) : [baseX, baseY, 1];
      before = !state.previous
        ? now
        : fieldBefore
          ? fieldBase(index, fieldBefore, frameBefore, viewport, seed, countBefore)
          : [baseX, baseY, 1];
      baseX = valueAt(before, 0) + (valueAt(now, 0) - valueAt(before, 0)) * k;
      baseY = valueAt(before, 1) + (valueAt(now, 1) - valueAt(before, 1)) * k;
      sway = valueAt(before, 2) + (valueAt(now, 2) - valueAt(before, 2)) * k;
    }
    const wanderX = baseX + Math.sin(time * 0.13 * (1 + r3) + r4 * 6.283) * 18 * sway;
    const wanderY = baseY + Math.cos(time * 0.11 * (1 + r4) + r3 * 6.283) * 14 * sway;
    const flowsNow = drifts(r3, lookNow, now, entryNow) ? inflowNow : 0;
    const flowsBefore = state.previous ? (drifts(r3, lookBefore, before, entryBefore) ? inflowBefore : 0) : flowsNow;
    const flows = flowsBefore + (flowsNow - flowsBefore) * k;
    const cycle = 9 + r4 * 7;
    const f = (time / cycle + r1) % 1;
    const pull = f * f;
    const flowX = baseX + (targetX - baseX) * pull;
    const flowY = baseY + (targetY - baseY) * pull;
    const flowAlpha = Math.sin(Math.PI * f);
    const wanderAlpha = 0.55 + 0.45 * Math.sin(time * 0.35 + r2 * 6.283);
    const own = index < countNow ? (index < countBefore ? 1 : kNow) : 1 - k;
    let alpha = (wanderAlpha + (flowAlpha - wanderAlpha) * flows) * (far ? 1 - FAR_PLANE.fade * mesh : 1);
    if (styled > 0) alpha *= 1 - styled * (1 - flows);
    if (own < 1) alpha *= own;
    // Entering or leaving a mesh profile, a prospect may drift in one scene and
    // rest in the other: its drift restarts (jump back to its resting place)
    // while invisible, as in the reference inflow.
    if (look && flowsNow !== flowsBefore) alpha *= Math.min(1, flowAlpha / 0.25);
    motes.push({
      x: wanderX + (flowX - wanderX) * flows,
      y: wanderY + (flowY - wanderY) * flows + shift,
      r: ((viewport.compact ? 0.8 : 0.9) + r4 * 0.7) * (far ? 1 - FAR_PLANE.shrink * mesh : 1),
      alpha,
    });
    // The vertex stays at the resting place; in the reference mesh its own dot
    // shows only once the prospect has left it (otherwise the prospect is drawn
    // right there). With a mesh profile every vertex is drawn (`look`).
    if (vertices && mesh > 0) {
      const vertex: MeshPointDraw = {
        x: wanderX,
        y: wanderY + shift,
        alpha: styled > 0 || own < 1 ? flows * (1 - styled) * own : flows,
        far,
      };
      if (look && styled > 0) vertex.look = vertexLook(index, far, look, styled * own, seed);
      vertices.push(vertex);
    }
  }
  return motes;
}

/** Whether a prospect drifts towards the entry in a scene (reference: 60 % of them). */
function drifts(r3: number, look: MeshLook | null, rest: readonly number[], entry: readonly number[] | null): boolean {
  if (!look) return r3 < 0.6;
  if (r3 >= look.inflowShare) return false;
  if (!entry) return true;
  return Math.hypot(valueAt(rest, 0) - valueAt(entry, 0), valueAt(rest, 1) - valueAt(entry, 1)) <= look.inflowReach;
}

/** Resting place of a stop in a scene's layout, CSS px (no wandering). */
function restingStop(scene: LivingScene, stop: number, viewport: Viewport): readonly number[] {
  const spec = SCENES[scene];
  const frame = frameOf(spec, viewport);
  const [nx, ny] = (viewport.compact ? spec.compact : spec.wide)[stop] ?? [0.5, 0.5];
  return [frame.x + nx * frame.width, ny * frame.height];
}

/** Dot of a vertex under a mesh profile: size, opacity (times `weight`), hub or not. Stable. */
export function vertexLook(index: number, far: boolean, look: MeshLook, weight: number, seed: number) {
  const hub = !far && hash01(index, 11, 7, seed) < look.hubShare;
  const r = far
    ? look.farRadius
    : hub
      ? look.hubRadius
      : look.radius[0] + hash01(index, 11, 8, seed) * (look.radius[1] - look.radius[0]);
  return { r, hub, alpha: weight * (far ? look.farPoint : hub ? look.hub : look.point) };
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
