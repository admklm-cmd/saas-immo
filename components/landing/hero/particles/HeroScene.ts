import { createPrng } from "@/components/motion/engine/prng";

import { CLOUD_DRIFT, FOCAL, LIVE_AMPLITUDE, PLANES, PLANE_COUNT, SEEDS, SPHERE_TILT, type Tier } from "./hero-config";
import type { Hands } from "./hands-data";
import type { Layout, Placement } from "./layout";
import { pairShapes, rankShare } from "./pairing";
import { computeRobotPoses } from "./robot-motion";
import { appleYawAt, emptyPose, robotPose, sphereYawAt, type RobotPose } from "./robots";
import { buildApple, buildCloud, buildSphere, type Shape } from "./shapes";
import { phaseDuration, type Phase, type PhaseState, type TransitionKind } from "./timeline";
import { WAVE_SPREAD, bezier, buildCurvature, controlPoint, delayOf, easeInOutCubic, progressOf } from "./trajectory";

/**
 * The data and the per-frame maths of the hero metamorphosis (docs/design-system.md §2.11.4 ter
 * C, D). No canvas here: the scene turns a sequence time into point positions and depth buckets
 * in preallocated typed arrays (no allocation per frame), and robot poses. Each point keeps its
 * identity (its slot) through every shape.
 */

/** Points below this depth (normalised) of a solid are drawn one plane paler: the back reads as the back. */
const BACK_Z = -0.12;

type Transition = {
  readonly kind: TransitionKind;
  readonly duration: number;
  readonly spread: number;
  readonly ax: Float32Array;
  readonly ay: Float32Array;
  readonly az: Float32Array;
  readonly bx: Float32Array;
  readonly by: Float32Array;
  readonly bz: Float32Array;
  readonly cx: Float32Array;
  readonly cy: Float32Array;
  readonly delay: Float32Array;
  readonly ampA: Float32Array;
  readonly ampB: Float32Array;
};

