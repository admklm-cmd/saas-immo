import { describe, expect, it } from "vitest";

import { decodeHands } from "./hands-data";
import baked from "./hands.baked.json";
import { handsRobotPose, roleOf } from "./hands-robots";
import { HeroScene } from "./HeroScene";
import { LIVE_CYCLE, MIN_TIP_GAP_PX, resolveTier } from "./hero-config";
import { computeLayout } from "./layout";
import { cycleAt } from "./live-motion";
import { emptyPose } from "./robots";
import { phaseAt } from "./timeline";

/**
 * The second animation of the hero (docs/design-system.md §2.11.4 ter S): the cycle, the move of the
 * index fingers, the robots. Pure maths on the real baked hands, no canvas.
 */

const ZONE = { x: 0, y: 500, w: 1440, h: 372 };

function sceneFor(width: number, height: number) {
  const tier = resolveTier(width, false);
  const scene = new HeroScene(tier);
  scene.setLayout(computeLayout(width, height, { ...ZONE, w: width }, tier));
  scene.setHands(decodeHands(baked as never, tier.points));
  return { scene, tier, hands: scene.handsData!, place: scene.currentLayout!.hands };
}

describe("the cycle of 7.2 s", () => {
  it("runs approach 2.6 s, contact 0.8 s, retreat 2.2 s, rest 1.6 s", () => {
    expect(LIVE_CYCLE.approach + LIVE_CYCLE.contact + LIVE_CYCLE.retreat + LIVE_CYCLE.rest).toBeCloseTo(LIVE_CYCLE.period, 6);
    const steps = [0, 1.3, 2.59, 2.6, 3.39, 3.4, 5.59, 5.6, 7.19].map((t) => cycleAt(t).step);
    expect(steps).toEqual(["approach", "approach", "approach", "contact", "contact", "retreat", "retreat", "rest", "rest"]);
  });

  it("closes from 0 to 1 and back to 0 with no jump at the ends (no jerk from one cycle to the next)", () => {
    expect(cycleAt(0).s).toBeCloseTo(0, 12);
    expect(cycleAt(2.6).s).toBe(1);
    expect(cycleAt(3.4).s).toBe(1);
    expect(cycleAt(5.6).s).toBeCloseTo(0, 9);
    expect(cycleAt(7.2 - 1e-9).s).toBe(0);
    let worst = 0;
    for (let t = 0; t < 7.2; t += 0.01) worst = Math.max(worst, Math.abs(cycleAt(t + 0.01).s - cycleAt(t).s));
    expect(worst, "no step larger than a 1.2 % of the closing per 10 ms").toBeLessThan(0.012);
  });
});

