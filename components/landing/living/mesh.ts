/**
 * Mesh of the living background (problem and agents scenes only): the ambient
 * prospects are linked to a few neighbours and to the nearest stop of the path,
 * like a quiet neural network behind the content.
 *
 * - Links are chosen ONCE per scene and viewport, from the resting places of
 *   the prospects in the scene's static layout (no drift, no time): the same
 *   pairs stay linked from one frame to the next, nothing flickers.
 * - Resting links are grey. Only what moves is cobalt: a few slow impulses
 *   travel along some links (at most `PULSES.wide` at once).
 * - Every opacity is scaled by the blended mesh weight, so the mesh fades in
 *   and out with the scene and is absent (0) from every other scene.
 * - The fictitious files keep travelling the 8-stop path only (files.ts).
 */

import { bounds, isFar, moteBase, moteCount } from "./motes";
import { meshOf, SCENES, STOP_COUNT, type LivingScene, type Point } from "./scenes";
import { ease, hash01, smoothstep, valueAt } from "./timeline";
import type { Frame, MeshPointDraw, SceneState, Viewport } from "./types";

/** Most links a scene may draw (wide, compact). */
export const MESH_LINK_CAP = { wide: 150, compact: 30 } as const;
/** Largest vertical parallax shift of the near plane, CSS px. */
export const PARALLAX_MAX = 20;
/** Impulses travelling at once, seconds between two departures of a slot, travel time. */
export const PULSES = { wide: 3, compact: 1, period: 7.5, travel: 2.8 } as const;

/** Each prospect links to its 2 nearest neighbours, some to a third one. */
const NEIGHBOURS = 2;
const THIRD_NEIGHBOUR_SHARE = 0.35;
/** A prospect links to the nearest stop only when it lies within this distance, CSS px. */
const STOP_REACH = { wide: 190, compact: 80 } as const;
/** Links fade with their current length: full up to the first value, gone at the second. */
const FADE_LENGTH = { wide: [80, 220], compact: [60, 150] } as const;

/** A link between two prospects (`b` a prospect) or a prospect and a stop (`b` a stop). */
export type MeshLink = { a: number; b: number; toStop: boolean; far: boolean };

const cache = new Map<string, readonly MeshLink[]>();
const NONE: readonly MeshLink[] = [];

/**
 * Links of a scene on a given viewport. Computed once, then read from a cache
 * (a resize or a new scene computes a new set; nothing is computed per frame).
 */
export function meshLinksOf(scene: LivingScene, viewport: Viewport, seed: number): readonly MeshLink[] {
  const spec = SCENES[scene];
  if (spec.mesh <= 0) return NONE;
  const key = `${scene}|${viewport.width}|${viewport.height}|${viewport.compact ? 1 : 0}|${seed}`;
  const known = cache.get(key);
  if (known) return known;

  const layout: readonly Point[] = viewport.compact ? spec.compact : spec.wide;
  const stops: number[] = [];
  for (let stop = 0; stop < STOP_COUNT; stop++) {
    const [nx, ny] = layout[stop] ?? [0.5, 0.5];
    stops.push(nx * viewport.width, ny * viewport.height);
  }
  const box = bounds(stops, viewport);
  const count = moteCount(viewport);
  const places = Array.from({ length: count }, (_, index) => moteBase(index, box, seed));

  const candidates: { link: MeshLink; length: number }[] = [];
  const seen = new Set<number>();
  for (let a = 0; a < count; a++) {
    const [ax, ay] = places[a] ?? [0, 0];
    const wanted = NEIGHBOURS + (hash01(a, 17, 1, seed) < THIRD_NEIGHBOUR_SHARE ? 1 : 0);
    const nearest = places
      .map(([bx, by], b) => ({ b, length: Math.hypot(bx - ax, by - ay) }))
      .filter((entry) => entry.b !== a)
      .sort((left, right) => left.length - right.length || left.b - right.b)
      .slice(0, wanted);
    for (const { b, length } of nearest) {
      const id = Math.min(a, b) * 1024 + Math.max(a, b);
      if (seen.has(id)) continue;
      seen.add(id);
      candidates.push({ link: { a, b, toStop: false, far: isFar(a, seed) && isFar(b, seed) }, length });
    }
    let bestStop = 0;
    let bestLength = Infinity;
    for (let stop = 0; stop < STOP_COUNT; stop++) {
      const length = Math.hypot(valueAt(stops, stop * 2) - ax, valueAt(stops, stop * 2 + 1) - ay);
      if (length < bestLength) {
        bestLength = length;
        bestStop = stop;
      }
    }
    if (bestLength <= STOP_REACH[viewport.compact ? "compact" : "wide"]) {
      candidates.push({ link: { a, b: bestStop, toStop: true, far: false }, length: bestLength });
    }
  }
  // Shortest links first: the cap drops the long, faint ones.
  candidates.sort((left, right) => left.length - right.length);
  const links = candidates.slice(0, MESH_LINK_CAP[viewport.compact ? "compact" : "wide"]).map((entry) => entry.link);
  if (cache.size > 24) cache.clear();
  cache.set(key, links);
  return links;
}

