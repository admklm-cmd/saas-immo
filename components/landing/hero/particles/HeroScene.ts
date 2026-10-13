import { createPrng } from "@/components/motion/engine/prng";

import { FOCAL, LIVE_AMPLITUDE, LIVE_PLANE_SPEED, PLANES, PLANE_COUNT, SEEDS, SKIN_FADE_SHARE, type Tier } from "./hero-config";
import type { Hands } from "./hands-data";
import { handsRobotPose } from "./hands-robots";
import { buildHoldPlan, ballFrame, ballYawAt, type HoldPlan } from "./hold-transitions";
import { pairHold, type HoldPairing } from "./hold-pairing";
import type { Layout, Placement, Rect } from "./layout";
import { applyHandsMotion, buildHandsMotion, createHandsLive, updateLive, type HandsLive, type HandsMotion } from "./live-motion";
import { QUIET_MULT, growQuiet, quietLevel, type QuietBox } from "./quiet-zone";
import { computeRobotPoses } from "./robot-motion";
import { emptyPose, type RobotPose } from "./robots";
import { SPHERE_END_MS, SphereField } from "./sphere-field";
import type { Shape } from "./shapes";
import { phaseDuration, type PhaseState } from "./timeline";
import { bezier, buildCurvature, easeInOutCubic, easeInOutSine, progressOf } from "./trajectory";

/**
 * The data and the per-frame maths of the hero opening (docs/design-system.md T.2, T.3; §2.11.4 ter
 * C, D). No canvas here: the scene turns a sequence time into point positions and depth buckets in
 * preallocated typed arrays (no allocation per frame), and robot poses. Each identity keeps its slot
 * through every image (big sphere, held ball, hands); the « skin » points exist only in the opening.
 * The sphere is `SphereField`, the pairing `pairHold`, the two transitions `buildHoldPlan`.
 */

/** Points below this depth (normalised) of a solid are drawn one plane paler: the back reads as the back. */
const BACK_Z = -0.12;
/** Levels of the quiet zone (3) times levels of the skin fade (3): the classes of a bucket. */
export const CLASS_COUNT = 9;
/** Opacity multiplier of the three skin fade levels. */
export const FADE_MULT = [1, 0.55, 0.2] as const;
/** Window (ms) in which the left hand steps back to its place during the last transition. */
const SLIDE_FROM_MS = 400;
const SLIDE_SPAN_MS = 2000;

/** Normalised shape → px, with a yaw (around the vertical axis), a tilt (around x) and a soft perspective. */
export function placeShape(shape: Shape, place: Placement, yaw: number, tilt: number, count: number, x: Float32Array, y: Float32Array, z: Float32Array): void {
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const cosT = Math.cos(tilt);
  const sinT = Math.sin(tilt);
  for (let i = 0; i < count; i++) {
    const px = shape.x[i]!;
    const py = shape.y[i]!;
    const pz = shape.z[i]!;
    const x1 = px * cosY + pz * sinY;
    const z1 = -px * sinY + pz * cosY;
    const y2 = py * cosT - z1 * sinT;
    const z2 = py * sinT + z1 * cosT;
    const s = FOCAL / (FOCAL - z2);
    x[i] = place.cx + x1 * place.sx * s;
    y[i] = place.cy + y2 * place.sy * s;
    z[i] = z2;
  }
}

export class HeroScene {
  /** Identities: the points of the hands. */
  readonly count: number;
  /** Skin points of the opening, stored after the identities. */
  readonly skin: number;
  readonly plane: Uint8Array;
  /** Current positions (CSS px) and their depth bucket lists, written by `compute`. */
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly z: Float32Array;
  /** Buckets by plane then class: `plane * CLASS_COUNT + class`. */
  readonly buckets: readonly Uint32Array[];
  readonly bucketSize: Int32Array;
  /** Poses of the robots, written by `computeRobots`. */
  readonly robots: RobotPose[];
  /** State of the second animation (the index fingers), written by `updateLive`. */
  readonly live: HandsLive = createHandsLive();
  /** Skin points drawn in the last frame (published as `data-skin`). */
  skinDrawn = 0;

  private readonly total: number;
  private readonly sphere: SphereField;
  private readonly fade: Float32Array;
  private readonly tmp: { x: Float32Array; y: Float32Array; z: Float32Array };
  private pairing: HoldPairing | null = null;
  private plan: HoldPlan | null = null;
  private hands: Hands | null = null;
  private motion: HandsMotion | null = null;
  private layout: Layout | null = null;
  private quiet: QuietBox[] = [];
  private readonly curve: { kappa: Float32Array; noise: Float32Array }[];
  private readonly w1: Float32Array;
  private readonly w2: Float32Array;
  private readonly p1: Float32Array;
  private readonly p2: Float32Array;
  private readonly ampLive: Float32Array;
  private readonly kappa: readonly Float32Array[];
  private fading = false;

