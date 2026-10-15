import { decodeHands, type BakedHands } from "@/components/landing/hero/particles/hands-data";
import { PLANES, SEEDS } from "@/components/landing/hero/particles/hero-config";
import { railLength } from "@/components/landing/hero/particles/rails";
import { buildSphere, shuffledIndices, type Shape } from "@/components/landing/hero/particles/shapes";
import { createPrng } from "@/components/motion/engine/prng";

import type { PromoDemo } from "./promo-demo";
import type { PromoLayout } from "./promo-format";

/**
 * Target shapes of the cloud (docs/motion/promo-2026-10.md §3.5): one population with fixed identities,
 * one target position per identity and per scene. Everything here is computed once from fixed seeds.
 */

/** One seed per stream, derived from the hero seeds so that the film shares the same family of draws. */
const SEED = {
  scatter: SEEDS.plane + 101,
  plane: SEEDS.plane + 102,
  lost: SEEDS.micro + 103,
  rail: SEEDS.wave + 104,
  roles: SEEDS.curve + 105,
  dust: SEEDS.skin + 106,
  phase: SEEDS.micro + 107,
  delay: SEEDS.wave + 108,
  bead: SEEDS.ball + 109,
} as const;

/** Roles of an identity in the dashboard scene (plan 5). */
export const ROLE = { contour: 0, baseline: 1, curve: 2, dust: 3 } as const;
const ROLE_SHARES = [0.41, 0.14, 0.28, 0.17] as const;

/** Thickness of the 6 stretches of the rail, px at 1920 (2 to 5 px, docs §3.5). */
const RAIL_THICKNESS = [5, 4.6, 4.2, 3.6, 3, 2.4] as const;

/** Number of points that disappear in plan 1 (« une douzaine »). */
const LOST_COUNT = 12;
/** Cobalt beads that circulate on the arms (docs §4 plan 6: « au plus 8 »). */
const HAND_BEADS = 8;
const BEAD_SPEED_PX = 150;

export type HandBead = { rail: number; start: number };

export type PromoScene = {
  layout: PromoLayout;
  n: number;
  a: number;
  plane: Uint8Array;
  phase: Float32Array;
  scatterX: Float32Array;
  scatterY: Float32Array;
  lostAt: Float32Array;
  gatherDelay: Float32Array;
  sphere: Shape;
  sphereCosLat: Float32Array;
  rank: Float32Array;
  railX: Float32Array;
  railY: Float32Array;
  railAcross: Float32Array;
  role: Uint8Array;
  windowX: Float32Array;
  windowY: Float32Array;
  curveX: Float32Array;
  curveY: Float32Array;
  curveU: Float32Array;
  dustX: Float32Array;
  dustY: Float32Array;
  dissolveDelay: Float32Array;
  handsX: Float32Array;
  handsY: Float32Array;
  handsTone: Float32Array;
  handsDelay: Float32Array;
  handsSide: Int8Array;
  /** Displacement (normalised units) of each hands point when the index tips touch. */
  handsMoveX: Float32Array;
  handsMoveY: Float32Array;
  /** Rails of the arms, oriented towards the contact point, and the beads on them. */
  armRails: (readonly [number, number])[][];
  beads: HandBead[];
  chart: { curve: (u: number) => number };
  handsTips: { left: readonly [number, number]; right: readonly [number, number] };
};

function quantileRanks(values: ArrayLike<number>, count: number): Float32Array {
  const order = Array.from({ length: count }, (_, i) => i).sort((p, q) => values[p]! - values[q]! || p - q);
  const ranks = new Float32Array(count);
  order.forEach((index, position) => {
    ranks[index] = (position + 0.5) / count;
  });
  return ranks;
}

