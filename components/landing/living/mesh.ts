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
 *
 * A scene with a mesh profile (`SceneSpec.meshStyle`, agents only, see
 * mesh-style.ts) draws a denser network (more vertices and links, longest link
 * bounded, no line across a text of its section) and sends its impulses along
 * short ROUTES of links kept clear of the content and of the labels. Without
 * profile (problem scene) everything below draws exactly the C1/C2 mesh.
 */

import { LABEL, labelClearance, labelRect, outsideRects, segmentRectDistance, type Rect } from "./labels";
import type { MeshLook } from "./mesh-style";
import { bounds, fieldBase, fieldOf, isFar, moteBase, moteCount } from "./motes";
import { addRoutePulses, withRoutes, type MeshGraph } from "./routes";
import { contentOf, frameOf, meshLookOf, meshOf, SCENES, STOP_COUNT, type LivingScene, type Point } from "./scenes";
import { ease, hash01, smoothstep, valueAt } from "./timeline";
import type { Frame, MeshPointDraw, NodeDraw, SceneState, Viewport } from "./types";

export { labelClearance };

/** Most links a scene without mesh profile may draw (wide, compact). */
export const MESH_LINK_CAP = { wide: 150, compact: 30 } as const;
/** Largest vertical parallax shift of the near plane, CSS px. */
export const PARALLAX_MAX = 20;
/** Impulses travelling at once (any scene), seconds between two departures of a slot, travel time. */
export const PULSES = { wide: 3, compact: 1, period: 7.5, travel: 2.8 } as const;

/** Each prospect links to its 2 nearest neighbours, some to a third one. */
const NEIGHBOURS = 2;
const THIRD_NEIGHBOUR_SHARE = 0.35;
/** A prospect links to the nearest stop only when it lies within this distance, CSS px. */
const STOP_REACH = { wide: 190, compact: 80 } as const;
/** Links fade with their current length: full up to the first value, gone at the second. */
const FADE_LENGTH = { wide: [80, 220], compact: [60, 150] } as const;
/** Radius of an impulse dot, CSS px (largest, see renderer.ts): kept off the labels too. */
const PULSE_REACH = 2;
/** Mesh profile: no link comes closer than this to a text of the section, CSS px. */
const TEXT_CLEARANCE = 3;

/** A link between two prospects (`b` a prospect) or a prospect and a stop (`b` a stop). */
export type MeshLink = { a: number; b: number; toStop: boolean; far: boolean };

const cache = new Map<string, MeshGraph>();
const NONE: MeshGraph = { links: [], places: [], open: [], next: new Map() };

/**
 * Links of a scene on a given viewport. Computed once, then read from a cache
 * (a resize or a new scene computes a new set; nothing is computed per frame).
 */
export function meshLinksOf(scene: LivingScene, viewport: Viewport, seed: number): readonly MeshLink[] {
  return meshGraphOf(scene, viewport, seed).links;
}

