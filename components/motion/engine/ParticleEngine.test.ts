// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ParticleEngine } from "./ParticleEngine";

type FrameCallback = (now: number) => void;

let frames: Map<number, FrameCallback>;
let nextFrameId: number;
let reducedMotion: boolean;
let resizeObservers: { disconnected: boolean }[];
let intersectionCallbacks: ((entries: IntersectionObserverEntry[]) => void)[];
let rects: number;
/** Points and highest opacity of the last drawn frame. */
let points: number[];
let maxAlpha: number;

function flushFrame(now: number): number {
  const pending = [...frames.entries()];
  frames.clear();
  for (const [, callback] of pending) callback(now);
  return pending.length;
}

function createCanvas(width = 460, height = 205): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  Object.defineProperty(canvas, "clientWidth", { value: width });
  Object.defineProperty(canvas, "clientHeight", { value: height });
  const context = {
    fillStyle: "",
    globalAlpha: 1,
    setTransform: vi.fn(),
    clearRect: () => {
      points = [];
      maxAlpha = 0;
    },
    beginPath: vi.fn(),
    rect(x: number, y: number) {
      rects++;
      points.push(x, y);
      maxAlpha = Math.max(maxAlpha, this.globalAlpha);
    },
    fill: vi.fn(),
  };
  canvas.getContext = (() => context) as unknown as HTMLCanvasElement["getContext"];
  return canvas;
}

beforeEach(() => {
  frames = new Map();
  nextFrameId = 1;
  reducedMotion = false;
  resizeObservers = [];
  intersectionCallbacks = [];
  rects = 0;
  points = [];
  maxAlpha = 0;
  Object.defineProperty(window, "innerWidth", { value: 1_440, configurable: true });
  Object.defineProperty(window, "devicePixelRatio", { value: 1, configurable: true });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameCallback) => {
    const id = nextFrameId++;
    frames.set(id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: query.includes("reduce") ? reducedMotion : false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }) as unknown as MediaQueryList,
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      state = { disconnected: false };
      constructor() {
        resizeObservers.push(this.state);
      }
      observe() {}
      disconnect() {
        this.state.disconnected = true;
      }
    },
  );
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: (entries: IntersectionObserverEntry[]) => void) {
        intersectionCallbacks.push(callback);
      }
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ParticleEngine", () => {
  it("draws a single static frame and runs no loop under reduced motion", () => {
    reducedMotion = true;
    const canvas = createCanvas();
    const engine = new ParticleEngine(canvas, { preset: "agents" });
    expect(flushFrame(16)).toBe(1);
    expect(rects).toBeGreaterThan(2_000);
    expect(canvas.dataset.motion).toBe("reduced");
    expect(frames.size).toBe(0);

    // A preset change is applied at once, still without a loop.
    engine.transitionTo("vortex");
    expect(flushFrame(32)).toBe(1);
    expect(frames.size).toBe(0);
    engine.destroy();
  });

  it("keeps exactly one loop running, and stops it in a hidden tab", () => {
    const canvas = createCanvas();
    const engine = new ParticleEngine(canvas, { preset: "sphere" });
    for (let now = 16; now < 200; now += 16) expect(flushFrame(now)).toBe(1);
    expect(canvas.dataset.motion).toBe("running");

    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(frames.size).toBe(0);
    expect(canvas.dataset.motion).toBe("hidden");
    Object.defineProperty(document, "hidden", { value: false, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(frames.size).toBe(1);
    engine.destroy();
  });

  it("pauses off-screen", () => {
    const engine = new ParticleEngine(createCanvas(), { preset: "veil" });
    flushFrame(16);
    intersectionCallbacks[0]?.([{ isIntersecting: false } as IntersectionObserverEntry]);
    expect(frames.size).toBe(0);
    intersectionCallbacks[0]?.([{ isIntersecting: true } as IntersectionObserverEntry]);
    expect(frames.size).toBe(1);
    engine.destroy();
  });

  it("does not double the loop when mounted, destroyed and mounted again (Strict Mode)", () => {
    const canvas = createCanvas();
    const first = new ParticleEngine(canvas, { preset: "grid" });
    first.destroy();
    expect(resizeObservers[0]?.disconnected).toBe(true);
    const second = new ParticleEngine(canvas, { preset: "grid" });
    for (let now = 16; now < 100; now += 16) expect(flushFrame(now)).toBe(1);
    second.destroy();
    expect(frames.size).toBe(0);
  });

  it("advances time with the elapsed time, whatever the frame rate", () => {
    const slow = new ParticleEngine(createCanvas(), { preset: "current" });
    for (let now = 1_000; now <= 2_000; now += 1_000 / 30) flushFrame(now);
    const slowTime = slow.time;
    slow.destroy();
    const fast = new ParticleEngine(createCanvas(), { preset: "current" });
    for (let now = 1_000; now <= 2_000; now += 1_000 / 120) flushFrame(now);
    expect(slowTime).toBeCloseTo(1, 1);
    expect(fast.time).toBeCloseTo(slowTime, 1);
    fast.destroy();
  });

  it("stops looping when paused or frozen, but still finishes a transition", () => {
    const canvas = createCanvas();
    const engine = new ParticleEngine(canvas, { preset: "sphere", paused: true });
    flushFrame(16);
    expect(frames.size).toBe(0);
    expect(canvas.dataset.motion).toBe("static");

    const now = performance.now();
    engine.transitionTo("agents");
    flushFrame(now + 16);
    expect(canvas.dataset.motion).toBe("transition");
    flushFrame(now + 400);
    flushFrame(now + 2_000);
    expect(frames.size).toBe(0);
    expect(canvas.dataset.motion).toBe("static");

    engine.setPaused(false);
    engine.setFrozenTime(9);
    flushFrame(now + 2_016);
    expect(frames.size).toBe(0);
    expect(engine.time).toBe(9);
    engine.destroy();
  });
});