/** Monotone cubic interpolation (Fritsch-Carlson) of `values`, `u` in 0..1. */
export function monotoneCurve(values: readonly number[]): (u: number) => number {
  const n = values.length;
  if (n === 0) return () => 0;
  if (n === 1) return () => values[0]!;
  const delta: number[] = [];
  for (let k = 0; k < n - 1; k++) delta.push(values[k + 1]! - values[k]!);
  const m: number[] = new Array(n).fill(0);
  m[0] = delta[0]!;
  m[n - 1] = delta[n - 2]!;
  for (let k = 1; k < n - 1; k++) m[k] = delta[k - 1]! * delta[k]! <= 0 ? 0 : (delta[k - 1]! + delta[k]!) / 2;
  for (let k = 0; k < n - 1; k++) {
    if (delta[k] === 0) {
      m[k] = 0;
      m[k + 1] = 0;
      continue;
    }
    const alpha = m[k]! / delta[k]!;
    const beta = m[k + 1]! / delta[k]!;
    const norm = Math.hypot(alpha, beta);
    if (norm > 3) {
      m[k] = (3 * alpha * delta[k]!) / norm;
      m[k + 1] = (3 * beta * delta[k]!) / norm;
    }
  }
  return (u) => {
    const position = Math.min(n - 1 - 1e-9, Math.max(0, u * (n - 1)));
    const k = Math.floor(position);
    const s = position - k;
    const s2 = s * s;
    const s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * values[k]! + (s3 - 2 * s2 + s) * m[k]! + (-2 * s3 + 3 * s2) * values[k + 1]! + (s3 - s2) * m[k + 1]!;
  };
}

/** Point at `u` (0..1) of the perimeter of a rounded rectangle. */
export function roundedRectPoint(x: number, y: number, w: number, h: number, r: number, u: number): { x: number; y: number } {
  const straightW = w - 2 * r;
  const straightH = h - 2 * r;
  const arc = (Math.PI * r) / 2;
  const total = 2 * straightW + 2 * straightH + 4 * arc;
  let s = (((u % 1) + 1) % 1) * total;
  const corner = (cx: number, cy: number, start: number, f: number) => ({ x: cx + r * Math.cos(start + f * (Math.PI / 2)), y: cy + r * Math.sin(start + f * (Math.PI / 2)) });
  if (s < straightW) return { x: x + r + s, y };
  s -= straightW;
  if (s < arc) return corner(x + w - r, y + r, -Math.PI / 2, s / arc);
  s -= arc;
  if (s < straightH) return { x: x + w, y: y + r + s };
  s -= straightH;
  if (s < arc) return corner(x + w - r, y + h - r, 0, s / arc);
  s -= arc;
  if (s < straightW) return { x: x + w - r - s, y: y + h };
  s -= straightW;
  if (s < arc) return corner(x + r, y + h - r, Math.PI / 2, s / arc);
  s -= arc;
  if (s < straightH) return { x: x, y: y + h - r - s };
  s -= straightH;
  return corner(x + r, y + r, Math.PI, Math.min(1, s / arc));
}

export function railThickness(u: number): number {
  const stretches = RAIL_THICKNESS.length;
  const position = Math.min(stretches - 1, Math.max(0, u * stretches - 0.5));
  const k = Math.min(stretches - 2, Math.floor(position));
  return RAIL_THICKNESS[k]! + (RAIL_THICKNESS[k + 1]! - RAIL_THICKNESS[k]!) * (position - k);
}

/** Weight of the move of a hands point: the finger follows fully, the hand only a little (hero constants). */
export function handWeight(distance: number): number {
  const finger = 0.07;
  const hand = 0.32;
  return 0.65 * Math.exp(-((distance / finger) ** 2)) + 0.35 * Math.exp(-((distance / hand) ** 2));
}

