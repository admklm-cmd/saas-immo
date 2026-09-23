// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RouteParticles } from "./RouteParticles";

/**
 * Reduced motion, end to end through the REAL engine (spec §6): one static,
 * representative frame per page, a route change applied at once (no animated
 * transition), and no continuous requestAnimationFrame loop.
 */

const navigation = vi.hoisted(() => ({ pathname: "/dashboard" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));

type FrameCallback = (now: number) => void;
let frames: Map<number, FrameCallback>;
let nextFrameId: number;
let drawn: number;

function flushFrames(now: number): number {
  const pending = [...frames.values()];
  frames.clear();
  for (const callback of pending) callback(now);
  return pending.length;
}

beforeEach(() => {
  frames = new Map();
  nextFrameId = 1;
  drawn = 0;
  navigation.pathname = "/dashboard";
  Object.defineProperty(window, "innerWidth", { value: 1_440, configurable: true });
  Object.defineProperty(window, "devicePixelRatio", { value: 1, configurable: true });
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { get: () => 1_440, configurable: true });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { get: () => 900, configurable: true });
  const context = {
    fillStyle: "",
    globalAlpha: 1,
    setTransform: () => {},
    clearRect: () => {
      drawn += 1;
    },
    beginPath: () => {},
    rect: () => {},
    fill: () => {},
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => context as unknown as CanvasRenderingContext2D,
  );
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
        matches: query.includes("reduce") || query.includes("min-width: 1024px"),
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(HTMLElement.prototype, "clientWidth");
  Reflect.deleteProperty(HTMLElement.prototype, "clientHeight");
});

describe("RouteParticles under prefers-reduced-motion", () => {
  it("draws one static frame per page and switches shape instantly, with no loop", () => {
    const { container, rerender } = render(<RouteParticles />);
    const canvas = container.querySelector("canvas")!;

    expect(flushFrames(16)).toBe(1);
    expect(drawn).toBe(1);
    expect(canvas.dataset.motion).toBe("reduced");
    expect(canvas.dataset.mode).toBe("background");
    expect(canvas.dataset.count).toBe("6000");
    expect(frames.size).toBe(0);

    navigation.pathname = "/pipeline";
    rerender(<RouteParticles />);
    // One frame for the new static image, never a transition, then nothing.
    expect(flushFrames(32)).toBe(1);
    expect(drawn).toBe(2);
    expect(canvas.dataset.motion).toBe("reduced");
    expect(frames.size).toBe(0);
    expect(flushFrames(48)).toBe(0);
  });
});
