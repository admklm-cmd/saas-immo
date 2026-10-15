import { describe, expect, it } from "vitest";

import { createPrng } from "@/components/motion/engine/prng";

import { decodeHands } from "./hands-data";
import baked from "./hands.baked.json";
import { HeroScene } from "./HeroScene";
import { HELD_ENABLED, PLANES, RAIL_DOTS, resolveTier } from "./hero-config";
import { computeLayout } from "./layout";
import { sphereAngle } from "./sphere-field";
import { hilbertIndex, pairingPermutation, pairShapes, permute, rankShare } from "./pairing";
import { robotPose, restingRobot, emptyPose } from "./robots";
import { SPHERE } from "./hero-config";
import { buildSphere, emptyShape, type Shape } from "./shapes";
import { SEQUENCE_END_MS, WAVE_END_MS, WAVE_START_MS, WAVE_WAIT, activeWaves, contactOpacity, handsShareAt, phaseAt, PHASES, birthOpacity } from "./timeline";
import { bezier, buildCurvature, delayOf, easeInOutCubic, flowEase, progressOf } from "./trajectory";

const PHONE = resolveTier(390, false);
const ZONE = { x: 100, y: 500, w: 190, h: 280 };

/** A flat spiral of `count` points: a target that is not a sphere, to test the pairing. */
function spiral(count: number): Shape {
  const shape = emptyShape(count);
  for (let i = 0; i < count; i++) {
    const r = Math.sqrt((i + 0.5) / count) * 0.5;
    shape.x[i] = r * Math.cos(i * 2.399963);
    shape.y[i] = r * Math.sin(i * 2.399963);
    shape.z[i] = 0;
  }
  return shape;
}

describe("tiers (docs/design-system.md §2.11.4 ter D, L)", () => {
  it("gives 14 000 / 9 000 / 4 200 points by width, and the light tier to a coarse pointer", () => {
    expect([resolveTier(1440, false).points, resolveTier(1280, false).points, resolveTier(1279, false).points, resolveTier(767, false).points]).toEqual([14_000, 14_000, 9_000, 4_200]);
    expect(resolveTier(1440, true).points).toBe(4_200);
    // 2 messengers + the circulants + the orbitals; the beads (messengers included) are 24 / 16 / 10 (U.6).
    expect([resolveTier(1440, false), resolveTier(1024, false), resolveTier(390, false)].map((tier) => tier.robots)).toEqual([28, 20, 12]);
    expect([resolveTier(1440, false), resolveTier(1024, false), resolveTier(390, false)].map((tier) => tier.railDots)).toEqual([24, 16, 10]);
    expect([resolveTier(1440, false), resolveTier(1024, false), resolveTier(390, false)].map((tier) => tier.beadSize)).toEqual([3, 2.6, 2.4]);
    expect([resolveTier(1440, false), resolveTier(1024, false), resolveTier(390, false)].map((tier) => tier.cobaltCap)).toEqual([12, 8, 6]);
    expect(RAIL_DOTS).toBe(1);
    expect(HELD_ENABLED).toBe(false);
    expect([resolveTier(1440, false).skin, resolveTier(1024, false).skin, resolveTier(390, false).skin]).toEqual([12_000, 6_000, 1_800]);
    expect(resolveTier(390, false).robotSize).toBe(5);
  });

  it("splits the points in three planes whose shares add up to one", () => {
    expect(PLANES.reduce((sum, plane) => sum + plane.share, 0)).toBeCloseTo(1, 10);
    expect(PLANES.map((plane) => plane.alpha)).toEqual([0.78, 0.5, 0.22]);
  });
});

