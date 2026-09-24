/**
 * Fictitious files of the living background: dots that travel the path, rest
 * on each agent, wait in front of the human validation, and either reach the
 * mandate, halt on a guard rail, or get lost (problem scene). Pure functions.
 */

import { LANDING_TEXTS } from "@/components/landing-texts";

import { GATE_STOP, GOAL_STOP, SCENES, type LivingScene, type SceneSpec } from "./scenes";
import {
  buildSchedule,
  clamp01,
  FADE_SECONDS,
  HALT_AT,
  haltTime,
  hash01,
  progressAt,
  valueAt,
  type Schedule,
} from "./timeline";
import type { FragmentDraw, Frame, LinkDraw, SceneState, Viewport } from "./types";

const TEXTS = LANDING_TEXTS.living;
const FRAGMENT_LIMIT = 3;
const BLOCKABLE_SEGMENTS: readonly number[] = [1, 2, 3, 5, 6];

const schedules = new Map<LivingScene, Schedule>();
function scheduleOf(scene: LivingScene): Schedule {
  let schedule = schedules.get(scene);
  if (!schedule) {
    schedule = buildSchedule(SCENES[scene]);
    schedules.set(scene, schedule);
  }
  return schedule;
}

export function laneWeight(spec: SceneSpec, lane: number): number {
  return lane < spec.lanes ? 1 : 0;
}

export function laneOffset(spec: SceneSpec, lane: number, viewport: Viewport): number {
  if (spec.lanes <= 1) return 0;
  return (lane - (spec.lanes - 1) / 2) * spec.laneGap * (viewport.compact ? 0.5 : 1);
}

function at(points: readonly number[], stop: number, dy: number): [number, number] {
  return [valueAt(points, stop * 2), valueAt(points, stop * 2 + 1) + dy];
}

function along(points: readonly number[], segment: number, u: number, dy: number): [number, number] {
  const [x1, y1] = at(points, segment, dy);
  const [x2, y2] = at(points, segment + 1, dy);
  return [x1 + (x2 - x1) * u, y1 + (y2 - y1) * u];
}

export function addFiles(
  frame: Frame,
  scene: LivingScene,
  points: readonly number[],
  time: number,
  state: SceneState,
  weight: number,
  current: boolean,
  viewport: Viewport,
  seed: number,
) {
  if (weight <= 0.01) return;
  const spec = SCENES[scene];
  const schedule = scheduleOf(scene);
  const life = schedule.end + FADE_SECONDS;
  const period = spec.period * (viewport.compact ? 1.7 : 1);
  // Hero: the path is built first, then the first file enters.
  const firstBirth = current && spec.build && !state.previous ? state.since + 3.2 : -Infinity;
  const mainLane = Math.floor((spec.lanes - 1) / 2);

  for (let lane = 0; lane < spec.lanes; lane++) {
    const dy = laneOffset(spec, lane, viewport);
    const phase = lane * period * 0.37;
    const kMin = Math.ceil((time - life - phase) / period);
    const kMax = Math.floor((time - phase) / period);
    const talk = current && lane === mainLane && !viewport.compact;
    for (let k = kMin; k <= kMax; k++) {
      const birth = k * period + phase;
      if (birth < firstBirth) continue;
      const fate = hash01(k, lane, 1, seed);
      const pick = hash01(k, lane, 2, seed);
      const halted = fate < spec.blockRate;
      const lost = !halted && fate < spec.blockRate + spec.lostRate;
      const segment = valueAt(BLOCKABLE_SEGMENTS, Math.floor(pick * BLOCKABLE_SEGMENTS.length), 1);
      const twin = hash01(k, lane, 3, seed) < spec.duplicateRate;
      addFile(frame, points, schedule, time - birth, dy, weight, halted ? "halted" : lost ? "lost" : "clean", segment, talk);
      if (twin) addFile(frame, points, schedule, time - birth - 0.4, dy + 7, weight * 0.6, lost ? "lost" : "clean", segment, false);
    }
  }
}

type Fate = "clean" | "halted" | "lost";