const PREV: Record<TransitionKind, Phase> = { "to-sphere": "cloud", "to-apple": "sphere", "to-hands": "apple" };
const NEXT: Record<TransitionKind, Phase> = { "to-sphere": "sphere", "to-apple": "apple", "to-hands": "hands" };

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
  readonly count: number;
  readonly plane: Uint8Array;
  /** Current positions (CSS px) and their depth bucket lists, written by `compute`. */
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly z: Float32Array;
  readonly buckets: readonly Uint32Array[];
  readonly bucketSize = new Int32Array(PLANE_COUNT);
  /** Poses of the robots, written by `computeRobots`. */
  readonly robots: RobotPose[];

  private readonly cloud: Shape;
  private readonly sphere: Shape;
  private readonly apple: Shape;
  private handsShape: Shape | null = null;
  private hands: Hands | null = null;
  private layout: Layout | null = null;
  private readonly transitions = new Map<TransitionKind, Transition>();
  private readonly curve: { kappa: Float32Array; noise: Float32Array }[];
  private readonly w1: Float32Array;
  private readonly w2: Float32Array;
  private readonly p1: Float32Array;
  private readonly p2: Float32Array;
  private readonly ampCloud: Float32Array;
  private readonly ampLive: Float32Array;
  private readonly control = { x: 0, y: 0 };

  constructor(readonly tier: Tier) {
    const count = tier.points;
    this.count = count;
    this.cloud = buildCloud(count);
    this.sphere = pairShapes(this.cloud, buildSphere(count));
    this.apple = pairShapes(this.sphere, buildApple(count));
    this.x = new Float32Array(count);
    this.y = new Float32Array(count);
    this.z = new Float32Array(count);
    this.buckets = Array.from({ length: PLANE_COUNT }, () => new Uint32Array(count));
    this.robots = Array.from({ length: tier.robots }, emptyPose);
    this.curve = [0, 1, 2].map((stream) => buildCurvature(count, stream));

    const random = createPrng(SEEDS.plane);
    this.plane = new Uint8Array(count);
    const micro = createPrng(SEEDS.micro);
    this.w1 = new Float32Array(count);
    this.w2 = new Float32Array(count);
    this.p1 = new Float32Array(count);
    this.p2 = new Float32Array(count);
    this.ampCloud = new Float32Array(count);
    this.ampLive = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const r = random();
      const plane = r < PLANES[0].share ? 0 : r < PLANES[0].share + PLANES[1].share ? 1 : 2;
      this.plane[i] = plane;
      // Periods of 4 to 9 s, random phases.
      this.w1[i] = (2 * Math.PI) / (4 + micro() * 5);
      this.w2[i] = (2 * Math.PI) / (4 + micro() * 5);
      this.p1[i] = micro() * Math.PI * 2;
      this.p2[i] = micro() * Math.PI * 2;
      this.ampCloud[i] = CLOUD_DRIFT * PLANES[plane].speed;
      this.ampLive[i] = LIVE_AMPLITUDE * PLANES[plane].speed;
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

  /** The baked hands, paired to the apple. Rebuilds the last transition. */
  setHands(hands: Hands): void {
    this.hands = hands;
    this.handsShape = pairShapes(this.apple, hands.shape);
    this.transitions.delete("to-hands");
    this.prepare("to-hands");
  }

  /** New geometry (first layout, resize): every transition is rebuilt, the sequence time is kept. */
  setLayout(layout: Layout): void {
    this.layout = layout;
    this.transitions.clear();
    this.prepare("to-sphere");
    this.prepare("to-apple");
    this.prepare("to-hands");
  }

  private shapeOf(phase: Phase): Shape | null {
    if (phase === "cloud") return this.cloud;
    if (phase === "sphere") return this.sphere;
    if (phase === "apple") return this.apple;
    return this.handsShape;
  }

  private placementOf(phase: Phase, layout: Layout): Placement {
    return phase === "cloud" ? layout.cloud : phase === "sphere" ? layout.sphere : phase === "apple" ? layout.apple : layout.hands;
  }

  /** Frozen pose (yaw, tilt) of the shape at the boundary of a transition. */
  private poseOf(phase: Phase, boundary: "start" | "end"): { yaw: number; tilt: number } {
    if (phase === "sphere") return { yaw: sphereYawAt(boundary === "end" ? 4800 : 3400), tilt: SPHERE_TILT };
    if (phase === "apple") return { yaw: appleYawAt(boundary === "end" ? 8200 : 6800), tilt: 0 };
    return { yaw: 0, tilt: 0 };
  }

  private prepare(kind: TransitionKind): void {
    const layout = this.layout;
    if (!layout || this.transitions.has(kind)) return;
    const from = this.shapeOf(PREV[kind]);
    const to = this.shapeOf(NEXT[kind]);
    if (!from || !to) return;
    const n = this.count;
    const make = () => new Float32Array(n);
    const t: Transition = {
      kind,
      duration: phaseDuration(kind),
      spread: WAVE_SPREAD[kind],
      ax: make(), ay: make(), az: make(), bx: make(), by: make(), bz: make(), cx: make(), cy: make(), delay: make(), ampA: make(), ampB: make(),
    };
    const a = this.poseOf(PREV[kind], "end");
    const b = this.poseOf(NEXT[kind], "start");
    placeShape(from, this.placementOf(PREV[kind], layout), a.yaw, a.tilt, n, t.ax, t.ay, t.az);
    placeShape(to, this.placementOf(NEXT[kind], layout), b.yaw, b.tilt, n, t.bx, t.by, t.bz);

    // The wave: who leaves first (docs/design-system.md §2.11.4 ter C.3).
    let rank: Float32Array;
    if (kind === "to-sphere") {
      rank = rankShare(t.ax);
    } else if (kind === "to-apple") {
      const cx = layout.apple.cx;
      const cy = layout.apple.cy;
      rank = rankShare(Array.from(t.bx, (value, i) => Math.atan2(t.by[i]! - cy, value - cx)));
    } else {
      const { x: cx, y: cy } = layout.contact;
      const near = rankShare(Array.from(t.bx, (value, i) => Math.hypot(value - cx, t.by[i]! - cy)));
      rank = near.map((share) => 1 - share);
    }
    const { kappa, noise } = this.curve[kind === "to-sphere" ? 0 : kind === "to-apple" ? 1 : 2]!;
    for (let i = 0; i < n; i++) {
      controlPoint(t.ax[i]!, t.ay[i]!, t.bx[i]!, t.by[i]!, kappa[i]!, this.control);
      t.cx[i] = this.control.x;
      t.cy[i] = this.control.y;
      t.delay[i] = delayOf(rank[i]!, noise[i]!, t.duration, t.spread);
      t.ampA[i] = kind === "to-sphere" ? this.ampCloud[i]! : this.ampLive[i]!;
      t.ampB[i] = this.ampLive[i]!;
    }
    this.transitions.set(kind, t);
  }

  /** Sequence time at which the hands are needed: the scene holds the apple until they are loaded. */
  get holdMs(): number {
    return this.hands ? Infinity : 8200;
  }

  /**
   * Writes the positions of the first `drawCount` points at the sequence time `sequenceMs` into
   * `x`, `y`, `z`, then sorts them in depth buckets. `liveSec` drives the micro-movement
   * (`micro` false = still points, for the pause and reduced motion).
   */
  compute(state: PhaseState, sequenceMs: number, liveSec: number, micro: boolean, drawCount: number): void {
    const layout = this.layout;
    if (!layout) {
      this.bucketSize.fill(0);
      return;
    }
    const { x, y, z } = this;
    let ampFrom: Float32Array | null = null;
    if (state.transition) {
      const kind = state.phase as TransitionKind;
      const t = this.transitions.get(kind);
      if (t) {
        const tau = state.local;
        for (let i = 0; i < drawCount; i++) {
          const e = easeInOutCubic(progressOf(tau, t.delay[i]!, t.duration, t.spread));
          x[i] = bezier(t.ax[i]!, t.cx[i]!, t.bx[i]!, e);
          y[i] = bezier(t.ay[i]!, t.cy[i]!, t.by[i]!, e);
          z[i] = t.az[i]! + (t.bz[i]! - t.az[i]!) * e;
          if (micro) {
            const amp = t.ampA[i]! + (t.ampB[i]! - t.ampA[i]!) * e;
            x[i] = x[i]! + amp * Math.sin(this.w1[i]! * liveSec + this.p1[i]!);
            y[i] = y[i]! + amp * Math.sin(this.w2[i]! * liveSec + this.p2[i]!);
          }
        }
        this.sortBuckets(drawCount);
        return;
      }
      // No transition ready (hands still loading): hold the previous shape.
      ampFrom = this.ampLive;
    }
    const phase: Phase = state.transition ? PREV[state.phase as TransitionKind] : state.phase;
    const shape = this.shapeOf(phase);
    if (!shape) {
      this.bucketSize.fill(0);
      return;
    }
    const pose = this.poseOf(phase, "start");
    const yaw = phase === "sphere" ? sphereYawAt(sequenceMs) : phase === "apple" ? appleYawAt(sequenceMs) : 0;
    placeShape(shape, this.placementOf(phase, layout), yaw, pose.tilt, drawCount, x, y, z);
    if (micro) {
      const amp = ampFrom ?? (phase === "cloud" ? this.ampCloud : this.ampLive);
      for (let i = 0; i < drawCount; i++) {
        x[i] = x[i]! + amp[i]! * Math.sin(this.w1[i]! * liveSec + this.p1[i]!);
        y[i] = y[i]! + amp[i]! * Math.sin(this.w2[i]! * liveSec + this.p2[i]!);
      }
    }
    this.sortBuckets(drawCount);
  }

  private sortBuckets(drawCount: number): void {
    const [b0, b1, b2] = this.buckets as [Uint32Array, Uint32Array, Uint32Array];
    let n0 = 0;
    let n1 = 0;
    let n2 = 0;
    const { plane, z } = this;
    for (let i = 0; i < drawCount; i++) {
      const p = plane[i]! + (z[i]! < BACK_Z ? 1 : 0);
      if (p <= 0) b0[n0++] = i;
      else if (p === 1) b1[n1++] = i;
      else b2[n2++] = i;
    }
    this.bucketSize[0] = n0;
    this.bucketSize[1] = n1;
    this.bucketSize[2] = n2;
  }

  /** Poses of the robots at a sequence time (`still`: resting on the index fingers). */
  computeRobots(state: PhaseState, sequenceMs: number, liveSec: number, still: boolean): void {
    for (const pose of this.robots) pose.alpha = 0;
    if (!this.layout) return;
    computeRobotPoses(this.robots, state, sequenceMs, liveSec, still, { layout: this.layout, hands: this.hands, cloud: this.cloud, kappa: this.curve.map((entry) => entry.kappa) });
  }

  /** A trailing ghost of a robot of the hands, `behind` px back along its rail. */
  ghostPose(index: number, liveSec: number, behind: number, out: RobotPose): RobotPose {
    const layout = this.layout;
    if (!layout) {
      out.alpha = 0;
      return out;
    }
    return robotPose("hands", index, Math.max(0, liveSec - 10.6), 0, { layout, hands: this.hands, count: this.robots.length }, out, behind);
  }

  /** The shapes, for tests. */
  get shapes(): { cloud: Shape; sphere: Shape; apple: Shape; hands: Shape | null } {
    return { cloud: this.cloud, sphere: this.sphere, apple: this.apple, hands: this.handsShape };
  }
}