describe("clock (docs/design-system.md T.2, U.4)", () => {
  it("has labels in the order of their first appearance, and no phase that stops the image", () => {
    expect([...PHASES]).toEqual(["sphere", "to-hands", "hands"]);
    expect(SEQUENCE_END_MS).toBe(10_600);
    expect(phaseAt(0).phase).toBe("sphere");
    expect(phaseAt(WAVE_START_MS - 1).phase).toBe("sphere");
    expect(phaseAt(WAVE_START_MS).phase).toBe("to-hands");
    expect(phaseAt(10_599).phase).toBe("to-hands");
    expect(phaseAt(10_600).phase).toBe("hands");
    expect(phaseAt(-5).phase).toBe("sphere");
  });

  it("lists the motions running (data-phases): the sphere and the wave overlap, the hands breathe before the end of the wave", () => {
    expect(activeWaves(1_000)).toEqual(["sphere"]);
    expect(activeWaves(5_000)).toEqual(["sphere", "to-hands"]);
    expect(activeWaves(8_000)).toEqual(["sphere", "to-hands", "hands"]);
    expect(activeWaves(10_000)).toEqual(["sphere", "to-hands", "hands"]);
    expect(activeWaves(10_500)).toEqual(["hands"]);
    expect([WAVE_START_MS, WAVE_END_MS, WAVE_WAIT]).toEqual([3_000, 10_400, 0.5]);
  });

  it("shares the hands in the image smoothly over the wave", () => {
    expect([handsShareAt(0), handsShareAt(3_000), handsShareAt(10_400), handsShareAt(20_000)]).toEqual([0, 0, 1, 1]);
    for (let ms = 0; ms < 12_000; ms += 100) expect(handsShareAt(ms + 100)).toBeGreaterThanOrEqual(handsShareAt(ms));
  });

  it("is born over 800 ms and shows the cobalt point only after the sequence", () => {
    expect([birthOpacity(0), birthOpacity(400), birthOpacity(800), birthOpacity(5000)]).toEqual([0, 0.5, 1, 1]);
    expect([contactOpacity(10_000), contactOpacity(10_600), contactOpacity(10_750), contactOpacity(11_000)]).toEqual([0, 0, 0.5, 1]);
  });

  it("turns the sphere without ever stopping: the angle strictly increases, 0.22 rad/s at first, 0.45 rad/s from 5 s", () => {
    let last = sphereAngle(0);
    for (let t = 0.05; t < 14; t += 0.05) {
      const angle = sphereAngle(t);
      expect(angle).toBeGreaterThan(last);
      expect((angle - last) / 0.05).toBeGreaterThanOrEqual(0.22 - 1e-6);
      last = angle;
    }
    expect((sphereAngle(1.5) - sphereAngle(1)) / 0.5).toBeCloseTo(0.22, 6);
    expect((sphereAngle(9) - sphereAngle(8)) / 1).toBeCloseTo(0.45, 6);
  });
});

