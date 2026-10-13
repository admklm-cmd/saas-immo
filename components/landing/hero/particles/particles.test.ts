import { describe, expect, it } from "vitest";

import { createPrng } from "@/components/motion/engine/prng";

import { decodeHands } from "./hands-data";
import baked from "./hands.baked.json";
import { HeroScene } from "./HeroScene";
import { BALL_RADIUS_SHARE, HOLD_SHIFT, PLANES, resolveTier } from "./hero-config";
import { computeLayout } from "./layout";
import { hilbertIndex, pairingPermutation, pairShapes, permute, rankShare } from "./pairing";
import { robotPose, restingRobot, emptyPose } from "./robots";
import { SPHERE } from "./hero-config";
import { buildBall, buildSphere } from "./shapes";
import { SEQUENCE_END_MS, contactOpacity, phaseAt, PHASES, SCHEDULE, birthOpacity } from "./timeline";
import { WAVE_SPREAD, bezier, buildCurvature, delayOf, easeInOutCubic, progressOf } from "./trajectory";

const PHONE = resolveTier(390, false);
const ZONE = { x: 100, y: 500, w: 190, h: 280 };

describe("tiers (docs/design-system.md §2.11.4 ter D, L)", () => {
  it("gives 14 000 / 9 000 / 3 600 points by width, and the light tier to a coarse pointer", () => {
    expect([resolveTier(1440, false).points, resolveTier(1280, false).points, resolveTier(1279, false).points, resolveTier(767, false).points]).toEqual([14_000, 14_000, 9_000, 3_600]);
    expect(resolveTier(1440, true).points).toBe(3_600);
    expect(resolveTier(1440, false).robots).toBe(14);
    expect([resolveTier(1440, false).skin, resolveTier(1024, false).skin, resolveTier(390, false).skin]).toEqual([12_000, 6_000, 1_800]);
    expect(resolveTier(390, false).robotSize).toBe(5);
  });

  it("splits the points in three planes whose shares add up to one", () => {
    expect(PLANES.reduce((sum, plane) => sum + plane.share, 0)).toBeCloseTo(1, 10);
    expect(PLANES.map((plane) => plane.alpha)).toEqual([0.78, 0.5, 0.22]);
  });
});

describe("phases (docs/design-system.md T.2)", () => {
  it("runs the five phases in order with the documented durations (no cloud, no apple)", () => {
    expect(SCHEDULE.map((slot) => slot.phase)).toEqual([...PHASES]);
    expect([...PHASES]).toEqual(["sphere", "to-hand", "hand", "to-hands", "hands"]);
    const ends = SCHEDULE.map((slot) => slot.to);
    expect(ends.slice(0, 4)).toEqual([3800, 6600, 8200, 10_600]);
    expect(SEQUENCE_END_MS).toBe(10_600);
    expect(phaseAt(0).phase).toBe("sphere");
    expect(phaseAt(3799).phase).toBe("sphere");
    expect(phaseAt(3800).phase).toBe("to-hand");
    expect(phaseAt(6600).phase).toBe("hand");
    expect(phaseAt(8200).phase).toBe("to-hands");
    expect(phaseAt(10_599).phase).toBe("to-hands");
    expect(phaseAt(10_600).phase).toBe("hands");
    expect(phaseAt(99_999).phase).toBe("hands");
    expect(phaseAt(-5).phase).toBe("sphere");
  });

  it("never goes back as time grows, and reports the progress inside a transition", () => {
    let last = 0;
    for (let ms = 0; ms < 12_000; ms += 7) {
      const index = phaseAt(ms).index;
      expect(index).toBeGreaterThanOrEqual(last);
      last = index;
    }
    expect(phaseAt(5200).progress).toBeCloseTo(0.5, 10);
    expect(phaseAt(5200).transition).toBe(true);
    expect(phaseAt(7000).transition).toBe(false);
  });

  it("is born over 800 ms and shows the cobalt point only after the sequence", () => {
    expect([birthOpacity(0), birthOpacity(400), birthOpacity(800), birthOpacity(5000)]).toEqual([0, 0.5, 1, 1]);
    expect([contactOpacity(10_000), contactOpacity(10_600), contactOpacity(10_750), contactOpacity(11_000)]).toEqual([0, 0, 0.5, 1]);
  });
});

