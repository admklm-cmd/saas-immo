import { createPrng } from "@/components/motion/engine/prng";

import { FOCAL, LIVE_AMPLITUDE, LIVE_PLANE_SPEED, PLANES, PLANE_COUNT, SEEDS, type Tier } from "./hero-config";
import type { Hands } from "./hands-data";
import { handsRobotPose } from "./hands-robots";
import { pairHands, type HandsPairing } from "./hands-pairing";
import type { Layout, Placement, Rect } from "./layout";
import { buildHandsMotion, createHandsLive, updateLive, type HandsLive, type HandsMotion } from "./live-motion";
import { QUIET_MULT, growQuiet, quietLevel, type QuietBox } from "./quiet-zone";
import { computeRobotPoses, railClock } from "./robot-motion";
import { emptyPose, type RobotPose } from "./robots";
import { SPHERE_PAIRING_MS, SphereField } from "./sphere-field";
import type { Shape } from "./shapes";
import { SEQUENCE_END_MS, WAVE_END_MS, WAVE_START_MS, WAVE_WAIT } from "./timeline";
import { WAVE_NOISE, bezier, buildCurvature, controlPoint, flowEase, progressOf } from "./trajectory";

/**
 * The data and the per-frame maths of the hero opening (docs/design-system.md T.2, T.3; §2.11.4 ter
 * C, D). No canvas here: the scene turns a sequence time into point positions and depth buckets in
 * preallocated typed arrays (no allocation per frame), and robot poses. Each identity keeps its slot
 * through every image (big sphere, hands); the « skin » points exist only in the opening. There is no phase:
 * an identity is a continuous function of the time (docs/design-system.md U.4): the sphere (always turning) while
 * it waits, the hands (already breathing) once it has arrived, a Bézier between the two evaluated at the current
 * time while it flies. The sphere is `SphereField`, the pairing `pairHands`.
 */

/** Points below this depth (normalised) of a solid are drawn one plane paler: the back reads as the back. */
const BACK_Z = -0.12;
/** Levels of the quiet zone (3) times levels of the skin fade (3): the classes of a bucket. */
export const CLASS_COUNT = 9;
/** Opacity multiplier of the three skin fade levels. */
export const FADE_MULT = [1, 0.55, 0.2] as const;
/** Wave of the points from the sphere to the hands (docs/design-system.md U.4). */
const WAVE_MS = WAVE_END_MS - WAVE_START_MS;
/** The skin dissolves in place (it follows the sphere) over this long, starting at its rank × the same span after the wave starts (ms). */
const SKIN_FADE_MS = 1800;
/** Micro-movement: 2/3 of its amplitude on the sphere, the full amplitude of the act reached smoothly from this time (ms). */
const DRIFT_FROM_MS = 6000;
const DRIFT_SPHERE_SHARE = 2 / 3;

const control = { x: 0, y: 0 };