describe("the index fingers (S.3, S.4)", () => {
  for (const width of [1440, 1024, 390]) {
    it(`${width} px: the gap goes from its rest value to 1 % of the width of the hands, never under 3 px, never overlapping`, () => {
      const { scene } = sceneFor(width, 900);
      const rest = scene.updateLive(0, false);
      const g0 = rest.g0;
      expect(rest.gap).toBeCloseTo(g0, 6);
      let min = Infinity;
      let max = 0;
      for (let t = 0; t < LIVE_CYCLE.period * 2; t += 0.02) {
        const live = scene.updateLive(t, true);
        min = Math.min(min, live.gap);
        max = Math.max(max, live.gap);
        // The two tips always keep apart horizontally.
        expect(live.tip.rx - live.tip.lx).toBeGreaterThanOrEqual(MIN_TIP_GAP_PX - 1e-6);
      }
      const near = scene.live.g1;
      expect(near).toBeCloseTo(0.01 * scene.currentLayout!.hands.sx, 0);
      expect(min).toBeGreaterThanOrEqual(MIN_TIP_GAP_PX);
      expect(min).toBeGreaterThanOrEqual(near - 0.5 - 1e-6);
      expect(max).toBeLessThanOrEqual(g0 + 1e-6);
      // Each finger makes half of the closing: ~25 px at 1440, ~14 at 1024, ~8 at 390.
      expect((g0 - near) / 2).toBeGreaterThan(width === 1440 ? 20 : width === 1024 ? 10 : 5);
    });
  }

  it("moves a point by at most half of the closing + 4 px, the finger fully and the forearm hardly (no change of plane or of identity)", () => {
    const { scene } = sceneFor(1440, 900);
    const state = phaseAt(10_900);
    scene.updateLive(0, false);
    scene.compute(state, 10_900, 0, false, 14_000);
    const rest = { x: Float32Array.from(scene.x), y: Float32Array.from(scene.y) };
    const live = scene.updateLive(2.6, true);
    scene.compute(state, 10_900, 0, false, 14_000);
    const bound = (live.g0 - live.g1) / 2 + 4;
    let worst = 0;
    let finger = 0;
    let arm = 0;
    let fingers = 0;
    let arms = 0;
    for (let i = 0; i < 14_000; i++) {
      const d = Math.hypot(scene.x[i]! - rest.x[i]!, scene.y[i]! - rest.y[i]!);
      worst = Math.max(worst, d);
      // Near the left tip: the finger. Far on the left edge: the forearm.
      const nearTip = Math.hypot(rest.x[i]! - live.pivotX[0], rest.y[i]! - live.pivotY[0]) < 12;
      const far = rest.x[i]! < live.pivotX[0] - 560;
      if (nearTip) {
        finger += d;
        fingers++;
      }
      if (far) {
        arm += d;
        arms++;
      }
    }
    expect(worst).toBeLessThanOrEqual(bound);
    expect(fingers).toBeGreaterThan(20);
    expect(finger / fingers, "the tip follows (almost) the whole way").toBeGreaterThan(live.reach * 0.8);
    expect(arm / Math.max(1, arms), "the forearm hardly follows").toBeLessThan(live.reach * 0.2 + 3.5);
  });

  it("starts without a jump: the first frames of the act are the image of the opening", () => {
    const { scene } = sceneFor(1440, 900);
    const state = phaseAt(10_900);
    scene.updateLive(0, false);
    scene.compute(state, 10_900, 0, false, 14_000);
    const still = { x: Float32Array.from(scene.x), y: Float32Array.from(scene.y) };
    scene.updateLive(0, true);
    scene.compute(state, 10_900, 0, false, 14_000);
    let worst = 0;
    for (let i = 0; i < 14_000; i++) worst = Math.max(worst, Math.hypot(scene.x[i]! - still.x[i]!, scene.y[i]! - still.y[i]!));
    expect(worst).toBeLessThan(0.01);
    scene.updateLive(0.05, true);
    scene.compute(state, 10_900, 0, false, 14_000);
    worst = 0;
    for (let i = 0; i < 14_000; i++) worst = Math.max(worst, Math.hypot(scene.x[i]! - still.x[i]!, scene.y[i]! - still.y[i]!));
    expect(worst, "less than 0.2 px after 50 ms").toBeLessThan(0.2);
  });

  it("a still image (pause, reduced motion) shows the rest position: no move at all", () => {
    const { scene } = sceneFor(390, 844);
    const state = phaseAt(10_900);
    scene.updateLive(0, false);
    scene.compute(state, 10_900, 0, false, 3_600);
    const first = Array.from(scene.x.slice(0, 200));
    scene.updateLive(3.1, false);
    scene.compute(state, 10_900, 5, false, 3_600);
    expect(Array.from(scene.x.slice(0, 200))).toEqual(first);
    expect(scene.live.step).toBe("rest");
  });
});