function addFile(
  frame: Frame,
  points: readonly number[],
  schedule: Schedule,
  age: number,
  dy: number,
  weight: number,
  fate: Fate,
  segment: number,
  talk: boolean,
) {
  if (age < 0) return;
  if (fate !== "clean") {
    const stopAt = haltTime(schedule, segment);
    if (age >= stopAt) {
      const fade = clamp01((age - stopAt) / FADE_SECONDS);
      if (fade >= 1) return;
      const [x, y] = along(points, segment, HALT_AT, dy);
      const alpha = weight * (1 - fade);
      frame.tokens.push({ x, y, tx: x, ty: y, alpha, still: true });
      frame.links.push(trail(points, segment, HALT_AT, dy, alpha * 0.8));
      if (fate === "halted") {
        const [x2, y2] = at(points, segment + 1, dy);
        const [x1, y1] = at(points, segment, dy);
        const [bx, by] = along(points, segment, HALT_AT + 0.05, dy);
        frame.marks.push({ x: bx, y: by, kind: "halt", angle: Math.atan2(y2 - y1, x2 - x1), alpha });
        if (talk) frame.fragments.push({ x: bx, y: by, text: TEXTS.fragments.blocked, alpha });
      }
      return;
    }
  }

  const progress = progressAt(schedule, age);
  if (progress.kind === "arrived") {
    const fade = clamp01(progress.since / FADE_SECONDS);
    if (fade >= 1) return;
    const [x, y] = at(points, GOAL_STOP, dy);
    frame.tokens.push({ x, y, tx: x, ty: y, alpha: weight * (1 - fade), still: true });
    frame.marks.push({ x, y, kind: "check", angle: 0, alpha: weight * (1 - fade) });
    bump(frame, GOAL_STOP, dy, weight * (1 - fade));
    return;
  }

  let head: [number, number];
  let tail: [number, number];
  let reached: number;
  if (progress.kind === "moving") {
    head = along(points, progress.segment, progress.u, dy);
    tail = along(points, progress.segment, Math.max(0, progress.u - 0.12), dy);
    frame.links.push(trail(points, progress.segment, progress.u, dy, weight));
    reached = progress.segment;
    if (talk) movingFragment(frame, points, progress.segment, progress.u, dy, weight);
  } else {
    head = at(points, progress.stop, dy);
    tail = head;
    reached = progress.stop - 1;
    bump(frame, progress.stop, dy, weight);
    if (talk) restingFragment(frame, points, progress.stop, dy, weight);
  }
  // Links already travelled stay lit for a moment, then fade out.
  for (let passed = Math.max(0, reached - 2); passed < (progress.kind === "moving" ? progress.segment : progress.stop); passed++) {
    const since = age - valueAt(schedule.arrive, passed + 1);
    const alpha = weight * (1 - clamp01(since / 2.4));
    if (alpha > 0.01) frame.links.push(trail(points, passed, 1, dy, alpha));
  }
  const alpha = age < 0.6 ? weight * (age / 0.6) : weight;
  frame.tokens.push({ x: head[0], y: head[1], tx: tail[0], ty: tail[1], alpha, still: progress.kind !== "moving" });
}

function trail(points: readonly number[], segment: number, u: number, dy: number, alpha: number): LinkDraw {
  const [x1, y1] = at(points, segment, dy);
  const [x2, y2] = along(points, segment, u, dy);
  return { x1, y1, x2, y2, alpha, dashed: false, trail: true };
}

function bump(frame: Frame, stop: number, dy: number, amount: number) {
  for (const node of frame.nodes) {
    if (node.stop === stop && Math.abs(node.dy - dy) < 0.5) node.activity = Math.max(node.activity, amount);
  }
}

function restingFragment(frame: Frame, points: readonly number[], stop: number, dy: number, weight: number) {
  const [x, y] = at(points, stop, dy);
  const text =
    stop === 0
      ? TEXTS.fragments.received
      : stop === GATE_STOP
        ? TEXTS.fragments.validation
        : stop === 5
          ? TEXTS.fragments.appointment
          : stop === 6
            ? TEXTS.fragments.followUp
            : null;
  if (text) frame.fragments.push({ x, y, text, alpha: weight });
}

function movingFragment(frame: Frame, points: readonly number[], segment: number, u: number, dy: number, weight: number) {
  if (u > 0.4) return;
  const alpha = weight * (1 - u / 0.4);
  const [x, y] = at(points, segment, dy);
  if (segment === GATE_STOP) {
    frame.fragments.push({ x, y, text: TEXTS.fragments.validated, alpha });
    frame.marks.push({ x, y, kind: "check", angle: 0, alpha });
  } else if (segment === 2) {
    frame.fragments.push({ x, y, text: TEXTS.fragments.status, alpha });
  } else if (segment === 3) {
    frame.fragments.push({ x, y, text: TEXTS.fragments.duration, alpha });
  }
}

export function keepStrongestFragments(frame: Frame) {
  const byText = new Map<string, FragmentDraw>();
  for (const fragment of frame.fragments) {
    const known = byText.get(fragment.text);
    if (!known || known.alpha < fragment.alpha) byText.set(fragment.text, fragment);
  }
  frame.fragments = [...byText.values()].sort((a, b) => b.alpha - a.alpha).slice(0, FRAGMENT_LIMIT);
}
