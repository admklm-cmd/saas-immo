import { FOCAL, HANDS_EMPHASIS, HANDS_GROWTH, PLANES, SPHERE } from "@/components/landing/hero/particles/hero-config";
import { differentialShare, sphereAngle } from "@/components/landing/hero/particles/sphere-field";

import { ROLE, type PromoScene } from "./promo-scene";
import { clamp01, easeIn, easeInOut, easeOut, lerp, progress, sweepEdge, sweepTint, T } from "./promo-timeline";

/**
 * Position, opacity, size and tint of every point of the cloud at a time of the film
 * (docs/motion/promo-2026-10.md §3.5). Pure function of the scene and of `tMs`.
 *
 * Every identity goes through the same chain of « stages »: scatter, sphere, rail, dashboard (by role),
 * dissolved dashboard, hands. Between two stages the point is interpolated with its own delay (a wave,
 * never all at once). A stage only starts when the previous one is finished, so at any time at most two
 * stages are mixed.
 */
export type PointBuffer = {
  x: Float32Array;
  y: Float32Array;
  alpha: Float32Array;
  size: Float32Array;
  /** 0 = ink point, 1 = inverse point (white on the ink background). */
  inverse: Float32Array;
};

export function createPointBuffer(count: number): PointBuffer {
  return { x: new Float32Array(count), y: new Float32Array(count), alpha: new Float32Array(count), size: new Float32Array(count), inverse: new Float32Array(count) };
}

type State = { x: number; y: number; alpha: number; size: number };

const PLANE_PERIOD_MS = [6000, 8500, 11_000] as const;
const SCATTER_ALPHA = 1.45;
const SCATTER_SIZE = 1.2;
const SPHERE_ALPHA = 2.3;
const SPHERE_SIZE = 1.45;
const RAIL_SIZE = 1.0;
const ROLE_ALPHA = [1.9, 1.9, 2.0, 0.35] as const;
const DISSOLVED_ALPHA = 0.35;
const PULL_SHARE = 0.05;
/** Sideways bulge of a point on its way between two stages, as a share of the distance it travels. */
const ARC_SHARE = 0.16;
const COS_TILT = Math.cos(SPHERE.tilt);
const SIN_TILT = Math.sin(SPHERE.tilt);
const TWO_PI = Math.PI * 2;

/** Integral of the slowdown of the clock over the freeze (computed once, deterministic). */
const SLOWDOWN_STEPS = 64;

/** Drift clock (ms): runs with the film, slows down to a full stop in 250 ms from 14 000 ms (« arrêt net »). */
export function driftClock(t: number): number {
  if (t < T.freezeFrom) return t;
  const u = progress(t, T.freezeFrom, T.freezeFrom + T.freezeMs);
  let integral = 0;
  const steps = Math.max(1, Math.round(SLOWDOWN_STEPS * u));
  for (let k = 0; k < steps; k++) integral += (1 - easeOut(((k + 0.5) / steps) * u)) * (u / steps);
  return T.freezeFrom + T.freezeMs * integral;
}

/** Approach of the two index fingertips: 0 until 29 000 ms, 1 at the contact (29 700 ms). */
export function approach(t: number): number {
  return easeInOut(progress(t, T.approachFrom, T.contactAt));
}

/** Breathing of the hands in px (docs §4 plan 6: amplitude 4 px), faded to zero at the contact. */
export function breathPx(t: number, side: number): number {
  const fadeIn = progress(t, 28_000, 28_800);
  const fadeOut = 1 - progress(t, T.approachFrom, T.contactAt);
  const phase = (t / 7200) * TWO_PI + (side > 0 ? Math.PI / 2 : 0);
  return 4 * Math.sin(phase) * fadeIn * fadeOut;
}

/** Share of dark tint: forward sweep (8 800 → 9 500) then the sweep back (20 400 → 21 000). */
export function sweepEdges(t: number, length: number): { forward: number; back: number } {
  return {
    forward: sweepEdge(t, T.sweepFrom, T.sweepTo, length),
    back: sweepEdge(t, T.sweepBackFrom, T.sweepBackTo, length),
  };
}

function stagedE(t: number, from: number, delay: number, delaySpan: number, duration: number): number {
  const start = from + delay * delaySpan;
  if (t <= start) return 0;
  if (t >= start + duration) return 1;
  return easeInOut((t - start) / duration);
}