/** Mesh weight displayed at `time`, blended like the presence: no jump between scenes. */
export function meshWeight(state: SceneState, viewport: Viewport, k: number): number {
  const now = meshOf(SCENES[state.scene], viewport.compact);
  if (!state.previous) return now;
  const before = meshOf(SCENES[state.previous], viewport.compact);
  return before + (now - before) * k;
}

/**
 * Adds the mesh links and the cobalt impulses of the current scene (fading
 * in) and of the previous one (fading out) to the frame. `frame.meshPoints`
 * must already hold the vertices (one per prospect, see motes.ts).
 */
export function addMesh(
  frame: Frame,
  state: SceneState,
  points: readonly number[],
  time: number,
  k: number,
  viewport: Viewport,
  seed: number,
) {
  const current = meshOf(SCENES[state.scene], viewport.compact) * (state.previous ? k : 1);
  const previous = state.previous ? meshOf(SCENES[state.previous], viewport.compact) * (1 - k) : 0;
  if (current > 0.01) addLinks(frame, meshLinksOf(state.scene, viewport, seed), current, points, viewport);
  if (state.previous && previous > 0.01) addLinks(frame, meshLinksOf(state.previous, viewport, seed), previous, points, viewport);
  // Impulses follow the dominant scene only: never twice as many during a change.
  const scene = current >= previous || !state.previous ? state.scene : state.previous;
  addPulses(frame, meshLinksOf(scene, viewport, seed), Math.max(current, previous), points, time, viewport, seed);
}

function ends(link: MeshLink, vertices: readonly MeshPointDraw[], points: readonly number[]): [number, number, number, number] {
  const a = vertices[link.a];
  const x1 = a?.x ?? 0;
  const y1 = a?.y ?? 0;
  if (link.toStop) return [x1, y1, valueAt(points, link.b * 2), valueAt(points, link.b * 2 + 1)];
  const b = vertices[link.b];
  return [x1, y1, b?.x ?? x1, b?.y ?? y1];
}

function lengthFade(length: number, viewport: Viewport): number {
  const [start, end] = FADE_LENGTH[viewport.compact ? "compact" : "wide"];
  return 1 - smoothstep((length - start) / (end - start));
}

function addLinks(
  frame: Frame,
  links: readonly MeshLink[],
  weight: number,
  points: readonly number[],
  viewport: Viewport,
) {
  for (const link of links) {
    const [x1, y1, x2, y2] = ends(link, frame.meshPoints, points);
    const alpha = weight * lengthFade(Math.hypot(x2 - x1, y2 - y1), viewport);
    if (alpha <= 0.01) continue;
    frame.meshLinks.push({ x1, y1, x2, y2, alpha, far: link.far });
  }
}

function addPulses(
  frame: Frame,
  links: readonly MeshLink[],
  weight: number,
  points: readonly number[],
  time: number,
  viewport: Viewport,
  seed: number,
) {
  if (weight <= 0.01 || links.length === 0) return;
  const slots = viewport.compact ? PULSES.compact : PULSES.wide;
  for (let slot = 0; slot < slots; slot++) {
    const local = time + (slot * PULSES.period) / slots + hash01(slot, 29, 1, seed) * 1.3;
    const cycle = Math.floor(local / PULSES.period);
    const age = local - cycle * PULSES.period;
    if (age >= PULSES.travel) continue;
    // A clearly visible link (a few tries, deterministic): impulses never run
    // along a link that has faded out.
    let chosen: [number, number, number, number] | null = null;
    let fade = 0;
    for (let attempt = 0; attempt < 6 && !chosen; attempt++) {
      const link = links[Math.floor(hash01(cycle, slot, 31 + attempt, seed) * links.length)];
      if (!link || link.far) continue;
      const candidate = ends(link, frame.meshPoints, points);
      fade = lengthFade(Math.hypot(candidate[2] - candidate[0], candidate[3] - candidate[1]), viewport);
      if (fade >= 0.5) chosen = candidate;
    }
    if (!chosen) continue;
    const [x1, y1, x2, y2] = hash01(cycle, slot, 37, seed) < 0.5 ? chosen : [chosen[2], chosen[3], chosen[0], chosen[1]];
    const share = age / PULSES.travel;
    const head = ease(share);
    const tail = ease(Math.max(0, share - 0.16));
    frame.pulses.push({
      x: x1 + (x2 - x1) * head,
      y: y1 + (y2 - y1) * head,
      tx: x1 + (x2 - x1) * tail,
      ty: y1 + (y2 - y1) * tail,
      alpha: weight * fade * Math.sin(Math.PI * share),
    });
  }
}
