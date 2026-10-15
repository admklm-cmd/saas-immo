// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HeroMotionContext } from "./hero-motion-context";
import { HeroParticles } from "./HeroParticles";
import { HeroStage } from "./HeroStage";
import { requestReplay } from "../replay/replay-bus";

/** A 2D context that accepts every call: jsdom has no canvas. */
const context = new Proxy({} as Record<string, unknown>, {
  get: (target, key: string) => (key in target ? target[key] : () => {}),
  set: (target, key: string, value) => {
    target[key] = value;
    return true;
  },
});

let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;
let clock: number;

function mockMotion(reduced: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("reduce") ? reduced : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

/** Runs the queued animation frames, `step` ms apart, for `total` ms. */
function run(total: number, step = 16.7) {
  act(() => {
    for (let elapsed = 0; elapsed < total; elapsed += step) {
      clock += step;
      const queued = [...frames.entries()];
      frames.clear();
      for (const [, callback] of queued) callback(clock);
    }
  });
}

const canvas = () => screen.getByTestId("hero-particles") as HTMLCanvasElement;
/** Lets the dynamic import of the baked hands resolve. */
const settle = () => act(async () => {
  await new Promise((resolve) => setTimeout(resolve, 30));
});

beforeEach(() => {
  frames = new Map();
  nextFrame = 1;
  clock = 1000;
  HTMLCanvasElement.prototype.getContext = vi.fn(() => context) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
    const id = nextFrame++;
    frames.set(id, callback);
    return id;
  });
  window.cancelAnimationFrame = vi.fn((id: number) => {
    frames.delete(id);
  });
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("HeroParticles, server HTML", () => {
  it("is an inert, hidden canvas that starts at the big sphere and carries the test attributes", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToStaticMarkup(<HeroParticles />);
    const element = container.querySelector("canvas")!;
    expect(element.getAttribute("aria-hidden")).toBe("true");
    expect(element.getAttribute("data-testid")).toBe("hero-particles");
    expect(element.getAttribute("data-loop")).toBe("allowed");
    expect(element.getAttribute("data-phase")).toBe("sphere");
    expect(element.getAttribute("tabindex")).toBeNull();
  });

  it("gives the stage a poster for the no-JavaScript case, and the white stage under the content", () => {
    const html = renderToStaticMarkup(
      <HeroStage>
        <p>contenu</p>
      </HeroStage>,
    );
    expect(html).toContain("<noscript>");
    expect(html).toContain("/images/hero/hands-poster.webp");
    expect(html).toContain("contenu");
  });
});

describe("HeroParticles under reduced motion (§2.11.4 ter H)", () => {
  it("draws the final image at once, with no animation frame at all", async () => {
    mockMotion(true);
    render(<HeroParticles />);
    await settle();
    expect(canvas().getAttribute("data-state")).toBe("reduced");
    expect(canvas().getAttribute("data-phase")).toBe("hands");
    expect(Number(canvas().getAttribute("data-points"))).toBeGreaterThan(0);
    run(2_000);
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
    expect(canvas().getAttribute("data-phase")).toBe("hands");
  });
});

describe("HeroParticles with motion (§2.11.4 ter B, H)", () => {
  it("plays the phases in order, once, and stops its clock on the final image", async () => {
    mockMotion(false);
    render(<HeroParticles />);
    await settle();
    expect(canvas().getAttribute("data-state")).toBe("playing");
    const seen: string[] = [];
    for (let i = 0; i < 800; i++) {
      run(16.7);
      const phase = canvas().getAttribute("data-phase")!;
      if (seen.at(-1) !== phase) seen.push(phase);
    }
    // HELD_ENABLED is false (U.5(c)): no held-ball phases, one wave from the sphere to the hands.
    expect(seen).toEqual(["sphere", "to-hands", "hands"]);
    const end = Number(canvas().getAttribute("data-sequence-ms"));
    expect(end).toBeGreaterThanOrEqual(10_600);
    run(5_000);
    expect(Number(canvas().getAttribute("data-sequence-ms"))).toBe(end);
    expect(canvas().getAttribute("data-phase")).toBe("hands");
  });

  it("jumps to the still final image on the pause, and revives only the end state on resume", async () => {
    mockMotion(false);
    const view = render(
      <HeroMotionContext value={{ stopped: false, setStopped: () => {} }}>
        <HeroParticles />
      </HeroMotionContext>,
    );
    await settle();
    run(1_500);
    expect(canvas().getAttribute("data-phase")).toBe("sphere");
    view.rerender(
      <HeroMotionContext value={{ stopped: true, setStopped: () => {} }}>
        <HeroParticles />
      </HeroMotionContext>,
    );
    expect(canvas().getAttribute("data-state")).toBe("stopped");
    expect(canvas().getAttribute("data-phase")).toBe("hands");
    expect(frames.size).toBe(0);
    view.rerender(
      <HeroMotionContext value={{ stopped: false, setStopped: () => {} }}>
        <HeroParticles />
      </HeroMotionContext>,
    );
    expect(canvas().getAttribute("data-state")).toBe("playing");
    run(500);
    expect(canvas().getAttribute("data-phase")).toBe("hands");
  });

  it("stops asking for frames in a hidden tab and resumes at the same instant", async () => {
    mockMotion(false);
    render(<HeroParticles />);
    await settle();
    run(2_000);
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const at = canvas().getAttribute("data-sequence-ms");
    expect(canvas().getAttribute("data-state")).toBe("paused");
    expect(frames.size).toBe(0);
    run(10_000);
    expect(canvas().getAttribute("data-sequence-ms")).toBe(at);
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(canvas().getAttribute("data-state")).toBe("playing");
    run(100);
    expect(Number(canvas().getAttribute("data-sequence-ms"))).toBeGreaterThan(Number(at));
  });

  it("goes back to the big sphere on « Rejouer les animations »", async () => {
    mockMotion(false);
    document.body.innerHTML = "";
    render(<HeroParticles />, { container: document.body.appendChild(document.createElement("div")) });
    await settle();
    run(12_000);
    expect(canvas().getAttribute("data-phase")).toBe("hands");
    act(() => {
      requestReplay();
    });
    run(100);
    expect(canvas().getAttribute("data-phase")).toBe("sphere");
    expect(Number(canvas().getAttribute("data-sequence-ms"))).toBeLessThan(400);
  });

});