export function computePoints(scene: PromoScene, t: number, out: PointBuffer): void {
  const { layout, a, n } = scene;
  const unitScale = layout.pointScale;
  const clock = driftClock(t);
  const st: State = { x: 0, y: 0, alpha: 0, size: 0 };
  const from: State = { x: 0, y: 0, alpha: 0, size: 0 };
  const edges = sweepEdges(t, layout.vertical ? layout.height : layout.width);
  const axisLength = layout.vertical ? layout.height : layout.width;

  const pull = PULL_SHARE * easeIn(progress(t, T.pullFrom, T.gatherFrom));
  const sphereSeconds = Math.max(0, (t - T.gatherFrom) / 1000);
  const baseAngle = sphereAngle(sphereSeconds);
  const differential = SPHERE.differential * differentialShare(sphereSeconds);
  const sphereScale = layout.sphere.diameter;
  const approachValue = approach(t);
  const traceHead = easeOut(progress(t, T.curveFrom, T.curveTo));
  // The hands step back a little at the contact (so that the cobalt point is alone), then more for the logo.
  const recede = lerp(1, 0.75, easeOut(progress(t, T.contactAt, T.contactAt + 300))) * lerp(1, 0.4 / 0.75, easeOut(progress(t, T.logoFrom, T.logoFrom + T.logoMs)));
  const handUnit = layout.hands.unit;
  const origin = layout.hands.origin;

  // --- stage functions (write into `target`) ---------------------------------------------------
  const base = (i: number) => PLANES[scene.plane[i]!]!;

  const stageScatter = (i: number, target: State) => {
    const plane = base(i);
    const period = PLANE_PERIOD_MS[scene.plane[i]!]!;
    const omega = TWO_PI / period;
    const amplitude = layout.driftPx * (0.55 + 0.45 * plane.speed);
    const cx = layout.sphere.center.x;
    const cy = layout.sphere.center.y;
    const sx = scene.scatterX[i]!;
    const sy = scene.scatterY[i]!;
    target.x = lerp(sx, cx, pull) + amplitude * Math.sin(omega * clock + scene.phase[i * 2]!);
    target.y = lerp(sy, cy, pull) + amplitude * Math.sin(omega * 1.31 * clock + scene.phase[i * 2 + 1]!);
    const lostAt = i < a ? scene.lostAt[i]! : -1;
    const lost = lostAt >= 0 ? 1 - easeInOut(progress(t, lostAt, lostAt + T.loseMs)) : 1;
    target.alpha = Math.min(1, plane.alpha * SCATTER_ALPHA) * lost * (i < a ? 1 : 0);
    target.size = plane.size * unitScale * SCATTER_SIZE * layout.cloudBoost;
  };

  const stageSphere = (i: number, target: State) => {
    const plane = base(i);
    const angle = baseAngle * (1 + differential * scene.sphereCosLat[i]!);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const x0 = scene.sphere.x[i]!;
    const y0 = scene.sphere.y[i]!;
    const z0 = scene.sphere.z[i]!;
    const x1 = x0 * cos + z0 * sin;
    const z1 = -x0 * sin + z0 * cos;
    const y2 = y0 * COS_TILT - z1 * SIN_TILT;
    const z2 = y0 * SIN_TILT + z1 * COS_TILT;
    const perspective = FOCAL / (FOCAL - z2);
    target.x = layout.sphere.center.x + x1 * sphereScale * perspective;
    target.y = layout.sphere.center.y + y2 * sphereScale * perspective;
    target.alpha = Math.min(1, plane.alpha * SPHERE_ALPHA * (0.5 + 0.5 * (z2 + 0.5)));
    target.size = plane.size * unitScale * SPHERE_SIZE * perspective * layout.cloudBoost;
  };

  const stageRail = (i: number, target: State) => {
    const plane = base(i);
    const omega = TWO_PI / PLANE_PERIOD_MS[scene.plane[i]!]!;
    const shimmer = 1.2 * unitScale * Math.sin(omega * 2.2 * clock + scene.phase[i * 2]!);
    target.x = scene.railX[i]! + (layout.vertical ? shimmer : 0);
    target.y = scene.railY[i]! + (layout.vertical ? 0 : shimmer);
    target.alpha = 0.5 + 0.5 * (plane.alpha / PLANES[0].alpha);
    target.size = plane.size * unitScale * RAIL_SIZE;
  };

  const stageWindow = (i: number, target: State) => {
    const plane = base(i);
    const role = scene.role[i]!;
    if (role === ROLE.dust) {
      target.x = scene.dustX[i]!;
      target.y = scene.dustY[i]!;
    } else if (role === ROLE.curve) {
      const reach = clamp01((traceHead * 1.08 - scene.curveU[i]!) / 0.08);
      const e = easeOut(reach);
      target.x = lerp(scene.windowX[i]!, scene.curveX[i]!, e);
      target.y = lerp(scene.windowY[i]!, scene.curveY[i]!, e);
    } else {
      target.x = scene.windowX[i]!;
      target.y = scene.windowY[i]!;
    }
    target.alpha = Math.min(1, plane.alpha * ROLE_ALPHA[role]!);
    target.size = plane.size * unitScale;
  };

  const stageDissolved = (i: number, target: State) => {
    const plane = base(i);
    const role = scene.role[i]!;
    if (role === ROLE.curve) {
      target.x = scene.curveX[i]!;
      target.y = scene.curveY[i]! - layout.hands.rise;
      target.alpha = Math.min(1, plane.alpha * ROLE_ALPHA[ROLE.curve]);
    } else {
      target.x = scene.dustX[i]!;
      target.y = scene.dustY[i]!;
      target.alpha = Math.min(1, plane.alpha * DISSOLVED_ALPHA);
    }
    target.size = plane.size * unitScale;
  };

  const stageHands = (i: number, target: State) => {
    const plane = base(i);
    const side = scene.handsSide[i]!;
    const hx = scene.handsX[i]! + scene.handsMoveX[i]! * approachValue;
    const hy = scene.handsY[i]! + scene.handsMoveY[i]! * approachValue;
    target.x = origin.x + hx * handUnit;
    target.y = origin.y + hy * handUnit + breathPx(t, side);
    const tone = scene.handsTone[i]!;
    target.alpha = Math.min(1, plane.alpha * (1 + HANDS_EMPHASIS) * (0.62 + 0.38 * tone)) * recede;
    target.size = Math.min(layout.handsPointMax, plane.size * unitScale * (1 + HANDS_GROWTH));
  };

  const mix = (target: State, other: State, e: number, i: number) => {
    const dx = other.x - target.x;
    const dy = other.y - target.y;
    // A swarm, not a rubber band: each point bulges sideways on its way (its own side, fixed by its identity).
    const side = (scene.phase[i * 2]! / TWO_PI - 0.5) * 2;
    const bulge = Math.sin(Math.PI * e) * ARC_SHARE * side;
    target.x = lerp(target.x, other.x, e) - dy * bulge;
    target.y = lerp(target.y, other.y, e) + dx * bulge;
    target.alpha = lerp(target.alpha, other.alpha, e);
    target.size = lerp(target.size, other.size, e);
  };

  // --- chain -------------------------------------------------------------------------------------
  for (let i = 0; i < n; i++) {
    const handsDelay = scene.handsDelay[i]!;
    const e4 = stagedE(t, T.handsFrom, handsDelay, T.handsDelayMs, T.handsDurationMs);
    if (e4 >= 1) {
      stageHands(i, st);
    } else if (i >= a) {
      stageScatter(i, st);
      if (e4 > 0) {
        stageHands(i, from);
        mix(st, from, e4, i);
      }
    } else if (e4 > 0) {
      stageDissolved(i, st);
      stageHands(i, from);
      mix(st, from, e4, i);
    } else {
      const delay = scene.rank[i]!;
      const e3b = scene.role[i] === ROLE.curve ? easeInOut(progress(t, T.dissolveFrom, T.handsFrom)) : stagedE(t, T.dissolveFrom, scene.dissolveDelay[i]!, 250, 350);
      const e3 = stagedE(t, T.windowFrom, delay, 400, 900);
      const e2 = stagedE(t, T.flattenFrom, delay, T.flattenDelayMs, T.flattenDurationMs);
      const e1 = stagedE(t, T.gatherFrom, scene.gatherDelay[i]!, T.gatherDelayMs, T.gatherDurationMs);
      if (e3b > 0) {
        stageWindow(i, st);
        stageDissolved(i, from);
        mix(st, from, e3b, i);
      } else if (e3 > 0) {
        stageRail(i, st);
        stageWindow(i, from);
        mix(st, from, e3, i);
      } else if (e2 > 0) {
        stageSphere(i, st);
        stageRail(i, from);
        mix(st, from, e2, i);
      } else if (e1 > 0) {
        stageScatter(i, st);
        stageSphere(i, from);
        mix(st, from, e1, i);
      } else {
        stageScatter(i, st);
      }
    }

    out.x[i] = st.x;
    out.y[i] = st.y;
    out.alpha[i] = st.alpha;
    out.size[i] = st.size;

    const axis = layout.vertical ? st.y : st.x;
    let inverse = 0;
    if (t >= T.sweepFrom) inverse = sweepTint(axis, edges.forward);
    if (t >= T.sweepBackFrom) inverse = 1 - sweepTint(axisLength - axis, edges.back);
    out.inverse[i] = inverse;
  }
}