export function buildScene(layout: PromoLayout, baked: BakedHands, demo: PromoDemo): PromoScene {
  const { count: n, active: a, width: W, height: H } = layout;

  // --- planes and phases --------------------------------------------------------------------
  const planeRandom = createPrng(SEED.plane);
  const plane = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const u = planeRandom();
    plane[i] = u < PLANES[0].share ? 0 : u < PLANES[0].share + PLANES[1].share ? 1 : 2;
  }
  const phaseRandom = createPrng(SEED.phase);
  const phase = new Float32Array(n * 2);
  for (let i = 0; i < phase.length; i++) phase[i] = phaseRandom() * Math.PI * 2;

  // --- scatter: denser in the middle, loose towards the edges --------------------------------
  const scatterRandom = createPrng(SEED.scatter);
  const scatterX = new Float32Array(n);
  const scatterY = new Float32Array(n);
  const gauss = () => {
    const u = Math.max(scatterRandom(), 1e-9);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * scatterRandom());
  };
  for (let i = 0; i < n; i++) {
    let x = 0;
    let y = 0;
    for (let tries = 0; tries < 12; tries++) {
      if (scatterRandom() < 0.55) {
        x = W / 2 + gauss() * W * 0.27;
        y = H / 2 + gauss() * H * 0.27;
      } else {
        x = scatterRandom() * W;
        y = scatterRandom() * H;
      }
      if (x >= 0 && x <= W && y >= 0 && y <= H) break;
      x = Math.min(W, Math.max(0, x));
      y = Math.min(H, Math.max(0, y));
    }
    scatterX[i] = x;
    scatterY[i] = y;
  }

  // --- plan 1: a dozen requests get lost ------------------------------------------------------
  const lostAt = new Float32Array(a).fill(-1);
  const lostPick = shuffledIndices(a, SEED.lost);
  for (let k = 0; k < LOST_COUNT; k++) lostAt[lostPick[k]!] = 2400 + (k * 700) / (LOST_COUNT - 1);

  // --- plan 2: gather delay by distance to the centre, then the sphere ------------------------
  const distance = new Float32Array(a);
  for (let i = 0; i < a; i++) distance[i] = Math.hypot(scatterX[i]! - layout.sphere.center.x, scatterY[i]! - layout.sphere.center.y);
  const gatherDelay = quantileRanks(distance, a);
  const sphere = buildSphere(a);
  const sphereCosLat = new Float32Array(a);
  for (let i = 0; i < a; i++) sphereCosLat[i] = Math.sqrt(Math.max(0, 1 - (sphere.y[i]! / 0.5) ** 2));

  // --- plan 3: the rail, ordered by the horizontal order of the sphere ------------------------
  const railRandom = createPrng(SEED.rail);
  const sphereOrder = new Float32Array(a);
  for (let i = 0; i < a; i++) sphereOrder[i] = (layout.vertical ? sphere.y[i]! : sphere.x[i]!) + (railRandom() - 0.5) * 0.02;
  const rank = quantileRanks(sphereOrder, a);
  const railX = new Float32Array(a);
  const railY = new Float32Array(a);
  const railAcross = new Float32Array(a);
  const { start, end } = layout.rail;
  const railScale = layout.vertical ? 0.78 : 1;
  for (let i = 0; i < a; i++) {
    const u = rank[i]!;
    const lattice = (Math.floor(u * a) * 0.6180339887) % 1;
    const across = (lattice - 0.5) * railThickness(u) * railScale * layout.pointScale;
    railAcross[i] = across;
    // The rail is horizontal in 16:9 and vertical in 9:16: the thickness is the other axis.
    railX[i] = start.x + (end.x - start.x) * u + (layout.vertical ? across : 0);
    railY[i] = start.y + (end.y - start.y) * u + (layout.vertical ? 0 : across);
  }

  // --- plan 5: roles, window outline, baseline, curve, dust -----------------------------------
  const roleOrder = shuffledIndices(a, SEED.roles);
  const role = new Uint8Array(a);
  {
    let cursor = 0;
    for (let r = 0; r < ROLE_SHARES.length; r++) {
      const take = r === ROLE_SHARES.length - 1 ? a - cursor : Math.round(a * ROLE_SHARES[r]!);
      for (let k = 0; k < take; k++) role[roleOrder[cursor + k]!] = r;
      cursor += take;
    }
  }
  const byRank = Array.from({ length: a }, (_, i) => i).sort((p, q) => rank[p]! - rank[q]!);
  const members: number[][] = [[], [], [], []];
  for (const i of byRank) members[role[i]!]!.push(i);

  const windowX = new Float32Array(a);
  const windowY = new Float32Array(a);
  const curveX = new Float32Array(a);
  const curveY = new Float32Array(a);
  const curveU = new Float32Array(a).fill(-1);
  const win = layout.window;
  const chart = layout.chart;
  const maxValue = Math.max(...demo.cumulative, 0);
  const curve = monotoneCurve(demo.cumulative);
  const curveRandom = createPrng(SEED.rail + 7);
  members[ROLE.contour]!.forEach((i, m, list) => {
    const p = roundedRectPoint(win.x, win.y, win.w, win.h, win.radius, (m + 0.5) / list.length);
    windowX[i] = p.x;
    windowY[i] = p.y;
  });
  members[ROLE.baseline]!.forEach((i, m, list) => {
    windowX[i] = chart.x + ((m + 0.5) / list.length) * chart.w;
    windowY[i] = chart.baseline + (curveRandom() - 0.5) * 2;
  });
  members[ROLE.curve]!.forEach((i, m, list) => {
    const u = (m + 0.5) / list.length;
    curveU[i] = u;
    windowX[i] = chart.x + u * chart.w;
    windowY[i] = chart.baseline + (curveRandom() - 0.5) * 2;
    curveX[i] = windowX[i]!;
    curveY[i] = chart.baseline - (maxValue === 0 ? 0 : (curve(u) / maxValue) * chart.height) + (curveRandom() - 0.5) * 2.4;
  });

  const dustRandom = createPrng(SEED.dust);
  const dustX = new Float32Array(n);
  const dustY = new Float32Array(n);
  const gap = 36;
  for (let i = 0; i < n; i++) {
    let x = 0;
    let y = 0;
    for (let tries = 0; tries < 30; tries++) {
      x = dustRandom() * W;
      y = dustRandom() * H;
      const insideWindow = x > win.x - gap && x < win.x + win.w + gap && y > win.y - gap && y < win.y + win.h + gap;
      const inTitle = layout.vertical ? false : y > layout.title5.y - 60 && y < layout.title5.y + 60 && x > 560 && x < 1360;
      if (!insideWindow && !inTitle) break;
    }
    dustX[i] = x;
    dustY[i] = y;
  }
  const delayRandom = createPrng(SEED.delay);
  const dissolveDelay = new Float32Array(a);
  for (let i = 0; i < a; i++) dissolveDelay[i] = delayRandom();

  // --- plan 6: the hands --------------------------------------------------------------------
  const hands = decodeHands(baked, n);
  const handsX = new Float32Array(n);
  const handsY = new Float32Array(n);
  const handsSide = new Int8Array(n);
  const handsMoveX = new Float32Array(n);
  const handsMoveY = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = hands.shape.x[i]!;
    const y = hands.shape.y[i]!;
    handsX[i] = x;
    handsY[i] = y;
    const side = x < 0 ? -1 : 1;
    handsSide[i] = side;
    const tip = side < 0 ? hands.tips.left : hands.tips.right;
    const weight = handWeight(Math.hypot(x - tip[0], y - tip[1]));
    handsMoveX[i] = -tip[0] * weight;
    handsMoveY[i] = -tip[1] * weight;
  }
  const handsDelay = quantileRanks(handsX, n);

  const armRails = hands.rails.map((rail) => {
    const first = rail[0]!;
    const last = rail[rail.length - 1]!;
    const forward = Math.hypot(last[0], last[1]) <= Math.hypot(first[0], first[1]);
    return (forward ? [...rail] : [...rail].reverse()) as (readonly [number, number])[];
  });
  const beadRandom = createPrng(SEED.bead);
  const beads: HandBead[] = [];
  if (armRails.length > 0) {
    for (let k = 0; k < Math.min(HAND_BEADS, armRails.length * 2); k++) {
      const railIndex = k % armRails.length;
      const length = railLength(armRails[railIndex]!);
      beads.push({ rail: railIndex, start: beadRandom() * length * 0.6 });
    }
  }

  return {
    layout,
    n,
    a,
    plane,
    phase,
    scatterX,
    scatterY,
    lostAt,
    gatherDelay,
    sphere,
    sphereCosLat,
    rank,
    railX,
    railY,
    railAcross,
    role,
    windowX,
    windowY,
    curveX,
    curveY,
    curveU,
    dustX,
    dustY,
    dissolveDelay,
    handsX,
    handsY,
    handsTone: hands.tone,
    handsDelay,
    handsSide,
    handsMoveX,
    handsMoveY,
    armRails,
    beads,
    chart: { curve },
    handsTips: hands.tips,
  };
}

export const HAND_BEAD_SPEED_PX = BEAD_SPEED_PX;

/** Displacement (normalised units) of a point of the hands at full approach: used for the beads on the arms. */
export function handMove(tips: PromoScene["handsTips"], x: number, y: number): { x: number; y: number } {
  const tip = x < 0 ? tips.left : tips.right;
  const weight = handWeight(Math.hypot(x - tip[0], y - tip[1]));
  return { x: -tip[0] * weight, y: -tip[1] * weight };
}