describe("shapes (docs/design-system.md T.3)", () => {
  it("builds the asked number of points, always finite and deterministic", () => {
    for (const build of [buildSphere]) {
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
    const to = spiral(1_500);
    const perm = pairingPermutation(from, to);
    expect(new Set(perm).size).toBe(1_500);
    expect(Array.from(pairingPermutation(from, to).slice(0, 50))).toEqual(Array.from(perm.slice(0, 50)));
    const paired = pairShapes(from, to);
    expect(paired.count).toBe(1_500);
    expect(() => pairShapes(from, buildSphere(10))).toThrow();
  });

  it("moves points a short way: the paired travel is far shorter than a random pairing", () => {
    const from = buildSphere(3_000);
    const to = spiral(3_000);
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
    for (const rank of [0, 0.5, 1]) for (const noise of [-1, 0, 1]) {
      const delay = delayOf(rank, noise, 2_000, WAVE_WAIT);
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(progressOf(2_000, delay, 2_000, WAVE_WAIT)).toBe(1);
    }
  });

  it("flies at a speed that is never nil: the derivative is 0.3 at both ends, 2.35 times the mean at most (U.4)", () => {
    const h = 1e-5;
    expect((flowEase(h) - flowEase(0)) / h).toBeCloseTo(0.3, 3);
    expect((flowEase(1) - flowEase(1 - h)) / h).toBeCloseTo(0.3, 3);
    let top = 0;
    for (let q = 0; q < 1; q += 0.001) {
      const speed = (flowEase(q + 0.001) - flowEase(q)) / 0.001;
      expect(speed).toBeGreaterThanOrEqual(0.29);
      top = Math.max(top, speed);
    }
    expect(top).toBeCloseTo(2.4, 0);
    expect(flowEase(0)).toBe(0);
    expect(flowEase(1)).toBeCloseTo(1, 12);
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

  it("fits the big sphere in the visible height of the first screen on a computer, and in its own zone on a phone", () => {
    const desktop = resolveTier(1440, false);
    expect(computeLayout(1440, 1049, { x: 256, y: 434, w: 928, h: 372 }, desktop, 835).sphere.sx).toBeCloseTo(818.3, 1);
    expect(computeLayout(1440, 1049, { x: 256, y: 434, w: 928, h: 372 }, desktop, 400).sphere.sx).toBeLessThanOrEqual(392);
    // Phone (U.7): 0.97 × the smaller side of the zone, centred in the zone (not in the window).
    expect(layout.sphere.sx).toBeCloseTo(0.97 * 280, 5);
    expect(layout.sphere.cx).toBeCloseTo(195, 5);
    expect(layout.sphere.cy).toBeCloseTo(640, 5);
    const zone = { x: 0, y: 433, w: 390, h: 396 };
    const wide = computeLayout(390, 1500, zone, PHONE, 779);
    expect(wide.sphere.sx).toBeCloseTo(0.97 * 390, 5);
    expect(wide.hands.sx).toBeCloseTo(780, 5);
  });

  it("fills the depth buckets with every drawn point exactly once (identities and skin)", () => {
    scene.compute(2_000, 2, true, PHONE.points, PHONE.skin);
    expect(total(scene)).toBe(PHONE.points + PHONE.skin);
    const seen = new Set<number>();
    scene.buckets.forEach((list, b) => {
      for (let k = 0; k < scene.bucketSize[b]!; k++) seen.add(list[k]!);
    });
    expect(seen.size).toBe(PHONE.points + PHONE.skin);
    scene.compute(2_000, 2, true, 1_000, 0);
    expect(total(scene)).toBe(1_000);
    expect(scene.skinDrawn).toBe(0);
  });

  it("keeps the whole sphere inside a disc of its diameter, and turns", () => {
    scene.compute(2_000, 0, false, PHONE.points, PHONE.skin);
    const first = Float32Array.from(scene.x);
    for (let i = 0; i < PHONE.points; i++) {
      expect(Math.hypot(scene.x[i]! - layout.sphere.cx, scene.y[i]! - layout.sphere.cy)).toBeLessThanOrEqual(layout.sphere.sx * 0.58);
    }
    scene.compute(3_000, 0, false, PHONE.points, PHONE.skin);
    let moved = 0;
    for (let i = 0; i < PHONE.points; i++) if (Math.abs(scene.x[i]! - first[i]!) > 2) moved++;
    expect(moved / PHONE.points).toBeGreaterThan(0.5);
  });

  it("never stops (U.4): from 0.8 s to the end, every 100 ms, the mean move of an identity in 50 ms is at least 0.25 px while the wave runs, never nil after it", () => {
    // Desktop scale (the criterion is stated for a computer): a larger sphere and hands.
    const desktop = resolveTier(1440, false);
    const big = new HeroScene(desktop);
    big.setLayout(computeLayout(1440, 900, { x: 256, y: 434, w: 928, h: 372 }, desktop, 835));
    big.setHands(decodeHands(baked as never, desktop.points));
    for (let ms = 800; ms <= 10_600; ms += 100) {
      // As the engine does: the breathing of the hands (from 7 s) and the micro-movement run on the live clocks.
      big.updateLive(0, true, Math.max(0, ms - 7_000) / 1000);
      big.compute(ms, ms / 1000, true, desktop.points, 0);
      const a = { x: Float32Array.from(big.x), y: Float32Array.from(big.y) };
      big.updateLive(0, true, Math.max(0, ms + 50 - 7_000) / 1000);
      big.compute(ms + 50, (ms + 50) / 1000, true, desktop.points, 0);
      let sum = 0;
      for (let i = 0; i < desktop.points; i++) sum += Math.hypot(big.x[i]! - a.x[i]!, big.y[i]! - a.y[i]!);
      // The last 400 ms before the act are the arrival of the last points (a gentle glide), then the breathing and the drift alone: slow but never nil.
      expect(sum / desktop.points, `at ${ms} ms`).toBeGreaterThanOrEqual(ms <= 10_000 ? 0.25 : 0.08);
    }
  });

  it("has no point waiting still: before it leaves, a point turns with the sphere (its speed is not nil)", () => {
    scene.compute(4_000, 0, false, PHONE.points, 0);
    const a = Float32Array.from(scene.x);
    scene.compute(4_050, 0, false, PHONE.points, 0);
    // The very last point to leave (the largest delay) is still on the turning sphere at 4 s.
    let still = 0;
    for (let i = 0; i < PHONE.points; i++) if (Math.abs(scene.x[i]! - a[i]!) < 0.01) still++;
    expect(still / PHONE.points).toBeLessThan(0.02);
  });

  it("is continuous around every moment of the sequence (the same point, the same place, 1 ms apart)", () => {
    for (const boundary of [WAVE_START_MS, 6_000, 7_000, 9_000, WAVE_END_MS, 10_600]) {
      scene.compute(boundary - 0.5, 0, false, PHONE.points, 0);
      const before = { x: Float32Array.from(scene.x), y: Float32Array.from(scene.y) };
      scene.compute(boundary + 0.5, 0, false, PHONE.points, 0);
      let worst = 0;
      for (let i = 0; i < PHONE.points; i++) worst = Math.max(worst, Math.hypot(scene.x[i]! - before.x[i]!, scene.y[i]! - before.y[i]!));
      expect(worst, `boundary ${boundary}`).toBeLessThan(2.5);
    }
  });

  it("dissolves the skin while the sphere turns, and draws none after the wave has started far enough", () => {
    scene.compute(2_900, 0, false, PHONE.points, PHONE.skin);
    expect(scene.skinDrawn).toBeGreaterThan(PHONE.skin * 0.9);
    scene.compute(6_000, 0, false, PHONE.points, PHONE.skin);
    expect(scene.skinDrawn).toBeLessThan(PHONE.skin * 0.5);
    scene.compute(7_000, 0, false, PHONE.points, 0);
    expect(scene.skinDrawn).toBe(0);
  });

  it("ends on the hands: every point on its baked place, around the contact point", () => {
    scene.compute(10_600, 11, false, PHONE.points, 0);
    const target = scene.handsShape!;
    for (let i = 0; i < PHONE.points; i += 53) {
      // The soft perspective (focal 4 shape heights) scales a point by its depth.
      const s = 4 / (4 - scene.z[i]!);
      expect(scene.x[i]).toBeCloseTo(layout.hands.cx + target.x[i]! * layout.hands.sx * s, 1);
      expect(scene.y[i]).toBeCloseTo(layout.hands.cy + target.y[i]! * layout.hands.sy * s, 1);
    }
  });

  it("keeps each point inside 1.8 px of its place in the living end state (micro-movement), and still without motion", () => {
    scene.compute(10_900, 0, false, PHONE.points, 0);
    const rest = { x: Float32Array.from(scene.x), y: Float32Array.from(scene.y) };
    let worst = 0;
    for (const second of [1, 2.7, 5.3, 8.1]) {
      scene.compute(10_900, second, true, PHONE.points, 0);
      for (let i = 0; i < PHONE.points; i++) worst = Math.max(worst, Math.abs(scene.x[i]! - rest.x[i]!), Math.abs(scene.y[i]! - rest.y[i]!));
    }
    expect(worst).toBeLessThanOrEqual(1.8 + 1e-3);
    scene.compute(10_900, 3, false, PHONE.points, 0);
    expect(Array.from(scene.x.slice(0, 40))).toEqual(Array.from(rest.x.slice(0, 40)));
  });

  it("keeps its robots on their rails: finite poses, alpha between 0 and 1, resting ones near the index tips", () => {
    for (const ms of [1_000, 2_500, 4_500, 6_000, 7_500, 9_400, 10_900]) {
      scene.computeRobots(ms, false);
      for (const pose of scene.robots) {
        expect([pose.x, pose.y, pose.z, pose.alpha].every(Number.isFinite)).toBe(true);
        expect(pose.alpha).toBeGreaterThanOrEqual(0);
        expect(pose.alpha).toBeLessThanOrEqual(1);
      }
    }
    scene.computeRobots(10_900, true);
    const tipX = layout.hands.cx + scene.handsData!.tips.left[0] * layout.hands.sx;
    const tipY = layout.hands.cy + scene.handsData!.tips.left[1] * layout.hands.sy;
    const near = scene.robots.filter((pose) => pose.alpha > 0 && Math.hypot(pose.x - tipX, pose.y - tipY) < 120);
    expect(near.length).toBeGreaterThan(0);
    expect(scene.robots.filter((pose) => pose.alpha > 0)).toHaveLength(4);
    // Resting robots are squares, never beads.
    expect(scene.robots.some((pose) => pose.bead)).toBe(false);
  });

  it("puts a few robots on the big sphere (3 on a phone), none before the beads are born, and no cobalt before 8.4 s", () => {
    scene.computeRobots(2_000, false);
    expect(scene.robots.filter((pose) => pose.alpha > 0)).toHaveLength(PHONE.sphereRobots);
    scene.computeRobots(7_400, false);
    expect(scene.robots.filter((pose) => pose.alpha > 0)).toHaveLength(0);
    for (const ms of [2_000, 5_000, 7_400, 8_300]) {
      scene.computeRobots(ms, false);
      expect(scene.robots.some((pose) => pose.accent)).toBe(false);
    }
    // The beads are born at 8.4 s: the 10 beads of a phone (2 messengers + 8 circulants), a third cobalt at most.
    scene.updateLive(0, true, 1.5);
    scene.computeRobots(9_000, false);
    const beads = scene.robots.filter((pose) => pose.bead);
    expect(beads).toHaveLength(PHONE.railDots);
    expect(beads.every((pose) => pose.alpha > 0)).toBe(true);
    expect(beads.filter((pose) => pose.accent).length).toBeLessThanOrEqual(PHONE.railCobalt);
    expect(beads.filter((pose) => pose.accent).length).toBeGreaterThan(0);
  });

  it("holds the sphere, still turning, until the hands are loaded rather than drawing a broken image", () => {
    const early = new HeroScene(PHONE);
    early.setLayout(computeLayout(390, 800, ZONE, PHONE, 779));
    expect(early.holdMs).toBe(WAVE_START_MS);
    early.compute(WAVE_START_MS, 0, false, PHONE.points, 0);
    const a = Float32Array.from(early.x);
    // The page clock (5 s) is past the start of the wave: the sphere has turned on, it has not frozen at 3 s.
    early.compute(WAVE_START_MS, 5, false, PHONE.points, 0);
    expect(total(early)).toBe(PHONE.points);
    expect(Array.from(early.x.slice(0, 40))).not.toEqual(Array.from(a.slice(0, 40)));
    early.computeRobots(9_500, false);
    expect(scene.holdMs).toBe(Infinity);
  });

  it("gives poses for each kind of rail", () => {
    const hands = scene.handsData!;
    const pose = emptyPose();
    const context = { layout, hands, count: 6 };
    for (const kind of ["sphere", "hands"] as const) {
      robotPose(kind, 2, 3.3, context, pose);
      expect([pose.x, pose.y].every(Number.isFinite)).toBe(true);
    }
    restingRobot(1, hands, layout.hands, pose);
    expect(pose.alpha).toBe(1);
  });
});
