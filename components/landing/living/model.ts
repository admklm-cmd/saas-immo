/**
 * Pure model of the living background: `buildFrame` turns an instant and the
 * current scene into a list of things to draw. No DOM, no randomness beyond a
 * fixed seed: the same input always yields the same frame.
 */

import { LANDING_TEXTS } from "@/components/landing-texts";

import { addFiles, keepStrongestFragments, laneOffset, laneWeight } from "./files";
import { buildMotes } from "./motes";
import { SCENES, STOP_AGENT, STOP_COUNT, type LivingScene, type Point, type SceneSpec } from "./scenes";
import { hash01, smoothstep, valueAt } from "./timeline";
import type { Frame, SceneState, Viewport } from "./types";

export type * from "./types";

export const DEFAULT_SEED = 20260924;
/** Seconds to move from one scene layout to the next. */
export const TRANSITION_SECONDS = 1.6;
/** Instant drawn once under prefers-reduced-motion: every stage is visible. */
export const STATIC_TIME = 41.3;

const TEXTS = LANDING_TEXTS.living;
const CENTER: Point = [0.5, 0.5];
/** Agents with a label drawn next to them (decorative, aria-hidden canvas). */
const STOP_LABEL: readonly (string | null)[] = [
  null,
  TEXTS.agents[0],
  TEXTS.agents[1],
  TEXTS.agents[2],
  TEXTS.gate,
  TEXTS.agents[3],
  TEXTS.agents[4],
  TEXTS.goal,
];

/** Stop positions of a scene, in CSS px, wandering slightly in the problem scene. */
export function scenePoints(scene: LivingScene, viewport: Viewport, time: number, seed = DEFAULT_SEED): number[] {
  const spec = SCENES[scene];
  const layout: readonly Point[] = viewport.compact ? spec.compact : spec.wide;
  const points: number[] = [];
  for (let stop = 0; stop < STOP_COUNT; stop++) {
    const [nx, ny] = layout[stop] ?? CENTER;
    const phase = hash01(stop, 7, 3, seed) * Math.PI * 2;
    const wobble = spec.scatter * (viewport.compact ? 0.4 : 1);
    points.push(
      nx * viewport.width + Math.sin(time * 0.37 + phase) * wobble,
      ny * viewport.height + Math.cos(time * 0.29 + phase * 1.7) * wobble,
    );
  }
  return points;
}

/** Stop positions displayed at `time`, blending from the previous layout. */
export function displayedPoints(state: SceneState, viewport: Viewport, time: number, seed = DEFAULT_SEED): number[] {
  const target = scenePoints(state.scene, viewport, time, seed);
  const from = state.from;
  if (!from) return target;
  const k = smoothstep((time - state.since) / TRANSITION_SECONDS);
  return target.map((value, index) => {
    const start = valueAt(from, index, value);
    return start + (value - start) * k;
  });
}

export function buildFrame(input: { time: number; state: SceneState; viewport: Viewport; seed?: number }): Frame {
  const { time, state, viewport } = input;
  const seed = input.seed ?? DEFAULT_SEED;
  const frame: Frame = { nodes: [], links: [], tokens: [], marks: [], motes: [], fragments: [] };
  const spec = SCENES[state.scene];
  const points = displayedPoints(state, viewport, time, seed);
  const sceneAge = time - state.since;
  const k = state.previous ? smoothstep(sceneAge / TRANSITION_SECONDS) : 1;
  const previous = state.previous ? SCENES[state.previous] : null;
  const broken = (spec.broken ? k : 0) + (previous?.broken ? 1 - k : 0) > 0.5;

  // Structure: stops and faint links, lane by lane.
  const lanes = Math.max(spec.lanes, previous && k < 1 ? previous.lanes : 1);
  for (let lane = 0; lane < lanes; lane++) {
    const presence = laneWeight(spec, lane) * k + (previous ? laneWeight(previous, lane) * (1 - k) : 0);
    if (presence <= 0.01) continue;
    const dy = laneOffset(spec, lane, viewport) * k + (previous ? laneOffset(previous, lane, viewport) * (1 - k) : 0);
    const main = lane === Math.floor((lanes - 1) / 2);
    for (let stop = 0; stop < STOP_COUNT; stop++) {
      const appear = spec.build && !state.previous ? smoothstep((sceneAge - 0.2 - stop * 0.45) / 0.6) : 1;
      const x = valueAt(points, stop * 2);
      const y = valueAt(points, stop * 2 + 1) + dy;
      frame.nodes.push({
        x,
        y,
        stop,
        dy,
        alpha: presence * appear * (main ? 1 : 0.6),
        activity: spotlight(spec, stop, time) * k,
        label: main && !viewport.compact ? (STOP_LABEL[stop] ?? null) : null,
      });
      if (stop === STOP_COUNT - 1) continue;
      const connect = spec.build && !state.previous ? smoothstep((sceneAge - 0.7 - stop * 0.45) / 0.7) : 1;
      frame.links.push({
        x1: x,
        y1: y,
        x2: valueAt(points, stop * 2 + 2),
        y2: valueAt(points, stop * 2 + 3) + dy,
        alpha: presence * connect,
        dashed: broken,
        trail: false,
      });
    }
  }

  // Fictitious files: the current scene fades in, the previous one fades out.
  addFiles(frame, state.scene, points, time, state, k, true, viewport, seed);
  if (state.previous && k < 1) addFiles(frame, state.previous, points, time, state, 1 - k, false, viewport, seed);

  frame.motes = buildMotes(state, points, time, k, viewport, seed);
  keepStrongestFragments(frame);
  return frame;
}

/** Agents scene: each agent lights up in turn (1.5 s each). */
function spotlight(spec: SceneSpec, stop: number, time: number): number {
  const agent = STOP_AGENT[stop] ?? -1;
  if (!spec.spotlight || agent < 0) return 0;
  const local = (time % 7.5) - agent * 1.5;
  return local >= 0 && local < 1.5 ? Math.sin((local / 1.5) * Math.PI) : 0;
}

