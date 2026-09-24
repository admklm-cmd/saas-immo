import { describe, expect, it } from "vitest";

import { buildFrame, displayedPresence, STATIC_TIME, TRANSITION_SECONDS } from "./model";
import { drawFrame } from "./renderer";
import { LIVING_SCENES, presenceOf, SCENES, type LivingScene } from "./scenes";
import type { Frame, SceneState, Viewport } from "./types";

const WIDE: Viewport = { width: 1440, height: 900, compact: false };
const COMPACT: Viewport = { width: 390, height: 844, compact: true };
const RAISED: readonly LivingScene[] = ["probleme", "agents"];

function still(scene: LivingScene): SceneState {
  return { scene, since: 0, previous: null, from: null };
}

/** A 2D context that records every drawing call and style assignment. */
function recorder() {
  const calls: string[] = [];
  const target: Record<string, unknown> = {
    measureText: (text: string) => ({ width: text.length * 6 }),
  };
  const context = new Proxy(target, {
    get(object, key: string) {
      if (key in object) return object[key];
      return (...args: unknown[]) => calls.push(`${key}(${JSON.stringify(args)})`);
    },
    set(_object, key: string, value: unknown) {
      calls.push(`${key}=${JSON.stringify(value)}`);
      return true;
    },
  });
  return { context: context as unknown as CanvasRenderingContext2D, calls };
}

function draw(frame: Frame): string[] {
  const { context, calls } = recorder();
  drawFrame(context, frame, { width: 1440, height: 900, dpr: 1, intensity: 0.72, compact: false });
  return calls;
}

describe("presence of the living background", () => {
  it("keeps exactly 1 for every scene other than the problem and agents scenes", () => {
    for (const scene of LIVING_SCENES) {
      if (RAISED.includes(scene)) continue;
      expect(SCENES[scene].presence).toBe(1);
      for (const viewport of [WIDE, COMPACT]) {
        expect(presenceOf(SCENES[scene], viewport.compact)).toBe(1);
        for (let time = 0; time < 30; time += 2.3) {
          expect(buildFrame({ time, state: still(scene), viewport }).presence).toBe(1);
        }
      }
    }
  });

  it("raises the problem and agents scenes by about a third, less on phones", () => {
    for (const scene of RAISED) {
      const wide = presenceOf(SCENES[scene], false);
      const compact = presenceOf(SCENES[scene], true);
      expect(wide).toBeGreaterThanOrEqual(1.3);
      expect(wide).toBeLessThanOrEqual(1.4);
      expect(compact).toBeGreaterThan(1);
      expect(compact).toBeLessThan(wide);
    }
  });

  it("blends continuously from one scene to the next (no jump)", () => {
    const pairs: [LivingScene, LivingScene][] = [
      ["hero", "probleme"],
      ["probleme", "solution"],
      ["solution", "agents"],
      ["agents", "controle"],
    ];
    for (const [previous, scene] of pairs) {
      for (const viewport of [WIDE, COMPACT]) {
        const since = 10;
        const state: SceneState = { scene, since, previous, from: null };
        const start = presenceOf(SCENES[previous], viewport.compact);
        const end = presenceOf(SCENES[scene], viewport.compact);
        expect(displayedPresence(state, viewport, since)).toBeCloseTo(start, 10);
        expect(displayedPresence(state, viewport, since + TRANSITION_SECONDS)).toBeCloseTo(end, 10);
        const step = 1 / 60;
        let last = displayedPresence(state, viewport, since);
        for (let time = since + step; time <= since + TRANSITION_SECONDS + 0.5; time += step) {
          const value = displayedPresence(state, viewport, time);
          // Largest possible step of a smoothstep over 1.6 s at 60 fps: 1.5 × Δ / 96.
          expect(Math.abs(value - last)).toBeLessThan(0.01);
          expect(value).toBeGreaterThanOrEqual(Math.min(start, end) - 1e-9);
          expect(value).toBeLessThanOrEqual(Math.max(start, end) + 1e-9);
          last = value;
        }
      }
    }
  });

  it("draws the reference frame when presence is 1, whatever the emphasis hints", () => {
    for (const scene of LIVING_SCENES.filter((name) => !RAISED.includes(name))) {
      const frame = buildFrame({ time: STATIC_TIME, state: still(scene), viewport: WIDE });
      const plain: Frame = {
        ...frame,
        nodes: frame.nodes.map((node) => ({ ...node, variance: 0 })),
        links: frame.links.map((link) => ({ ...link, strong: false })),
      };
      expect(draw(frame)).toEqual(draw(plain));
    }
  });

  it("draws the problem scene more present than the reference rendering", () => {
    const frame = buildFrame({ time: STATIC_TIME, state: still("probleme"), viewport: WIDE });
    const reference: Frame = { ...frame, presence: 1 };
    expect(draw(frame)).not.toEqual(draw(reference));
  });
});
