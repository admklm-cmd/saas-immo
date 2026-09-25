/**
 * Impulses of a mesh profile (agents scene, C3; see mesh-style.ts): each slot
 * sends a small cobalt impulse along a short ROUTE of "open" links (between
 * two prospects, clear of the elements of the section and of the labels),
 * with a tail in segments of decreasing opacity, and briefly lights the vertex
 * it reaches. At most `look.pulses` (and the cap given by mesh.ts) at once. Pure functions of
 * time: routes are chosen from the cycle and the slot, deterministically.
 */

import { LABEL, labelClearance, labelRect, segmentRectDistance, STOP_LABEL, type Rect } from "./labels";
import type { MeshLink } from "./mesh";
import type { MeshLook } from "./mesh-style";
import { vertexLook } from "./motes";
import { contentOf, type LivingScene } from "./scenes";
import { hash01, smoothstep, valueAt } from "./timeline";
import type { Frame, PulseDraw, Viewport } from "./types";

/** Mesh profile: an impulse route keeps this far from the content and the labels, CSS px. */
const ROUTE_CLEARANCE = { content: 10, label: LABEL.clearance + LABEL.fade + 4 } as const;
/** Mesh profile: seconds for an impulse to appear and to fade out on arrival. */
const PULSE_EDGE = { in: 0.3, out: 0.25 } as const;
/** Mesh profile: routes tried per impulse (the longest one is kept). */
const ROUTE_TRIES = 4;

/**
 * Links of a scene on a viewport, with what the impulses of a mesh profile
 * need: resting places, and for each vertex the links an impulse may run
 * along (prospect to prospect, clear of the content and of the labels).
 */
export type MeshGraph = {
  links: readonly MeshLink[];
  places: readonly (readonly [number, number])[];
  /** Indices (in `links`) of the links an impulse may take. */
  open: readonly number[];
  /** Vertex → [neighbour, link index] pairs along open links. */
  next: ReadonlyMap<number, readonly (readonly [number, number])[]>;
};

/** Open links of a mesh profile: where an impulse stays visible, off the content and the labels. */
export function withRoutes(
  scene: LivingScene,
  viewport: Viewport,
  links: readonly MeshLink[],
  places: readonly (readonly [number, number])[],
  stops: readonly number[],
): MeshGraph {
  const content: Rect[] = [...contentOf(scene, viewport)];
  const labels: Rect[] = [];
  if (!viewport.compact) {
    STOP_LABEL.forEach((text, stop) => {
      if (text) labels.push(labelRect(valueAt(stops, stop * 2), valueAt(stops, stop * 2 + 1), text, viewport.width));
    });
  }
  const open: number[] = [];
  const next = new Map<number, [number, number][]>();
  links.forEach((link, index) => {
    if (link.toStop || link.far) return;
    const [x1, y1] = places[link.a] ?? [0, 0];
    const [x2, y2] = places[link.b] ?? [0, 0];
    if (Math.hypot(x2 - x1, y2 - y1) < 24) return;
    const clear = (rects: readonly Rect[], margin: number) =>
      rects.every((rect) => segmentRectDistance(x1, y1, x2, y2, rect) >= margin);
    if (!clear(content, ROUTE_CLEARANCE.content) || !clear(labels, ROUTE_CLEARANCE.label)) return;
    if (y1 < 0 || y2 < 0 || y1 > viewport.height || y2 > viewport.height) return;
    open.push(index);
    for (const [from, to] of [
      [link.a, link.b],
      [link.b, link.a],
    ] as const) {
      const list = next.get(from) ?? [];
      list.push([to, index]);
      next.set(from, list);
    }
  });
  return { links, places, open, next };
}

/**
 * Route of an impulse (vertex indices), chosen from the cycle and the slot
 * (deterministic, the same during the whole trip): an open link, then up to
 * `look.hops - 1` more open links, never back, within `reach` px at rest.
 */
function routeOf(graph: MeshGraph, cycle: number, slot: number, look: MeshLook, reach: number, seed: number): number[] | null {
  if (graph.open.length === 0) return null;
  const at = (vertex: number) => graph.places[vertex] ?? [0, 0];
  // A few deterministic tries; the longest route wins (a lone short link
  // would show an impulse for a fraction of a second only).
  let best: number[] | null = null;
  let bestLength = 0;
  for (let attempt = 0; attempt < ROUTE_TRIES && bestLength < reach * 0.8; attempt++) {
    const index = graph.open[Math.floor(hash01(cycle, slot, 41 + attempt * 7, seed) * graph.open.length)] ?? 0;
    const link = graph.links[index];
    if (!link) continue;
    const route = hash01(cycle, slot, 42 + attempt * 7, seed) < 0.5 ? [link.a, link.b] : [link.b, link.a];
    let length = Math.hypot(at(link.b)[0] - at(link.a)[0], at(link.b)[1] - at(link.a)[1]);
    if (length > reach) continue;
    while (route.length <= look.hops) {
      const last = route[route.length - 1] ?? 0;
      const options = (graph.next.get(last) ?? []).filter(([to]) => !route.includes(to));
      if (options.length === 0) break;
      const [to] = options[Math.floor(hash01(cycle, slot * 16 + route.length, 43 + attempt * 7, seed) * options.length)] ?? [last];
      const step = Math.hypot(at(to)[0] - at(last)[0], at(to)[1] - at(last)[1]);
      if (length + step > reach) break;
      route.push(to);
      length += step;
    }
    if (length > bestLength) {
      best = route;
      bestLength = length;
    }
  }
  return best;
}