describe("shapes (docs/design-system.md T.3)", () => {
  it("builds the asked number of points, always finite and deterministic", () => {
    for (const build of [buildSphere, buildBall]) {
      const shape = build(2_000);
      expect(shape.count).toBe(2_000);
      expect([...shape.x, ...shape.y, ...shape.z].every(Number.isFinite)).toBe(true);
      expect(Array.from(build(2_000).x.slice(0, 20))).toEqual(Array.from(shape.x.slice(0, 20)));
    }
  });

  it("puts every point of the sphere on one sphere of diameter 1", () => {
    const sphere = buildSphere(3_000);
    for (let i = 0; i < sphere.count; i += 37) expect(Math.hypot(sphere.x[i]!, sphere.y[i]!, sphere.z[i]!)).toBeCloseTo(0.5, 5);
  });

  it("is denser at the poles: the 16° caps hold at least 1.8 times the mean density", () => {
    const sphere = buildSphere(20_000);
    const cosCap = Math.cos(SPHERE.cap);
    let inCaps = 0;
    for (let i = 0; i < sphere.count; i++) if (Math.abs(sphere.y[i]!) / 0.5 >= cosCap) inCaps++;
    // Share of the surface of the two caps: (1 - cos cap).
    const meanDensity = 1 / 1;
    const capDensity = inCaps / sphere.count / (1 - cosCap);
    expect(capDensity / meanDensity).toBeGreaterThanOrEqual(1.8);
  });

  it("builds a ball of radius 1 whose heart is denser than a plain surface (65 % on the surface, 35 % in the volume)", () => {
    const ball = buildBall(4_000);
    const radii = Array.from(ball.x, (value, i) => Math.hypot(value, ball.y[i]!, ball.z[i]!));
    expect(Math.max(...radii)).toBeLessThanOrEqual(1 + 1e-5);
    const surface = radii.filter((radius) => radius > 0.999).length / radii.length;
    expect(surface).toBeGreaterThan(0.6);
    expect(surface).toBeLessThan(0.7);
    expect(radii.filter((radius) => radius < 0.5).length / radii.length).toBeGreaterThan(0.1);
  });

  it("no longer exports the apple or the cloud", async () => {
    const shapes = (await import("./shapes")) as Record<string, unknown>;
    expect(shapes.buildApple).toBeUndefined();
    expect(shapes.buildCloud).toBeUndefined();
  });
});