function meshGraphOf(scene: LivingScene, viewport: Viewport, seed: number): MeshGraph {
  const spec = SCENES[scene];
  if (spec.mesh <= 0) return NONE;
  const key = `${scene}|${viewport.width}|${viewport.height}|${viewport.compact ? 1 : 0}|${seed}`;
  const known = cache.get(key);
  if (known) return known;

  const look = meshLookOf(scene, viewport.compact);
  const size = viewport.compact ? "compact" : "wide";
  const layout: readonly Point[] = viewport.compact ? spec.compact : spec.wide;
  const frame = frameOf(spec, viewport);
  const stops: number[] = [];
  for (let stop = 0; stop < STOP_COUNT; stop++) {
    const [nx, ny] = layout[stop] ?? [0.5, 0.5];
    stops.push(frame.x + nx * frame.width, ny * frame.height);
  }
  const box = bounds(stops, viewport);
  const count = moteCount(viewport, scene);
  const field = fieldOf(scene, viewport);
  const places = Array.from({ length: count }, (_, index): [number, number] => {
    if (!field) return moteBase(index, box, seed);
    const [x, y] = fieldBase(index, field, frame, viewport, seed, count);
    return [x, y];
  });
  const neighbours = look ? look.neighbours : NEIGHBOURS;
  const thirdShare = look ? look.thirdShare : THIRD_NEIGHBOUR_SHARE;
  const stopReach = look ? look.stopReach : STOP_REACH[size];
  const maxLength = look ? look.maxLength : Infinity;
  const texts: Rect[] = contentOf(scene, viewport).filter((zone) => zone.text);
  // A mesh profile never draws a line across a text of its section.
  const clearOfText = (x1: number, y1: number, x2: number, y2: number) =>
    texts.every((rect) => segmentRectDistance(x1, y1, x2, y2, rect) >= TEXT_CLEARANCE);

  const candidates: { link: MeshLink; length: number }[] = [];
  const seen = new Set<number>();
  for (let a = 0; a < count; a++) {
    const [ax, ay] = places[a] ?? [0, 0];
    const wanted = neighbours + (hash01(a, 17, 1, seed) < thirdShare ? 1 : 0);
    const nearest = places
      .map(([bx, by], b) => ({ b, length: Math.hypot(bx - ax, by - ay) }))
      .filter((entry) => entry.b !== a)
      .sort((left, right) => left.length - right.length || left.b - right.b)
      .slice(0, wanted);
    for (const { b, length } of nearest) {
      const id = Math.min(a, b) * 1024 + Math.max(a, b);
      if (seen.has(id)) continue;
      seen.add(id);
      const [bx, by] = places[b] ?? [ax, ay];
      if (length > maxLength || !clearOfText(ax, ay, bx, by)) continue;
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
    if (
      bestLength <= stopReach &&
      clearOfText(ax, ay, valueAt(stops, bestStop * 2), valueAt(stops, bestStop * 2 + 1))
    ) {
      candidates.push({ link: { a, b: bestStop, toStop: true, far: false }, length: bestLength });
    }
  }
  // Shortest links first: the cap drops the long, faint ones.
  candidates.sort((left, right) => left.length - right.length);
  const cap = look ? look.links : MESH_LINK_CAP[size];
  const links = candidates.slice(0, cap).map((entry) => entry.link);
  const graph = look ? withRoutes(scene, viewport, links, places, stops) : { ...NONE, links, places };
  if (cache.size > 24) cache.clear();
  cache.set(key, graph);
  return graph;
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
  const shareNow = state.previous ? k : 1;
  const current = meshOf(SCENES[state.scene], viewport.compact) * shareNow;
  const previous = state.previous ? meshOf(SCENES[state.previous], viewport.compact) * (1 - k) : 0;
  const labels = labelRects(frame.nodes, viewport);
  const lookNow = meshLookOf(state.scene, viewport.compact);
  const lookBefore = state.previous ? meshLookOf(state.previous, viewport.compact) : null;
  if (lookNow || lookBefore) {
    // Mesh profile: no vertex dot on a label either (it fades out near one).
    for (const point of frame.meshPoints) {
      const look = point.look;
      if (look) look.alpha *= labelClearance(point.x, point.y, point.x, point.y, labels, look.r + 1);
    }
  }
  if (current > 0.01) {
    const links = meshLinksOf(state.scene, viewport, seed);
    if (lookNow) addStyledLinks(frame, links, shareNow, lookNow, points, labels);
    else addLinks(frame, links, current, points, viewport, labels);
  }
  if (state.previous && previous > 0.01) {
    const links = meshLinksOf(state.previous, viewport, seed);
    if (lookBefore) addStyledLinks(frame, links, 1 - k, lookBefore, points, labels);
    else addLinks(frame, links, previous, points, viewport, labels);
  }
  // Impulses follow the dominant scene only: never twice as many during a change.
  const nowLeads = current >= previous || !state.previous;
  const scene = nowLeads ? state.scene : (state.previous as LivingScene);
  const look = nowLeads ? lookNow : lookBefore;
  if (look) {
    const share = nowLeads ? shareNow : 1 - k;
    const cap = viewport.compact ? PULSES.compact : PULSES.wide;
    addRoutePulses(frame, meshGraphOf(scene, viewport, seed), share, look, time, viewport, seed, labels, cap);
    return;
  }
  addPulses(frame, meshLinksOf(scene, viewport, seed), Math.max(current, previous), points, time, viewport, seed, labels);
}

/** Boxes of the labels drawn in this frame (see labels.ts). */
export function labelRects(nodes: readonly NodeDraw[], viewport: Viewport): Rect[] {
  const rects: Rect[] = [];
  for (const node of nodes) {
    if (node.label && node.alpha > 0.01) rects.push(labelRect(node.x, node.y, node.label, viewport.width));
  }
  return rects;
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

/** Pieces of a link left around the labels, or null when nothing is left. */
function cut(x1: number, y1: number, x2: number, y2: number, labels: readonly Rect[]) {
  // Interrupted around the labels: the hairline stops LABEL.clearance px
  // before a label and resumes after it, so it never crosses nor touches
  // one; the gap opens and closes continuously as the points drift.
  const parts = outsideRects(x1, y1, x2, y2, labels, LABEL.clearance);
  if (parts.length === 0) return null;
  const whole = parts.length === 1 && parts[0]?.[0] === 0 && parts[0]?.[1] === 1;
  return whole ? undefined : parts;
}

function addLinks(
  frame: Frame,
  links: readonly MeshLink[],
  weight: number,
  points: readonly number[],
  viewport: Viewport,
  labels: readonly Rect[],
) {
  for (const link of links) {
    const [x1, y1, x2, y2] = ends(link, frame.meshPoints, points);
    const alpha = weight * lengthFade(Math.hypot(x2 - x1, y2 - y1), viewport);
    if (alpha <= 0.01) continue;
    const parts = cut(x1, y1, x2, y2, labels);
    if (parts === null) continue;
    frame.meshLinks.push(parts ? { x1, y1, x2, y2, alpha, far: link.far, parts } : { x1, y1, x2, y2, alpha, far: link.far });
  }
}

/** Mesh profile: plane and length set the opacity (never below `longFade`), plane sets the width. */
function addStyledLinks(
  frame: Frame,
  links: readonly MeshLink[],
  share: number,
  look: MeshLook,
  points: readonly number[],
  labels: readonly Rect[],
) {
  const [start, end] = look.fade;
  for (const link of links) {
    const [x1, y1, x2, y2] = ends(link, frame.meshPoints, points);
    const fade = 1 - (1 - look.longFade) * smoothstep((Math.hypot(x2 - x1, y2 - y1) - start) / (end - start));
    const alpha = share * (link.far ? look.farLine : look.line) * fade;
    if (alpha <= 0.01) continue;
    const parts = cut(x1, y1, x2, y2, labels);
    if (parts === null) continue;
    const width = link.far ? look.farWidth : look.width;
    frame.meshLinks.push({ x1, y1, x2, y2, alpha, far: link.far, width, ...(parts ? { parts } : {}) });
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
  labels: readonly Rect[],
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
    const pulse = {
      x: x1 + (x2 - x1) * head,
      y: y1 + (y2 - y1) * head,
      tx: x1 + (x2 - x1) * tail,
      ty: y1 + (y2 - y1) * tail,
      alpha: weight * fade * Math.sin(Math.PI * share),
    };
    // Faded out while it passes a label (dot radius included), back after it.
    pulse.alpha *= labelClearance(pulse.tx, pulse.ty, pulse.x, pulse.y, labels, PULSE_REACH);
    frame.pulses.push(pulse);
  }
}