  constructor(readonly tier: Tier) {
    const count = tier.points;
    const total = count + tier.skin;
    this.count = count;
    this.skin = tier.skin;
    this.total = total;
    this.x = new Float32Array(total);
    this.y = new Float32Array(total);
    this.z = new Float32Array(total);
    this.tmp = { x: new Float32Array(total), y: new Float32Array(total), z: new Float32Array(total) };
    this.fade = new Float32Array(total).fill(1);
    this.bucketSize = new Int32Array(PLANE_COUNT * CLASS_COUNT);
    this.buckets = Array.from({ length: PLANE_COUNT * CLASS_COUNT }, () => new Uint32Array(total));
    this.robots = Array.from({ length: tier.robots }, emptyPose);
    this.curve = [0, 1].map((stream) => buildCurvature(total, stream));
    this.kappa = this.curve.map((entry) => entry.kappa);
    this.sphere = new SphereField(total);

    const random = createPrng(SEEDS.plane);
    this.plane = new Uint8Array(total);
    const micro = createPrng(SEEDS.micro);
    this.w1 = new Float32Array(total);
    this.w2 = new Float32Array(total);
    this.p1 = new Float32Array(total);
    this.p2 = new Float32Array(total);
    this.ampLive = new Float32Array(total);
    for (let i = 0; i < total; i++) {
      const r = random();
      const plane = r < PLANES[0].share ? 0 : r < PLANES[0].share + PLANES[1].share ? 1 : 2;
      this.plane[i] = plane;
      // Periods of 4 to 9 s, random phases.
      this.w1[i] = (2 * Math.PI) / (4 + micro() * 5);
      this.w2[i] = (2 * Math.PI) / (4 + micro() * 5);
      this.p1[i] = micro() * Math.PI * 2;
      this.p2[i] = micro() * Math.PI * 2;
      this.ampLive[i] = LIVE_AMPLITUDE * LIVE_PLANE_SPEED[plane];
    }
    this.robots.forEach((pose) => (pose.alpha = 0));
  }

  get currentLayout(): Layout | null {
    return this.layout;
  }

  get ready(): boolean {
    return this.hands !== null;
  }

  get handsData(): Hands | null {
    return this.hands;
  }

  /** Number of quiet rectangles in use (published as `data-quiet`). */
  get quietCount(): number {
    return this.quiet.length;
  }

  /** The text rectangles (stage coordinates) the opening keeps calm. */
  setQuiet(rects: readonly Rect[]): void {
    this.quiet = growQuiet(rects);
  }

  /** The baked hands: pairs the identities with them (T.2) and prepares the transitions. */
  setHands(hands: Hands): void {
    this.hands = hands;
    const n = this.count;
    // Where the identities are at the end of the sphere, in sphere units: the left and the right half.
    this.sphere.frame(SPHERE_END_MS, { cx: 0, cy: 0, sx: 1, sy: 1 }, this.tmp.x, this.tmp.y, this.tmp.z, 0, this.total, false);
    this.pairing = pairHold(hands, n, this.skin, this.tmp);
    // Computed once, out of the loop: the weight of each point in the move of the fingers (S.4).
    this.motion = buildHandsMotion(this.pairing.handsShape.x, this.pairing.handsShape.y, n, hands.tips);
    this.plan = null;
    this.prepare();
  }

  /** New geometry (first layout, resize): the transitions are rebuilt, the sequence time is kept. */
  setLayout(layout: Layout): void {
    this.layout = layout;
    this.plan = null;
    this.prepare();
  }

  private prepare(): void {
    const { layout, pairing } = this;
    if (!layout || !pairing) return;
    const n = this.count;
    // Where each identity is in the final image.
    const hand = { x: new Float32Array(n), y: new Float32Array(n), z: new Float32Array(n) };
    placeShape(pairing.handsShape, layout.hands, 0, 0, n, hand.x, hand.y, hand.z);
    this.plan = buildHoldPlan({ layout, pairing, sphere: this.sphere, count: n, skin: this.skin, hand, curve: this.curve, ampLive: this.ampLive });
  }

  /** Sequence time at which the hands are needed: the scene holds the sphere until they are loaded. */
  get holdMs(): number {
    return this.hands ? Infinity : SPHERE_END_MS;
  }

