import { describe, expect, it } from "vitest";

import { poseFromProgress } from "./camera";
import { LivingEngine, type EngineEnvironment, type EngineStats, type MotionState, type Painter } from "./LivingEngine";
import type { PaintInput } from "./renderer";

/** Simulated clock: frames are only run when the test advances time. */
function createClock() {
  let time = 0;
  let nextId = 1;
  let pending: { id: number; callback: (timestamp: number) => void } | null = null;
  let requests = 0;
  const env: EngineEnvironment = {
    requestFrame: (callback) => {
      requests += 1;
      pending = { id: nextId++, callback };
      return pending.id;
    },
    cancelFrame: (id) => {
      if (pending?.id === id) pending = null;
    },
    now: () => time,
  };
  return {
    env,
    get time() {
      return time;
    },
    get requests() {
      return requests;
    },
    get pending() {
      return pending !== null;
    },
    /** Runs frames every `step` ms until `duration` has passed. */
    advance(duration: number, step = 16) {
      const end = time + duration;
      while (time < end) {
        time = Math.min(end, time + step);
        const frame = pending;
        if (frame) {
          pending = null;
          frame.callback(time);
        }
      }
    },
    /** Runs frames until the loop stops; returns the elapsed time. */
    runUntilIdle(step = 16, limit = 20_000) {
      const started = time;
      while (pending && time - started < limit) {
        time += step;
        const frame = pending;
        pending = null;
        frame.callback(time);
      }
      return time - started;
    },
  };
}

function createPainter() {
  const paints: PaintInput[] = [];
  const painter: Painter = {
    resize: () => {},
    setNetwork: () => {},
    paint: (input) => {
      paints.push({ ...input });
      return { repainted: true, strokes: 0, pulses: 0, lit: 0 };
    },
  };
  return { painter, paints };
}

function createEngine(reduced = false) {
  const clock = createClock();
  const { painter, paints } = createPainter();
  const states: MotionState[] = [];
  let stats: EngineStats | null = null;
  const engine = new LivingEngine({
    reduced,
    painter,
    env: clock.env,
    onMotion: (state) => states.push(state),
    onStats: (value) => {
      stats = value;
    },
  });
  engine.setScrollProgress(0);
  engine.resize(1440, 900, 1, "large");
  return { engine, clock, paints, states, stats: () => stats! };
}

