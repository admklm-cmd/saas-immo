import { describe, expect, it } from "vitest";

import { createPrng } from "@/components/motion/engine/prng";

import { createDust, DUST, dustCount, stepDust } from "../../living/page-dust";
import { decodeHands } from "./hands-data";
import baked from "./hands.baked.json";
import { HeroScene } from "./HeroScene";
import { PLANES, resolveTier } from "./hero-config";
import { computeLayout } from "./layout";
import { hilbertIndex, pairingPermutation, pairShapes, permute, rankShare } from "./pairing";
import { robotPose, restingRobot, emptyPose } from "./robots";
import { appleParts, appleProfile, buildApple, buildCloud, buildSphere } from "./shapes";
import { SEQUENCE_END_MS, contactOpacity, phaseAt, PHASES, SCHEDULE, birthOpacity } from "./timeline";
import { WAVE_SPREAD, bezier, buildCurvature, delayOf, easeInOutCubic, progressOf } from "./trajectory";

const PHONE = resolveTier(390, false);
const ZONE = { x: 100, y: 500, w: 190, h: 280 };

describe("tiers (docs/design-system.md §2.11.4 ter D, L)", () => {
  it("gives 14 000 / 9 000 / 3 600 points by width, and the light tier to a coarse pointer", () => {
    expect([resolveTier(1440, false).points, resolveTier(1280, false).points, resolveTier(1279, false).points, resolveTier(767, false).points]).toEqual([14_000, 14_000, 9_000, 3_600]);
    expect(resolveTier(1440, true).points).toBe(3_600);
    expect(resolveTier(1440, false).robots).toBe(14);
    expect(resolveTier(390, false).robotSize).toBe(5);
  });

  it("splits the points in three planes whose shares add up to one", () => {
    expect(PLANES.reduce((sum, plane) => sum + plane.share, 0)).toBeCloseTo(1, 10);
    expect(PLANES.map((plane) => plane.alpha)).toEqual([0.78, 0.5, 0.22]);
  });
});

describe("phases (§2.11.4 ter B)", () => {
  it("runs the seven phases in order with the documented durations", () => {
    expect(SCHEDULE.map((slot) => slot.phase)).toEqual([...PHASES]);
    const ends = SCHEDULE.map((slot) => slot.to);
    expect(ends.slice(0, 6)).toEqual([1400, 3400, 4800, 6800, 8200, 10_600]);
    expect(SEQUENCE_END_MS).toBe(10_600);
    expect(phaseAt(0).phase).toBe("cloud");
    expect(phaseAt(1399).phase).toBe("cloud");
    expect(phaseAt(1400).phase).toBe("to-sphere");
    expect(phaseAt(3400).phase).toBe("sphere");
    expect(phaseAt(6800).phase).toBe("apple");
    expect(phaseAt(10_599).phase).toBe("to-hands");
    expect(phaseAt(10_600).phase).toBe("hands");
    expect(phaseAt(99_999).phase).toBe("hands");
    expect(phaseAt(-5).phase).toBe("cloud");
  });

  it("never goes back as time grows, and reports the progress inside a transition", () => {
    let last = 0;
    for (let ms = 0; ms < 12_000; ms += 7) {
      const index = phaseAt(ms).index;
      expect(index).toBeGreaterThanOrEqual(last);
      last = index;
    }
    expect(phaseAt(2400).progress).toBeCloseTo(0.5, 10);
    expect(phaseAt(2400).transition).toBe(true);
    expect(phaseAt(4000).transition).toBe(false);
  });

  it("is born over 600 ms and shows the cobalt point only after the sequence", () => {
    expect([birthOpacity(0), birthOpacity(300), birthOpacity(600), birthOpacity(5000)]).toEqual([0, 0.5, 1, 1]);
    expect([contactOpacity(10_000), contactOpacity(10_600), contactOpacity(10_750), contactOpacity(11_000)]).toEqual([0, 0, 0.5, 1]);
  });
});