  /** The micro-movement (S.4) of identity `i`: a small slow drift, `amp` px at most. */
  private drift(i: number, amp: number, liveSec: number): void {
    this.x[i] = this.x[i]! + amp * Math.sin(this.w1[i]! * liveSec + this.p1[i]!);
    this.y[i] = this.y[i]! + amp * Math.sin(this.w2[i]! * liveSec + this.p2[i]!);
  }

  /**
   * Writes the positions of the first `drawCount` identities (and the first `skinDraw` skin points) at
   * the sequence time `sequenceMs` into `x`, `y`, `z`, then sorts them in depth buckets. `liveSec`
   * drives the micro-movement (`micro` false = still points, for the pause and reduced motion).
   */
  compute(state: PhaseState, sequenceMs: number, liveSec: number, micro: boolean, drawCount: number, skinDraw = 0): void {
    const { layout, pairing, plan } = this;
    this.skinDrawn = 0;
    if (!layout) {
      this.bucketSize.fill(0);
      return;
    }
    const { x, y, z } = this;
    const n = this.count;
    const skinEnd = n + Math.min(skinDraw, this.skin);
    const phase = state.phase;
    this.fading = false;

    if (phase === "sphere" || (!plan && phase !== "hands")) {
      const ms = Math.min(sequenceMs, SPHERE_END_MS);
      this.sphere.frame(ms, layout.sphere, x, y, z, 0, drawCount);
      this.sphere.frame(ms, layout.sphere, x, y, z, n, skinEnd);
      this.sortBuckets(drawCount, skinEnd, true);
      return;
    }
    if (!plan || !pairing) {
      this.bucketSize.fill(0);
      return;
    }
    const isLeft = pairing.isLeft;

    if (phase === "to-hand") {
      const t = plan.toHand;
      const duration = phaseDuration("to-hand");
      for (let i = 0; i < skinEnd; i++) {
        if (i === drawCount && drawCount < n) i = n;
        if (i >= skinEnd) break;
        const q = progressOf(state.local, t.delay[i]!, duration, 0.4);
        const e = easeInOutCubic(q);
        x[i] = bezier(t.ax[i]!, t.cx[i]!, t.bx[i]!, e);
        y[i] = bezier(t.ay[i]!, t.cy[i]!, t.by[i]!, e);
        z[i] = t.az[i]! + (t.bz[i]! - t.az[i]!) * e;
        if (i < n) {
          if (micro) this.drift(i, t.ampB[i]! * e, liveSec);
        } else {
          // Skin: it leaves the picture over the last 45 % of its trip (smoothstep).
          const k = Math.min(1, Math.max(0, (q - (1 - SKIN_FADE_SHARE)) / SKIN_FADE_SHARE));
          this.fade[i] = 1 - k * k * (3 - 2 * k);
        }
      }
      this.fading = skinEnd > n;
      this.sortBuckets(drawCount, skinEnd, true);
      return;
    }

    if (phase === "hand") {
      ballFrame(ballYawAt(sequenceMs), layout.ball, pairing.ball, 0, 0, drawCount, x, y, z, isLeft);
      for (let i = 0; i < drawCount; i++) {
        if (!isLeft[i]) continue;
        x[i] = plan.held.x[i]!;
        y[i] = plan.held.y[i]!;
        z[i] = plan.held.z[i]!;
        if (micro) this.drift(i, this.ampLive[i]!, liveSec);
      }
      this.sortBuckets(drawCount, n, true);
      return;
    }

    if (phase === "to-hands") {
      const t = plan.toHands;
      const duration = phaseDuration("to-hands");
      const slide = easeInOutSine((state.local - SLIDE_FROM_MS) / SLIDE_SPAN_MS);
      for (let i = 0; i < drawCount; i++) {
        if (isLeft[i]) {
          x[i] = plan.hand.x[i]! - layout.holdShift * (1 - slide);
          y[i] = plan.hand.y[i]!;
          z[i] = plan.hand.z[i]!;
          if (micro) this.drift(i, this.ampLive[i]!, liveSec);
          continue;
        }
        const e = easeInOutCubic(progressOf(state.local, t.delay[i]!, duration, 0.4));
        x[i] = bezier(t.ax[i]!, t.cx[i]!, t.bx[i]!, e);
        y[i] = bezier(t.ay[i]!, t.cy[i]!, t.by[i]!, e);
        z[i] = t.az[i]! + (t.bz[i]! - t.az[i]!) * e;
        if (micro) this.drift(i, t.ampB[i]! * e, liveSec);
      }
      this.sortBuckets(drawCount, n, true);
      return;
    }

    // The hands, the second animation (acte 2, unchanged): the points keep their identity (S.4).
    placeShape(pairing.handsShape, layout.hands, 0, 0, drawCount, x, y, z);
    if (micro) for (let i = 0; i < drawCount; i++) this.drift(i, this.ampLive[i]!, liveSec);
    if (this.motion) applyHandsMotion(this.motion, this.live, drawCount, x, y);
    this.sortBuckets(drawCount, n, false);
  }