describe("LivingEngine (simulated clock)", () => {
  it("draws once at rest, plays the arrival, then requests no frame at all once settled", () => {
    const { engine, clock, paints, stats } = createEngine();
    expect(paints).toHaveLength(1);
    expect(engine.motionState).toBe("idle");
    expect(clock.requests).toBe(0);

    expect(engine.startSequence("arrivee")).toBe(true);
    expect(engine.motionState).toBe("sequence");
    const elapsed = clock.runUntilIdle();
    expect(elapsed).toBeLessThanOrEqual(4800 + 16);
    expect(engine.motionState).toBe("settled");
    expect(stats().signals).toBe(0);
    expect(stats().lit).toBe(0);
    expect(stats().sequences).toEqual(["arrivee"]);
    // During the cascade, cores were lit at some point.
    expect(paints.some((input) => input.field && input.field.litCount(input.time) > 0)).toBe(true);
    // The camera drifted during the sequence and came back exactly: the last
    // picture is the network at rest, in the pose of the scroll.
    expect(paints.some((input) => input.yaw !== poseFromProgress(0).yaw)).toBe(true);
    expect(paints.at(-1)!.yaw).toBe(poseFromProgress(0).yaw);

    const requests = clock.requests;
    const frames = engine.frameCount;
    clock.advance(10_000);
    expect(clock.requests).toBe(requests);
    expect(engine.frameCount).toBe(frames);
    expect(engine.looping).toBe(false);
    // Played once: never again.
    expect(engine.startSequence("arrivee")).toBe(false);
  });

  it("requests no frame while the camera target is already reached", () => {
    const { engine, clock } = createEngine();
    engine.setScrollProgress(0);
    engine.setScrollProgress(0);
    expect(clock.requests).toBe(0);
    expect(engine.motionState).toBe("idle");
  });

  it("scroll → camera, then posed and still ≤ 1.2 s after the last change of target", () => {
    const { engine, clock } = createEngine();
    engine.startSequence("arrivee");
    clock.runUntilIdle();
    expect(engine.motionState).toBe("settled");

    // A scroll gesture: the target moves for 300 ms, then stops at the bottom of the page.
    for (let i = 1; i <= 18; i++) {
      engine.setScrollProgress(i / 18);
      expect(engine.motionState).toBe("camera");
      clock.advance(16);
    }
    const elapsed = clock.runUntilIdle();
    expect(elapsed).toBeLessThanOrEqual(1200);
    expect(engine.motionState).toBe("settled");
    const requests = clock.requests;
    clock.advance(3000);
    expect(clock.requests).toBe(requests);
  });

  it("hidden tab during a sequence: back to settled, 0 impulse, 0 lit core, nothing replayed", () => {
    const { engine, clock, stats } = createEngine();
    engine.startSequence("arrivee");
    clock.advance(1200);
    expect(engine.signalField!.litCount(clock.time)).toBeGreaterThan(0);

    engine.setHidden(true);
    expect(engine.motionState).toBe("hidden");
    expect(clock.pending).toBe(false);
    clock.advance(500);
    engine.setHidden(false);
    expect(engine.motionState).toBe("settled");
    expect(stats().signals).toBe(0);
    expect(stats().lit).toBe(0);
    expect(clock.pending).toBe(false);
    expect(engine.startSequence("arrivee")).toBe(false);
    // A section reached while hidden is recorded, never played later.
    engine.setHidden(true);
    expect(engine.enterScene("probleme")).toBe(false);
    engine.setHidden(false);
    expect(stats().sequences).toEqual(["arrivee", "probleme"]);
    expect(engine.enterScene("probleme")).toBe(false);
  });

  it("reduced motion: one drawing, no frame request, no event, even after a scroll", () => {
    const { engine, clock, paints } = createEngine(true);
    expect(paints).toHaveLength(1);
    expect(paints[0]!.field).toBeNull();
    expect(paints[0]!.yaw).toBe(0);
    expect(paints[0]!.pitch).toBeCloseTo(0.055, 9);
    expect(engine.motionState).toBe("reduced");

    engine.setScrollProgress(1);
    expect(engine.startSequence("arrivee")).toBe(false);
    expect(engine.enterScene("agents")).toBe(false);
    clock.advance(5000);
    expect(clock.requests).toBe(0);
    expect(paints).toHaveLength(1);
    expect(engine.signalField!.sequences).toHaveLength(0);
  });

  it("resize without a change of class: same geometry, no sequence replayed", () => {
    const { engine, clock, stats } = createEngine();
    const geometry = engine.geometry;
    engine.startSequence("arrivee");
    clock.runUntilIdle();
    engine.resize(1366, 820, 1, "large");
    expect(engine.geometry).toBe(geometry);
    expect(clock.pending).toBe(false);
    expect(stats().sequences).toEqual(["arrivee"]);
    expect(engine.motionState).toBe("settled");
    // Another class is another network, still without replay.
    engine.resize(390, 844, 3, "compact");
    expect(engine.geometry).not.toBe(geometry);
    expect(engine.currentNetwork!.nodeCount).toBe(20);
    expect(engine.startSequence("arrivee")).toBe(false);
  });

  it("the hero never plays a salvo; each section plays once", () => {
    const { engine, clock, stats } = createEngine();
    expect(engine.enterScene("hero")).toBe(false);
    expect(stats().sequences).toEqual([]);
    expect(engine.enterScene("solution")).toBe(true);
    clock.runUntilIdle();
    expect(engine.enterScene("solution")).toBe(false);
    expect(stats().sequences).toEqual(["solution"]);
  });
});