/**
 * Mesh profile: each slot sends an impulse along a short route of open links
 * at a steady, slow speed. Its tail follows the route; the vertex it reaches
 * turns cobalt for a moment. At most `look.pulses`, never more than `cap`
 * (PULSES in mesh.ts), at once.
 */
export function addRoutePulses(
  frame: Frame,
  graph: MeshGraph,
  share: number,
  look: MeshLook,
  time: number,
  viewport: Viewport,
  seed: number,
  labels: readonly Rect[],
  cap: number,
) {
  if (share <= 0.01) return;
  const slots = Math.min(look.pulses, cap);
  const reach = look.speed * (look.period - look.flashSeconds - PULSE_EDGE.in);
  for (let slot = 0; slot < slots; slot++) {
    const local = time + (slot * look.period) / slots + hash01(slot, 29, 1, seed) * 1.3;
    const cycle = Math.floor(local / look.period);
    const age = local - cycle * look.period;
    const route = routeOf(graph, cycle, slot, look, reach, seed);
    if (!route || route.length < 2) continue;
    // Distances along the route at rest (stable), positions where the vertices are now.
    const marks = [0];
    for (let hop = 1; hop < route.length; hop++) {
      const [x1, y1] = graph.places[route[hop - 1] ?? 0] ?? [0, 0];
      const [x2, y2] = graph.places[route[hop] ?? 0] ?? [0, 0];
      marks.push((marks[hop - 1] ?? 0) + Math.hypot(x2 - x1, y2 - y1));
    }
    const total = marks[marks.length - 1] ?? 0;
    const travel = total / look.speed;
    if (age >= travel + look.flashSeconds) continue;
    const at = (distance: number): [number, number] => {
      const d = Math.max(0, Math.min(total, distance));
      let hop = 1;
      while (hop < marks.length - 1 && (marks[hop] ?? 0) < d) hop += 1;
      const from = marks[hop - 1] ?? 0;
      const span = (marks[hop] ?? 0) - from;
      const t = span > 0 ? (d - from) / span : 0;
      const a = frame.meshPoints[route[hop - 1] ?? 0];
      const b = frame.meshPoints[route[hop] ?? 0];
      return [(a?.x ?? 0) + ((b?.x ?? 0) - (a?.x ?? 0)) * t, (a?.y ?? 0) + ((b?.y ?? 0) - (a?.y ?? 0)) * t];
    };
    const distance = Math.min(age, travel) * look.speed;
    const [x, y] = at(distance);
    const trail = [x, y];
    for (let piece = 1; piece <= look.trailSegments; piece++) {
      trail.push(...at(distance - (piece * look.trail) / look.trailSegments));
    }
    const envelope =
      age >= travel ? 0 : smoothstep(age / PULSE_EDGE.in) * (1 - smoothstep((age - travel + PULSE_EDGE.out) / PULSE_EDGE.out));
    // Faded out while any piece of it passes a label (dot radius included).
    let clear = 1;
    for (let piece = 0; piece + 3 < trail.length && clear > 0; piece += 2) {
      clear = Math.min(
        clear,
        labelClearance(
          valueAt(trail, piece + 2),
          valueAt(trail, piece + 3),
          valueAt(trail, piece),
          valueAt(trail, piece + 1),
          labels,
          look.pulseRadius,
        ),
      );
    }
    const tx = valueAt(trail, trail.length - 2);
    const ty = valueAt(trail, trail.length - 1);
    clear = Math.min(clear, labelClearance(tx, ty, x, y, labels, look.pulseRadius));
    const pulse: PulseDraw = {
      x,
      y,
      tx,
      ty,
      alpha: share * look.pulse * envelope * clear,
      trail,
      r: look.pulseRadius,
      trailWidth: look.trailWidth,
    };
    // The last vertex reached lights up briefly (not the one it started from).
    let reached = 0;
    for (let hop = 1; hop < marks.length; hop++) if ((marks[hop] ?? Infinity) <= distance + 1e-9) reached = hop;
    if (reached > 0) {
      const since = age - (marks[reached] ?? 0) / look.speed;
      const glow = smoothstep(since / 0.15) * (1 - smoothstep((since - 0.15) / (look.flashSeconds - 0.15)));
      const vertex = frame.meshPoints[route[reached] ?? 0];
      if (vertex && glow > 0) {
        const r = Math.min(2.6, Math.max(1.8, vertexLook(route[reached] ?? 0, vertex.far, look, 1, seed).r));
        const alpha = share * look.flash * glow * labelClearance(vertex.x, vertex.y, vertex.x, vertex.y, labels, r);
        pulse.flash = { x: vertex.x, y: vertex.y, r, alpha };
      }
    }
    frame.pulses.push(pulse);
  }
}