  /** The state of the living act at `actSec` seconds (`moving` false = the image of rest: pause, reduced motion). */
  updateLive(actSec: number, moving: boolean): HandsLive {
    if (!this.hands || !this.layout) return this.live;
    return updateLive(this.live, actSec, this.hands, this.layout.hands, this.tier.motionScale, moving);
  }

  /** Back to the start of the act (replay): no residual state of the previous run. */
  resetLive(): void {
    Object.assign(this.live, createHandsLive());
  }

  /**
   * Sorts the points `0..drawCount-1` and `count..skinEnd-1` into depth buckets: plane (the back of a
   * solid is one plane paler), then class (quiet level × skin fade level). `quiet` false = acte 2, untouched.
   */
  private sortBuckets(drawCount: number, skinEnd: number, quiet: boolean): void {
    this.bucketSize.fill(0);
    const { plane, z, x, y, fade, buckets, bucketSize } = this;
    const boxes = quiet ? this.quiet : [];
    const fading = this.fading;
    const n = this.count;
    let skin = 0;
    for (let i = 0; i < skinEnd; i++) {
      if (i === drawCount && drawCount < n) i = n;
      if (i >= skinEnd) break;
      let f = 0;
      if (i >= n && fading) {
        const a = fade[i]!;
        if (a < 0.06) continue;
        f = a >= 0.78 ? 0 : a >= 0.38 ? 1 : 2;
      }
      const p = Math.min(2, plane[i]! + (z[i]! < BACK_Z ? 1 : 0));
      const q = boxes.length === 0 ? 0 : quietLevel(boxes, x[i]!, y[i]!);
      const bucket = p * CLASS_COUNT + q * 3 + f;
      buckets[bucket]![bucketSize[bucket]!++] = i;
      if (i >= n) skin++;
    }
    this.skinDrawn = skin;
  }

  /** Opacity multiplier of a class (quiet level × skin fade level). */
  static classAlpha(cls: number): number {
    return QUIET_MULT[Math.floor(cls / 3)]! * FADE_MULT[cls % 3]!;
  }

  /** Poses of the robots at a sequence time (`still`: resting on the index fingers). */
  computeRobots(state: PhaseState, sequenceMs: number, still: boolean): void {
    for (const pose of this.robots) pose.alpha = 0;
    if (!this.layout) return;
    computeRobotPoses(this.robots, state, sequenceMs, still, { layout: this.layout, hands: this.hands, kappa: this.kappa, tier: this.tier, live: this.live });
  }

  /** A trailing ghost of a robot of the hands, `behind` px back along its rail. */
  ghostPose(index: number, behind: number, out: RobotPose): RobotPose {
    const layout = this.layout;
    if (!layout || !this.hands) {
      out.alpha = 0;
      return out;
    }
    return handsRobotPose(index, this.hands, layout.hands, this.live, this.tier, out, behind);
  }

  /** Where the held ball is and which share of the right-half identities sits in its disc (115 % of the radius), for tests. */
  ballStats(): { x: number; y: number; r: number; part: number } | null {
    const layout = this.layout;
    const isLeft = this.pairing?.isLeft;
    if (!layout || !isLeft) return null;
    const { cx, cy, r } = layout.ball;
    let inside = 0;
    let right = 0;
    for (let i = 0; i < this.count; i++) {
      if (isLeft[i]) continue;
      right++;
      if (Math.hypot(this.x[i]! - cx, this.y[i]! - cy) <= r * 1.15) inside++;
    }
    return { x: cx, y: cy, r, part: right ? inside / right : 0 };
  }

  /** The shapes, for tests: the final hands (paired to the identities) and the ball. */
  get shapes(): { hands: Shape | null; ball: Shape | null; isLeft: Uint8Array } {
    return { hands: this.pairing?.handsShape ?? null, ball: this.pairing?.ball ?? null, isLeft: this.pairing?.isLeft ?? new Uint8Array(0) };
  }
}