describe("the robots of the hands (S.6)", () => {
  it("gives each tier its roles: 2 messengers, then the circulants, then the orbitals", () => {
    for (const [width, circulants, orbitals] of [[1440, 8, 4], [1024, 6, 4], [390, 4, 2]] as const) {
      const tier = resolveTier(width, false);
      const roles = Array.from({ length: tier.robots }, (_, i) => roleOf(i, tier).role);
      expect(roles.filter((role) => role === "messenger")).toHaveLength(2);
      expect(roles.filter((role) => role === "circulant")).toHaveLength(circulants);
      expect(roles.filter((role) => role === "orbital")).toHaveLength(orbitals);
      expect(roles.filter((role) => role === "none")).toHaveLength(0);
    }
  });

  it("the left messenger reaches the neighbourhood of its tip at the end of the approach and carries the cobalt port on the way", () => {
    const { scene, hands, place, tier } = sceneFor(1440, 900);
    const pose = emptyPose();
    const live = scene.updateLive(2.6, true);
    handsRobotPose(0, hands, place, live, tier, pose);
    expect(Math.hypot(pose.x - live.tip.lx, pose.y - live.tip.ly), "within 12 px behind the tip").toBeLessThan(16);
    expect(pose.alpha).toBe(1);
    expect(pose.accent).toBe(false);
    handsRobotPose(0, hands, place, scene.updateLive(1.3, true), tier, pose);
    expect(pose.accent).toBe(true);
    handsRobotPose(1, hands, place, scene.updateLive(1.3, true), tier, pose);
    expect(pose.accent, "only one cobalt port").toBe(false);
  });

  it("the messengers leave the wrist (the frame edge) at the start of the cycle and fade at 3.4 s, back at 6.9 s", () => {
    const { scene, hands, place, tier } = sceneFor(1440, 900);
    const pose = emptyPose();
    handsRobotPose(0, hands, place, scene.updateLive(0, true), tier, pose);
    expect(pose.x, "on the left edge of the frame").toBeLessThan(place.cx - place.sx * 0.45);
    for (const [t, alpha] of [[3.0, 1], [3.75, 0], [5, 0], [7.19, 1]] as const) {
      handsRobotPose(0, hands, place, scene.updateLive(t, true), tier, pose);
      expect(pose.alpha, `t = ${t}`).toBeCloseTo(alpha, 0);
    }
  });

  it("draws at least 12 robots at 1440 (8 at 1024, 6 at 390) at every moment of the act, and they really travel", () => {
    for (const [width, wanted] of [[1440, 12], [1024, 8], [390, 6]] as const) {
      const { scene, hands, place, tier } = sceneFor(width, 900);
      const pose = emptyPose();
      let fewest = Infinity;
      let enough = 0;
      let samples = 0;
      for (let t = 1; t < 40; t += 0.05) {
        const live = scene.updateLive(t, true);
        let drawn = 0;
        for (let i = 0; i < tier.robots; i++) if (handsRobotPose(i, hands, place, live, tier, pose).alpha > 0.01) drawn++;
        fewest = Math.min(fewest, drawn);
        samples++;
        if (drawn >= wanted) enough++;
      }
      // A circulant is invisible for a few milliseconds when it jumps from its tip back to its origin.
      expect(fewest, `${width}: fewest robots drawn`).toBeGreaterThanOrEqual(wanted - 1);
      expect(enough / samples, `${width}: share of the act with at least ${wanted} robots`).toBeGreaterThanOrEqual(0.95);
    }
    // Two instants 0.5 s apart: at least 6 robots moved by at least 20 px (1440).
    const { scene, hands, place, tier } = sceneFor(1440, 900);
    const a = emptyPose();
    const b = emptyPose();
    let best = 0;
    for (let t = 12; t < 30; t += 0.7) {
      let moved = 0;
      for (let i = 0; i < tier.robots; i++) {
        handsRobotPose(i, hands, place, scene.updateLive(t, true), tier, a);
        handsRobotPose(i, hands, place, scene.updateLive(t + 0.5, true), tier, b);
        if (a.alpha > 0.5 && b.alpha > 0.5 && Math.hypot(a.x - b.x, a.y - b.y) >= 20) moved++;
      }
      best = Math.max(best, moved);
    }
    expect(best).toBeGreaterThanOrEqual(6);
  });

  it("the orbitals tighten around the contact point while the fingers almost touch", () => {
    const { scene, hands, place, tier } = sceneFor(1440, 900);
    const pose = emptyPose();
    // At rest (cycle time 5.7 to 6.9 s) the orbit is wide; at the middle of the contact step it is 0.6 times as wide.
    const widest = (from: number, to: number) => {
      let value = 0;
      for (let t = from; t < to; t += 0.02) {
        const live = scene.updateLive(t, true);
        handsRobotPose(2 + tier.circulants, hands, place, live, tier, pose);
        value = Math.max(value, Math.hypot(pose.x - live.contactX, pose.y - live.contactY));
      }
      return value;
    };
    const base = 10 * 7.2;
    expect(widest(base + 5.7, base + 6.9)).toBeGreaterThan(widest(base + 2.8, base + 3.2) * 1.4);
    const live = scene.updateLive(base + 3.0, true);
    handsRobotPose(2 + tier.circulants, hands, place, live, tier, pose);
    expect(Math.hypot(pose.x - live.contactX, pose.y - live.contactY)).toBeLessThan(15);
  });
});