describe("pairing (§2.11.4 ter C.1)", () => {
  it("indexes every cell of the Hilbert grid once", () => {
    const seen = new Uint8Array(1024 * 1024);
    for (let x = 0; x < 1024; x++) for (let y = 0; y < 1024; y++) seen[hilbertIndex(x, y)] = 1;
    expect(seen.reduce((sum, value) => sum + value, 0)).toBe(1024 * 1024);
  });

  it("pairs rank for rank with a permutation, deterministically", () => {
    const from = buildSphere(1_500);
    const to = buildBall(1_500);
    const perm = pairingPermutation(from, to);
    expect(new Set(perm).size).toBe(1_500);
    expect(Array.from(pairingPermutation(from, to).slice(0, 50))).toEqual(Array.from(perm.slice(0, 50)));
    const paired = pairShapes(from, to);
    expect(paired.count).toBe(1_500);
    expect(() => pairShapes(from, buildSphere(10))).toThrow();
  });

  it("moves points a short way: the paired travel is far shorter than a random pairing", () => {
    const from = buildSphere(3_000);
    const to = buildBall(3_000);
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
    for (const kind of ["to-hand", "to-hands"] as const) {
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
  scene.setLayout(computeLayout(390, 800, ZONE, PHONE, 779));
  scene.setHands(decodeHands(baked as never, PHONE.points));
  const layout = scene.currentLayout!;
  const total = (sceneToCheck: HeroScene) => Array.from(sceneToCheck.bucketSize).reduce((sum, value) => sum + value, 0);

  it("fits the big sphere in the visible height of the first screen, whole", () => {
    expect(layout.sphere.sx).toBeLessThanOrEqual(390);
    expect(layout.sphere.cy).toBeCloseTo(779 / 2, 5);
    const desktop = resolveTier(1440, false);
    expect(computeLayout(1440, 1049, { x: 256, y: 434, w: 928, h: 372 }, desktop, 835).sphere.sx).toBeCloseTo(818.3, 1);
    expect(computeLayout(1440, 1049, { x: 256, y: 434, w: 928, h: 372 }, desktop, 400).sphere.sx).toBeLessThanOrEqual(392);
  });

  it("fills the depth buckets with every drawn point exactly once (identities and skin)", () => {
    scene.compute(phaseAt(2_000), 2_000, 2, true, PHONE.points, PHONE.skin);
    expect(total(scene)).toBe(PHONE.points + PHONE.skin);
    const seen = new Set<number>();
    scene.buckets.forEach((list, b) => {
      for (let k = 0; k < scene.bucketSize[b]!; k++) seen.add(list[k]!);
    });
    expect(seen.size).toBe(PHONE.points + PHONE.skin);
    scene.compute(phaseAt(2_000), 2_000, 2, true, 1_000, 0);
    expect(total(scene)).toBe(1_000);
    expect(scene.skinDrawn).toBe(0);
  });

  it("keeps the whole sphere inside a disc of its diameter, and turns", () => {
    scene.compute(phaseAt(2_000), 2_000, 0, false, PHONE.points, PHONE.skin);
    const first = Float32Array.from(scene.x);
    for (let i = 0; i < PHONE.points; i++) {
      expect(Math.hypot(scene.x[i]! - layout.sphere.cx, scene.y[i]! - layout.sphere.cy)).toBeLessThanOrEqual(layout.sphere.sx * 0.58);
    }
    scene.compute(phaseAt(3_000), 3_000, 0, false, PHONE.points, PHONE.skin);
    let moved = 0;
    for (let i = 0; i < PHONE.points; i++) if (Math.abs(scene.x[i]! - first[i]!) > 2) moved++;
    expect(moved / PHONE.points).toBeGreaterThan(0.5);
  });

  it("is continuous at the end of every transition (the same point, the same place)", () => {
    for (const boundary of [3_800, 6_600, 8_200, 10_600]) {
      scene.compute(phaseAt(boundary - 0.5), boundary - 0.5, 0, false, PHONE.points, 0);
      const before = { x: Float32Array.from(scene.x), y: Float32Array.from(scene.y) };
      scene.compute(phaseAt(boundary), boundary, 0, false, PHONE.points, 0);
      let worst = 0;
      for (let i = 0; i < PHONE.points; i++) worst = Math.max(worst, Math.hypot(scene.x[i]! - before.x[i]!, scene.y[i]! - before.y[i]!));
      expect(worst, `boundary ${boundary}`).toBeLessThan(2.5);
    }
  });

  it("holds the ball: the right-half identities are inside its disc, the left hand steps back", () => {
    scene.compute(phaseAt(7_400), 7_400, 0, false, PHONE.points, 0);
    const ball = scene.ballStats()!;
    expect(ball.r).toBeGreaterThanOrEqual(36);
    expect(ball.part).toBeGreaterThanOrEqual(0.85);
    // The left hand sits HOLD_SHIFT to the left of its final place.
    const target = scene.shapes.hands!;
    const left = scene.shapes.isLeft;
    let checked = 0;
    for (let i = 0; i < PHONE.points; i += 17) {
      if (!left[i]) continue;
      const s = 4 / (4 - scene.z[i]!);
      expect(scene.x[i]! - (layout.hands.cx + target.x[i]! * layout.hands.sx * s)).toBeCloseTo(-HOLD_SHIFT * layout.hands.sx, 0);
      checked++;
    }
    expect(checked).toBeGreaterThan(20);
    expect(BALL_RADIUS_SHARE).toBe(0.07);
  });

  it("fades the skin out before the end of the hand taking the ball, and draws no skin after", () => {
    scene.compute(phaseAt(6_599), 6_599, 0, false, PHONE.points, PHONE.skin);
    expect(scene.skinDrawn).toBeLessThan(PHONE.skin * 0.2);
    scene.compute(phaseAt(7_000), 7_000, 0, false, PHONE.points, 0);
    expect(scene.skinDrawn).toBe(0);
  });

  it("ends on the hands: every point on its baked place, around the contact point", () => {
    scene.compute(phaseAt(10_600), 10_600, 11, false, PHONE.points, 0);
    const target = scene.shapes.hands!;
    for (let i = 0; i < PHONE.points; i += 53) {
      // The soft perspective (focal 4 shape heights) scales a point by its depth.
      const s = 4 / (4 - scene.z[i]!);
      expect(scene.x[i]).toBeCloseTo(layout.hands.cx + target.x[i]! * layout.hands.sx * s, 1);
      expect(scene.y[i]).toBeCloseTo(layout.hands.cy + target.y[i]! * layout.hands.sy * s, 1);
    }
  });

  it("keeps each point inside 1.8 px of its place in the living end state (micro-movement), and still without motion", () => {
    scene.compute(phaseAt(10_900), 10_900, 0, false, PHONE.points, 0);
    const rest = { x: Float32Array.from(scene.x), y: Float32Array.from(scene.y) };
    let worst = 0;
    for (const second of [1, 2.7, 5.3, 8.1]) {
      scene.compute(phaseAt(10_900), 10_900, second, true, PHONE.points, 0);
      for (let i = 0; i < PHONE.points; i++) worst = Math.max(worst, Math.abs(scene.x[i]! - rest.x[i]!), Math.abs(scene.y[i]! - rest.y[i]!));
    }
    expect(worst).toBeLessThanOrEqual(1.8 + 1e-3);
    scene.compute(phaseAt(10_900), 10_900, 3, false, PHONE.points, 0);
    expect(Array.from(scene.x.slice(0, 40))).toEqual(Array.from(rest.x.slice(0, 40)));
  });

  it("keeps its robots on their rails: finite poses, alpha between 0 and 1, resting ones near the index tips", () => {
    for (const ms of [1_000, 2_500, 4_500, 6_000, 7_500, 9_400, 10_900]) {
      scene.computeRobots(phaseAt(ms), ms, false);
      for (const pose of scene.robots) {
        expect([pose.x, pose.y, pose.z, pose.alpha].every(Number.isFinite)).toBe(true);
        expect(pose.alpha).toBeGreaterThanOrEqual(0);
        expect(pose.alpha).toBeLessThanOrEqual(1);
      }
    }
    scene.computeRobots(phaseAt(10_900), 10_900, true);
    const tipX = layout.hands.cx + scene.handsData!.tips.left[0] * layout.hands.sx;
    const tipY = layout.hands.cy + scene.handsData!.tips.left[1] * layout.hands.sy;
    const near = scene.robots.filter((pose) => pose.alpha > 0 && Math.hypot(pose.x - tipX, pose.y - tipY) < 120);
    expect(near.length).toBeGreaterThan(0);
    expect(scene.robots.filter((pose) => pose.alpha > 0)).toHaveLength(4);
  });

  it("puts a few robots on the big sphere (3 on a phone), three around the ball, and keeps cobalt out of the opening", () => {
    scene.computeRobots(phaseAt(2_000), 2_000, false);
    expect(scene.robots.filter((pose) => pose.alpha > 0)).toHaveLength(PHONE.sphereRobots);
    scene.computeRobots(phaseAt(7_400), 7_400, false);
    expect(scene.robots.filter((pose) => pose.alpha > 0)).toHaveLength(3);
    for (const ms of [2_000, 5_000, 7_400, 9_800, 10_500]) {
      scene.computeRobots(phaseAt(ms), ms, false);
      expect(scene.robots.some((pose) => pose.accent)).toBe(false);
    }
  });

  it("holds the sphere until the hands are loaded rather than drawing a broken image", () => {
    const early = new HeroScene(PHONE);
    early.setLayout(computeLayout(390, 800, ZONE, PHONE, 779));
    expect(early.holdMs).toBe(3_800);
    early.compute(phaseAt(9_500), 9_500, 0, false, PHONE.points, 0);
    expect(total(early)).toBe(PHONE.points);
    early.computeRobots(phaseAt(9_500), 9_500, false);
    expect(scene.holdMs).toBe(Infinity);
  });

  it("gives poses for each kind of rail", () => {
    const hands = scene.handsData!;
    const pose = emptyPose();
    const context = { layout, hands, count: 6 };
    for (const kind of ["sphere", "ball", "hands"] as const) {
      robotPose(kind, 2, 3.3, context, pose);
      expect([pose.x, pose.y].every(Number.isFinite)).toBe(true);
    }
    restingRobot(1, hands, layout.hands, pose);
    expect(pose.alpha).toBe(1);
  });
});