describe("shapes (§2.11.4 ter D)", () => {
  it("builds the asked number of points, always finite and deterministic", () => {
    for (const build of [buildCloud, buildSphere, buildApple]) {
      const shape = build(2_000);
      expect(shape.count).toBe(2_000);
      expect([...shape.x, ...shape.y, ...shape.z].every(Number.isFinite)).toBe(true);
      expect(Array.from(build(2_000).x.slice(0, 20))).toEqual(Array.from(shape.x.slice(0, 20)));
    }
  });

  it("keeps the cloud inside the stage (with a margin) and without any readable shape", () => {
    const cloud = buildCloud(4_000);
    expect(Math.max(...cloud.x.map(Math.abs))).toBeLessThanOrEqual(0.58);
    expect(Math.max(...cloud.y.map(Math.abs))).toBeLessThanOrEqual(0.58);
  });

  it("puts every point of the ball on one sphere of diameter 1", () => {
    const sphere = buildSphere(3_000);
    for (let i = 0; i < sphere.count; i += 37) expect(Math.hypot(sphere.x[i]!, sphere.y[i]!, sphere.z[i]!)).toBeCloseTo(0.5, 5);
  });

  it("builds a whole apple: height 1, symmetric about the vertical axis, no bite", () => {
    const count = 8_000;
    const apple = buildApple(count);
    const parts = appleParts(count);
    expect(parts.body + parts.stem + parts.leaf).toBe(count);
    const ys = Array.from(apple.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(1, 4);

    // Body only (stem and leaf come after): the silhouette is the same on both sides.
    const body = { x: Array.from(apple.x.slice(0, parts.body)), y: Array.from(apple.y.slice(0, parts.body)) };
    const right = Math.max(...body.x);
    const left = -Math.min(...body.x);
    expect(Math.abs(right - left) / right).toBeLessThan(0.02);
    // Per horizontal band the widest point to the left and to the right match: nothing is missing on one side.
    for (let band = 0; band < 8; band++) {
      const lo = Math.min(...body.y) + ((Math.max(...body.y) - Math.min(...body.y)) * band) / 8;
      const hi = lo + (Math.max(...body.y) - Math.min(...body.y)) / 8;
      const xs = body.x.filter((_, i) => body.y[i]! >= lo && body.y[i]! < hi);
      if (xs.length < 30) continue;
      const wide = Math.max(...xs);
      const narrow = -Math.min(...xs);
      expect(Math.abs(wide - narrow) / wide, `band ${band}`).toBeLessThan(0.08);
    }
    // The leaf is on the LEFT of the stem (the brand logo has it on the right).
    const leaf = Array.from(apple.x.slice(count - parts.leaf));
    const stemTop = Array.from(apple.x.slice(parts.body, parts.body + parts.stem));
    const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
    expect(mean(leaf)).toBeLessThan(mean(stemTop) - 0.03);
  });

  it("has a profile without notch: the radius rises to the equator, then falls to the bottom", () => {
    let previous = 0;
    let peaked = false;
    for (let k = 1; k <= 400; k++) {
      const { rho } = appleProfile((k / 400) * Math.PI);
      if (!peaked && rho < previous - 1e-9) peaked = true;
      if (peaked) expect(rho).toBeLessThanOrEqual(previous + 1e-9);
      previous = rho;
    }
    // Under the dimple, the body goes down monotonically from the shoulder to the bottom.
    let y = appleProfile(0.7).y;
    for (let k = 1; k <= 200; k++) {
      const next = appleProfile(0.7 + (k / 200) * (Math.PI - 0.7)).y;
      expect(next).toBeLessThanOrEqual(y + 0.02);
      y = next;
    }
  });
});

describe("pairing (§2.11.4 ter C.1)", () => {
  it("indexes every cell of the Hilbert grid once", () => {
    const seen = new Uint8Array(1024 * 1024);
    for (let x = 0; x < 1024; x++) for (let y = 0; y < 1024; y++) seen[hilbertIndex(x, y)] = 1;
    expect(seen.reduce((sum, value) => sum + value, 0)).toBe(1024 * 1024);
  });

  it("pairs rank for rank with a permutation, deterministically", () => {
    const from = buildCloud(1_500);
    const to = buildSphere(1_500);
    const perm = pairingPermutation(from, to);
    expect(new Set(perm).size).toBe(1_500);
    expect(Array.from(pairingPermutation(from, to).slice(0, 50))).toEqual(Array.from(perm.slice(0, 50)));
    const paired = pairShapes(from, to);
    expect(paired.count).toBe(1_500);
    expect(() => pairShapes(from, buildSphere(10))).toThrow();
  });

  it("moves points a short way: the paired travel is far shorter than a random pairing", () => {
    const from = buildSphere(3_000);
    const to = buildApple(3_000);
    const paired = pairShapes(from, to);
    const distance = (a: typeof from, b: typeof from) => {
      let total = 0;
      for (let i = 0; i < a.count; i++) total += Math.hypot(a.x[i]! - b.x[i]!, a.y[i]! - b.y[i]!);
      return total / a.count;
    };
    // A random pairing of the same two shapes, for comparison.
    const random = createPrng(5);
    const shuffled = Uint32Array.from({ length: 3_000 }, (_, i) => i).sort(() => random() - 0.5);
    expect(distance(from, paired)).toBeLessThan(distance(from, permute(to, shuffled)) * 0.5);
  });

  it("ranks values from 0 to 1", () => {
    expect(Array.from(rankShare([5, 1, 3]))).toEqual([1, 0, 0.5]);
  });
});

describe("trajectories (§2.11.4 ter C)", () => {
  it("is still before its delay and finished after, never overshooting", () => {
    expect(progressOf(100, 200, 2_000, 0.35)).toBe(0);
    expect(progressOf(2_000, 700, 2_000, 0.35)).toBe(1);
    for (let tau = 0; tau <= 2_000; tau += 50) {
      const e = easeInOutCubic(progressOf(tau, 300, 2_000, 0.35));
      expect(e).toBeGreaterThanOrEqual(0);
      expect(e).toBeLessThanOrEqual(1);
    }
    expect(bezier(10, 50, 20, 0)).toBe(10);
    expect(bezier(10, 50, 20, 1)).toBe(20);
  });

  it("finishes every point inside the duration, whatever its rank and noise", () => {
    for (const kind of ["to-sphere", "to-apple", "to-hands"] as const) {
      const spread = WAVE_SPREAD[kind];
      for (const rank of [0, 0.5, 1]) for (const noise of [-1, 0, 1]) {
        const delay = delayOf(rank, noise, 2_000, spread);
        expect(delay).toBeGreaterThanOrEqual(0);
        expect(progressOf(2_000, delay, 2_000, spread)).toBe(1);
      }
    }
  });

  it("curves toward one side for 70 % of the points (a vortex), by 0.10 to 0.30", () => {
    const { kappa } = buildCurvature(5_000, 0);
    const positive = Array.from(kappa).filter((value) => value > 0).length / kappa.length;
    expect(positive).toBeGreaterThan(0.66);
    expect(positive).toBeLessThan(0.74);
    expect(Math.min(...Array.from(kappa).map(Math.abs))).toBeGreaterThanOrEqual(0.1 - 1e-6);
    expect(Math.max(...Array.from(kappa).map(Math.abs))).toBeLessThanOrEqual(0.3 + 1e-6);
  });
});

describe("baked hands", () => {
  const hands = decodeHands(baked as never, 3_600);
  it("holds enough points, inside the frame, with the index tips apart and left of right", () => {
    expect((baked as { count: number }).count).toBeGreaterThanOrEqual(14_000);
    expect((baked as { count: number }).count).toBeLessThanOrEqual(20_000);
    expect(hands.shape.count).toBe(3_600);
    expect(Math.max(...hands.shape.x.map(Math.abs))).toBeLessThanOrEqual(0.6);
    expect(hands.tips.left[0]).toBeLessThan(hands.tips.right[0]);
    expect(hands.gap).toBeGreaterThan(0.01);
    expect(hands.gap).toBeLessThan(0.1);
  });

  it("has one rail per finger or arm, each with 48 vertices, ending near an index tip for the main ones", () => {
    expect(hands.rails.length).toBeGreaterThanOrEqual(6);
    for (const rail of hands.rails) expect(rail).toHaveLength(48);
    const end = hands.rails[0]!.at(-1)!;
    expect(Math.hypot(end[0] - hands.tips.left[0], end[1] - hands.tips.left[1])).toBeLessThan(0.02);
  });

  it("puts more points on the two hands than far from them", () => {
    // Left of the left tip and right of the right tip is where the hands are; the middle gap is nearly empty.
    const inGap = Array.from(hands.shape.x).filter((x, i) => x > hands.tips.left[0] + 0.02 && x < hands.tips.right[0] - 0.02 && Math.abs(hands.shape.y[i]!) < 0.08).length;
    expect(inGap / hands.shape.count).toBeLessThan(0.03);
  });
});

describe("HeroScene (the maths of a frame)", () => {
  const scene = new HeroScene(PHONE);
  scene.setLayout(computeLayout(390, 800, ZONE, PHONE));
  scene.setHands(decodeHands(baked as never, PHONE.points));
  const layout = scene.currentLayout!;

  it("fills the depth buckets with every drawn point exactly once", () => {
    scene.compute(phaseAt(4_000), 4_000, 4, true, PHONE.points);
    expect(scene.bucketSize[0]! + scene.bucketSize[1]! + scene.bucketSize[2]!).toBe(PHONE.points);
    const seen = new Set<number>();
    scene.buckets.forEach((list, b) => {
      for (let k = 0; k < scene.bucketSize[b]!; k++) seen.add(list[k]!);
    });
    expect(seen.size).toBe(PHONE.points);
    scene.compute(phaseAt(4_000), 4_000, 4, true, 1_000);
    expect(scene.bucketSize[0]! + scene.bucketSize[1]! + scene.bucketSize[2]!).toBe(1_000);
  });

  it("is continuous at the end of every transition (the same point, the same place)", () => {
    for (const boundary of [1_400, 3_400, 4_800, 6_800, 8_200, 10_600]) {
      scene.compute(phaseAt(boundary - 0.5), boundary - 0.5, 0, false, PHONE.points);
      const before = { x: Float32Array.from(scene.x), y: Float32Array.from(scene.y) };
      scene.compute(phaseAt(boundary), boundary, 0, false, PHONE.points);
      let worst = 0;
      for (let i = 0; i < PHONE.points; i++) worst = Math.max(worst, Math.hypot(scene.x[i]! - before.x[i]!, scene.y[i]! - before.y[i]!));
      expect(worst, `boundary ${boundary}`).toBeLessThan(1.5);
    }
  });

  it("ends on the hands: every point on its baked place, around the contact point", () => {
    scene.compute(phaseAt(10_600), 10_600, 11, false, PHONE.points);
    const target = scene.shapes.hands!;
    for (let i = 0; i < PHONE.points; i += 53) {
      // The soft perspective (focal 4 shape heights) scales a point by its depth.
      const s = 4 / (4 - scene.z[i]!);
      expect(scene.x[i]).toBeCloseTo(layout.hands.cx + target.x[i]! * layout.hands.sx * s, 1);
      expect(scene.y[i]).toBeCloseTo(layout.hands.cy + target.y[i]! * layout.hands.sy * s, 1);
    }
  });

  it("keeps each point inside 1.4 px of its place in the living end state, and still without motion", () => {
    scene.compute(phaseAt(10_900), 10_900, 0, false, PHONE.points);
    const rest = { x: Float32Array.from(scene.x), y: Float32Array.from(scene.y) };
    let worst = 0;
    for (const second of [1, 2.7, 5.3, 8.1]) {
      scene.compute(phaseAt(10_900), 10_900, second, true, PHONE.points);
      for (let i = 0; i < PHONE.points; i++) worst = Math.max(worst, Math.abs(scene.x[i]! - rest.x[i]!), Math.abs(scene.y[i]! - rest.y[i]!));
    }
    expect(worst).toBeLessThanOrEqual(1.4 + 1e-3);
    scene.compute(phaseAt(10_900), 10_900, 3, false, PHONE.points);
    expect(Array.from(scene.x.slice(0, 40))).toEqual(Array.from(rest.x.slice(0, 40)));
  });

  it("keeps its robots on their rails: finite poses, alpha between 0 and 1, resting ones near the index tips", () => {
    for (const ms of [1_000, 2_500, 4_000, 5_800, 7_500, 9_400, 10_900]) {
      scene.computeRobots(phaseAt(ms), ms, ms / 1000, false);
      for (const pose of scene.robots) {
        expect([pose.x, pose.y, pose.z, pose.alpha].every(Number.isFinite)).toBe(true);
        expect(pose.alpha).toBeGreaterThanOrEqual(0);
        expect(pose.alpha).toBeLessThanOrEqual(1);
      }
    }
    scene.computeRobots(phaseAt(10_900), 10_900, 0, true);
    const tipX = layout.hands.cx + scene.handsData!.tips.left[0] * layout.hands.sx;
    const tipY = layout.hands.cy + scene.handsData!.tips.left[1] * layout.hands.sy;
    const near = scene.robots.filter((pose) => pose.alpha > 0 && Math.hypot(pose.x - tipX, pose.y - tipY) < 120);
    expect(near.length).toBeGreaterThan(0);
    expect(scene.robots.filter((pose) => pose.alpha > 0)).toHaveLength(4);
  });

  it("starts the robots hidden in the cloud, then on the ball", () => {
    scene.computeRobots(phaseAt(500), 500, 0.5, false);
    expect(scene.robots.every((pose) => pose.alpha === 0)).toBe(true);
    scene.computeRobots(phaseAt(4_000), 4_000, 4, false);
    expect(scene.robots.every((pose) => pose.alpha === 1)).toBe(true);
  });

  it("holds the apple until the hands are loaded rather than drawing a broken image", () => {
    const early = new HeroScene(PHONE);
    early.setLayout(computeLayout(390, 800, ZONE, PHONE));
    expect(early.holdMs).toBe(8_200);
    early.compute(phaseAt(9_500), 9_500, 0, false, PHONE.points);
    expect(early.bucketSize[0]! + early.bucketSize[1]! + early.bucketSize[2]!).toBe(PHONE.points);
    early.computeRobots(phaseAt(9_500), 9_500, 9.5, false);
    expect(scene.holdMs).toBe(Infinity);
  });

  it("gives poses for each kind of rail", () => {
    const hands = scene.handsData!;
    const pose = emptyPose();
    const context = { layout, hands, count: 6 };
    for (const kind of ["sphere", "apple", "hands"] as const) {
      robotPose(kind, 2, 3.3, 0.1, context, pose);
      expect([pose.x, pose.y].every(Number.isFinite)).toBe(true);
    }
    restingRobot(1, hands, layout.hands, pose);
    expect(pose.alpha).toBe(1);
  });
});

describe("page dust (§2.11.4 ter J)", () => {
  it("is 220 particles from 1024 px, 120 below, never darker than 0.16", () => {
    expect([dustCount(1440), dustCount(1024), dustCount(1023), dustCount(390)]).toEqual([220, 220, 120, 120]);
    expect(Math.max(...DUST.planes.map((plane) => plane.alpha))).toBeLessThanOrEqual(0.16);
  });

  it("drifts slowly (3 to 8 px/s), wraps at the edges and is deterministic", () => {
    const dust = createDust(220);
    expect(Array.from(createDust(220).x.slice(0, 10))).toEqual(Array.from(dust.x.slice(0, 10)));
    for (let i = 0; i < dust.count; i++) {
      const speed = Math.hypot(dust.vx[i]!, dust.vy[i]!);
      expect(speed).toBeGreaterThanOrEqual(3 - 1e-3);
      expect(speed).toBeLessThanOrEqual(8 + 1e-3);
    }
    for (let step = 0; step < 600; step++) stepDust(dust, 1, 1000, 800);
    expect(Array.from(dust.x).every((value) => value >= 0 && value < 1)).toBe(true);
    expect(Array.from(dust.y).every((value) => value >= 0 && value < 1)).toBe(true);
  });
});