/** Centre and extent of the last drawn frame (independent of the drawing order). */
function frameSummary() {
  let sumX = 0;
  let sumY = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  const n = points.length / 2;
  for (let k = 0; k < points.length; k += 2) {
    const x = points[k] ?? 0;
    const y = points[k + 1] ?? 0;
    sumX += x;
    sumY += y;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
  }
  return { n, cx: sumX / n, cy: sumY / n, width: maxX - minX };
}

describe("ParticleEngine — transitions", () => {
  it("redirects an interrupted transition from the displayed positions, without a jump", () => {
    const canvas = createCanvas(900, 400);
    const engine = new ParticleEngine(canvas, { preset: "sphere" });
    let now = 1_000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    for (; now < 1_200; now += 16) flushFrame(now);
    engine.transitionTo("current");
    for (; now < 1_600; now += 16) flushFrame(now);
    const before = frameSummary();

    engine.transitionTo("grid");
    now += 16;
    flushFrame(now);
    const after = frameSummary();
    expect(after.n).toBe(before.n);
    // One frame later the picture has barely moved: it starts from what was on screen.
    expect(Math.abs(after.cx - before.cx)).toBeLessThan(6);
    expect(Math.abs(after.cy - before.cy)).toBeLessThan(6);
    expect(Math.abs(after.width - before.width)).toBeLessThan(20);
    expect(canvas.dataset.motion).toBe("transition");

    // It ends on the latest destination, the grid, which spans the whole zone.
    for (let end = now + 1_100; now < end; now += 16) flushFrame(now);
    expect(canvas.dataset.motion).toBe("running");
    expect(frameSummary().width).toBeGreaterThan(900 * 0.9);
    engine.destroy();
  });
});

describe("ParticleEngine — background mode (spec §9)", () => {
  it.each([
    [1_440, 6_000],
    [1_024, 4_000],
    [390, 1_800],
  ])("uses the budget of a %i px viewport (%i particles)", (viewport, budget) => {
    Object.defineProperty(window, "innerWidth", { value: viewport, configurable: true });
    const canvas = createCanvas(viewport, 800);
    const engine = new ParticleEngine(canvas, { preset: "veil", mode: "background" });
    flushFrame(16);
    expect(engine.particleCount).toBe(budget);
    expect(canvas.dataset.mode).toBe("background");
    engine.destroy();
  });

  it("caps the pixel ratio at 1.5 on mobile and 2 on desktop", () => {
    Object.defineProperty(window, "devicePixelRatio", { value: 3, configurable: true });
    Object.defineProperty(window, "innerWidth", { value: 390, configurable: true });
    const mobile = createCanvas(390, 844);
    new ParticleEngine(mobile, { preset: "veil", mode: "background" }).destroy();
    expect(mobile.width).toBe(Math.round(390 * 1.5));
    Object.defineProperty(window, "innerWidth", { value: 1_440, configurable: true });
    const desktop = createCanvas(1_440, 900);
    new ParticleEngine(desktop, { preset: "veil", mode: "background" }).destroy();
    expect(desktop.width).toBe(1_440 * 2);
  });

  it("never draws above the .35 opacity ceiling", () => {
    const engine = new ParticleEngine(createCanvas(1_440, 900), { preset: "sphere", mode: "background", intensity: 3 });
    flushFrame(16);
    expect(maxAlpha).toBeGreaterThan(0.25);
    expect(maxAlpha).toBeLessThanOrEqual(0.35);
    engine.destroy();
  });

  it("lowers the density by 25 % when frames average more than 8 ms over 2 s, with a single loop", () => {
    const canvas = createCanvas(1_440, 900);
    let now = 0;
    let calls = 0;
    // Each frame measures its own cost with two readings: 10 ms apart.
    vi.spyOn(performance, "now").mockImplementation(() => now + (calls++ % 2) * 10);
    const engine = new ParticleEngine(canvas, { preset: "veil", mode: "background" });
    calls = 0;
    for (now = 16; now <= 2_100; now += 16) {
      expect(flushFrame(now)).toBe(1);
      expect(frames.size).toBe(1);
    }
    expect(engine.averageFrameMs).toBeCloseTo(10, 5);
    expect(engine.particleCount).toBe(4_500);
    expect(canvas.dataset.count).toBe("4500");

    // Removed particles fade out in place (still drawn, fainter), then disappear.
    rects = 0;
    flushFrame(now);
    expect(rects).toBeGreaterThan(4_500);
    for (const end = now + 700; now < end; now += 16) flushFrame(now);
    rects = 0;
    flushFrame(now);
    expect(rects).toBeLessThanOrEqual(4_500);
    engine.destroy();
  });

  it("keeps the full density while frames stay cheap", () => {
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const background = new ParticleEngine(createCanvas(1_440, 900), { preset: "veil", mode: "background" });
    for (now = 16; now <= 2_100; now += 16) flushFrame(now);
    expect(background.particleCount).toBe(6_000);
    background.destroy();
  });

  it("draws one static frame of the full budget under reduced motion, with no loop", () => {
    reducedMotion = true;
    const engine = new ParticleEngine(createCanvas(1_440, 900), { preset: "vortex", mode: "background" });
    expect(flushFrame(16)).toBe(1);
    expect(engine.particleCount).toBe(6_000);
    expect(frames.size).toBe(0);
    engine.destroy();
  });
});