const smooth = (q: number) => {
  const x = Math.min(1, Math.max(0, q));
  return x * x * (3 - 2 * x);
};

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
  private pairing: HandsPairing | null = null;
  /** Final place of each identity (the hands, at rest), CSS px, written by `prepare`; delay of each point in the wave, ms. */
  private readonly hand: { x: Float32Array; y: Float32Array; z: Float32Array };
  private readonly delay: Float32Array;
  /** Breathing of the hands, kept on its own clock (it starts at 7 s, the act at 10.6 s): grafted onto `live`. */
  private readonly breath: HandsLive = createHandsLive();
  private hands: Hands | null = null;
  private motion: HandsMotion | null = null;
  private layout: Layout | null = null;
  private quiet: QuietBox[] = [];
  private readonly curve: { kappa: Float32Array; noise: Float32Array };
  private readonly w1: Float32Array;
  private readonly w2: Float32Array;
  private readonly p1: Float32Array;
  private readonly p2: Float32Array;
  private readonly ampLive: Float32Array;
  private fading = false;
  /** Clock (s) of the beads on the rails, written by `computeRobots`. */
  private railSec = 0;

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
    this.curve = buildCurvature(total, 0);
    this.hand = { x: new Float32Array(count), y: new Float32Array(count), z: new Float32Array(count) };
    this.delay = new Float32Array(total);
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

  /** The baked hands: pairs the identities with them (T.2) and prepares the wave. */
  setHands(hands: Hands): void {
    this.hands = hands;
    const n = this.count;
    // Where the identities are on the sphere at the pairing time, in sphere units: the left and the right half.
    this.sphere.frame(SPHERE_PAIRING_MS, { cx: 0, cy: 0, sx: 1, sy: 1 }, this.tmp.x, this.tmp.y, this.tmp.z, 0, this.total, false);
    this.pairing = pairHands(hands, n, this.skin, this.tmp);
    // Computed once, out of the loop: the weight of each point in the move of the fingers (S.4).
    this.motion = buildHandsMotion(this.pairing.handsShape.x, this.pairing.handsShape.y, n, hands.tips);
    // Delay of each identity in the wave: its rank on the sphere (left hand first), a little noise (U.4).
    const wait = WAVE_WAIT * WAVE_MS;
    for (let i = 0; i < n; i++) this.delay[i] = Math.max(0, Math.min(wait, wait * this.pairing.rank[i]! + this.curve.noise[i]! * WAVE_NOISE * WAVE_MS));
    this.prepare();
  }

  /** New geometry (first layout, resize): the final places are recomputed, the sequence time is kept. */
  setLayout(layout: Layout): void {
    this.layout = layout;
    this.prepare();
  }

  private prepare(): void {
    const { layout, pairing } = this;
    if (!layout || !pairing) return;
    placeShape(pairing.handsShape, layout.hands, 0, 0, this.count, this.hand.x, this.hand.y, this.hand.z);
  }

  /** Sequence time at which the hands are needed: the scene holds on the sphere (which goes on turning) until they are loaded. */
  get holdMs(): number {
    return this.hands ? Infinity : WAVE_START_MS;
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
   * One formula for the whole sequence: `bezier(A(T), C(T), B(T), e)` with `A` the sphere and `B` the hands at the current time.
   */
  compute(sequenceMs: number, liveSec: number, micro: boolean, drawCount: number, skinDraw = 0): void {
    const { layout, pairing, motion, live, sphere } = this;
    this.skinDrawn = 0;
    if (!layout) {
      this.bucketSize.fill(0);
      return;
    }
    const { x, y, z } = this;
    const n = this.count;
    const skinEnd = n + Math.min(skinDraw, this.skin);
    this.fading = false;
    const quiet = sequenceMs < SEQUENCE_END_MS;
    if (!pairing || !motion) {
      // The hands are not here (yet): the sphere goes on turning with the clock of the page, never still.
      sphere.prepare(Math.max(sequenceMs, liveSec * 1000), layout.sphere);
      for (let i = 0; i < skinEnd; i++) {
        if (i === drawCount && drawCount < n) i = n;
        if (i >= skinEnd) break;
        sphere.at(i, x, y, z);
      }
      this.sortBuckets(drawCount, skinEnd, true);
      return;
    }
    sphere.prepare(sequenceMs, layout.sphere);
    const wave = sequenceMs - WAVE_START_MS;
    const grow = DRIFT_SPHERE_SHARE + (1 - DRIFT_SPHERE_SHARE) * smooth((sequenceMs - DRIFT_FROM_MS) / (SEQUENCE_END_MS - DRIFT_FROM_MS));
    const breathing = live.moving;
    const reach = live.reach;
    const [k0, k1] = live.breathK;
    const [b0, b1] = live.breathY;
    const [px0, px1] = live.pivotX;
    const [py0, py1] = live.pivotY;
    const { moveX, moveY, hand: side } = motion;
    const hand = this.hand;
    for (let i = 0; i < drawCount; i++) {
      const q = progressOf(wave, this.delay[i]!, WAVE_MS, WAVE_WAIT);
      // A(T): the sphere, still turning, for as long as the point has not arrived (and while it flies).
      if (q < 1) sphere.at(i, x, y, z);
      if (q > 0) {
        // B(T): the hands, at rest, breathing once the first hand has arrived.
        let bx = hand.x[i]!;
        let by = hand.y[i]!;
        if (breathing) {
          const right = side[i]! === 1;
          const k = right ? k1 : k0;
          bx += moveX[i]! * reach + (bx - (right ? px1 : px0)) * k;
          by += moveY[i]! * reach + (by - (right ? py1 : py0)) * k + (right ? b1 : b0);
        }
        const bz = hand.z[i]!;
        if (q >= 1) {
          x[i] = bx;
          y[i] = by;
          z[i] = bz;
        } else {
          const e = flowEase(q);
          controlPoint(x[i]!, y[i]!, bx, by, this.curve.kappa[i]!, control);
          x[i] = bezier(x[i]!, control.x, bx, e);
          y[i] = bezier(y[i]!, control.y, by, e);
          z[i] = z[i]! + (bz - z[i]!) * e;
        }
      }
      if (micro) this.drift(i, this.ampLive[i]! * grow, liveSec);
    }
    // The skin has no hand to go to: it follows the sphere and dissolves, left side first.
    for (let i = n; i < skinEnd; i++) {
      sphere.at(i, x, y, z);
      const k = Math.min(1, Math.max(0, (wave - SKIN_FADE_MS * pairing.rank[i]!) / SKIN_FADE_MS));
      this.fade[i] = 1 - k * k * (3 - 2 * k);
    }
    this.fading = skinEnd > n && wave > 0;
    this.sortBuckets(drawCount, skinEnd, quiet);
  }

  /**
   * The state of the living act at `actSec` seconds (`moving` false = the image of rest: pause, reduced motion).
   * The breathing of the hands has its own clock `breathSec` (it starts at 7 s, before the act) and is grafted onto the act state.
   */
  updateLive(actSec: number, moving: boolean, breathSec = actSec): HandsLive {
    const { hands, layout, live, breath } = this;
    if (!hands || !layout) return live;
    updateLive(live, actSec, hands, layout.hands, this.tier.motionScale, moving);
    if (!moving) return live;
    updateLive(breath, breathSec, hands, layout.hands, this.tier.motionScale, moving);
    const d0 = breath.breathY[0] - live.breathY[0];
    const d1 = breath.breathY[1] - live.breathY[1];
    live.breathY[0] = breath.breathY[0];
    live.breathY[1] = breath.breathY[1];
    live.breathK[0] = breath.breathK[0];
    live.breathK[1] = breath.breathK[1];
    live.tip.ly += d0;
    live.tip.ry += d1;
    live.contactY = (live.tip.ly + live.tip.ry) / 2;
    return live;
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
  computeRobots(sequenceMs: number, still: boolean): void {
    for (const pose of this.robots) pose.alpha = 0;
    if (!this.layout) return;
    this.railSec = railClock(sequenceMs, this.live);
    computeRobotPoses(this.robots, sequenceMs, still, { layout: this.layout, hands: this.hands, tier: this.tier, live: this.live });
  }

  /** A trailing ghost of a robot of the hands, `behind` px back along its rail. */
  ghostPose(index: number, behind: number, out: RobotPose): RobotPose {
    const layout = this.layout;
    if (!layout || !this.hands) {
      out.alpha = 0;
      return out;
    }
    return handsRobotPose(index, this.hands, layout.hands, this.live, this.tier, out, behind, this.railSec);
  }

  /** The hands paired to the identities, for tests. */
  get handsShape(): Shape | null {
    return this.pairing?.handsShape ?? null;
  }
}
