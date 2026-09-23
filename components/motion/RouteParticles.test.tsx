// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BACKGROUND_LAYOUT } from "./background-layout";
import { RouteParticles } from "./RouteParticles";
import type { ParticleEngineOptions } from "./engine/ParticleEngine";
import type { Region } from "./engine/layout";
import type { ParticlePreset } from "./shapes";

/**
 * Integration of the full-page background in the app shell: one engine for the
 * whole session, driven by the pathname. The engine itself (loop, reduced
 * motion, transitions) is covered by engine/ParticleEngine.test.ts; here it is
 * replaced by a recorder to observe what the component asks of it.
 */

const navigation = vi.hoisted(() => ({ pathname: "/dashboard" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));

type FakeEngine = {
  canvas: HTMLCanvasElement;
  options: ParticleEngineOptions;
  transitions: ParticlePreset[];
  regions: Region[];
  intensities: number[];
  destroyed: boolean;
};

const engines = vi.hoisted(() => [] as FakeEngine[]);
vi.mock("./engine/ParticleEngine", () => ({
  ParticleEngine: class {
    private readonly record: FakeEngine;
    constructor(canvas: HTMLCanvasElement, options: ParticleEngineOptions) {
      this.record = { canvas, options, transitions: [], regions: [], intensities: [], destroyed: false };
      engines.push(this.record);
    }
    transitionTo(preset: ParticlePreset) {
      this.record.transitions.push(preset);
    }
    setRegion(region: Region) {
      this.record.regions.push(region);
    }
    setIntensity(intensity: number) {
      this.record.intensities.push(intensity);
    }
    setDensity() {}
    setPaused() {}
    setFrozenTime() {}
    destroy() {
      this.record.destroyed = true;
    }
  },
}));

let mobile = false;
let desktop = true;

beforeEach(() => {
  engines.length = 0;
  navigation.pathname = "/dashboard";
  mobile = false;
  desktop = true;
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: query.includes("min-width: 1024px") ? desktop : query.includes("max-width: 767px") ? mobile : false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }) as unknown as MediaQueryList,
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function live(): FakeEngine[] {
  return engines.filter((engine) => !engine.destroyed);
}

describe("RouteParticles", () => {
  it("renders one decorative background canvas, hidden from assistive technology", () => {
    const { container } = render(<RouteParticles />);
    const canvases = container.querySelectorAll("canvas");
    expect(canvases).toHaveLength(1);
    const canvas = canvases[0]!;
    expect(canvas.getAttribute("aria-hidden")).toBe("true");
    expect(canvas.className).toContain("app-particles");
    // No text, no label: it never pretends that an agent is working.
    expect(canvas.textContent).toBe("");
    expect(canvas.getAttribute("aria-label")).toBeNull();
    expect(live()).toHaveLength(1);
    expect(live()[0]!.options).toMatchObject({ preset: "veil", mode: "background" });
  });

  it("keeps a single engine under Strict Mode (the first one is destroyed before the second starts)", () => {
    render(
      <StrictMode>
        <RouteParticles />
      </StrictMode>,
    );
    expect(live()).toHaveLength(1);
    expect(engines.every((engine, index) => index === engines.length - 1 || engine.destroyed)).toBe(true);
  });

  it("morphs on a change of route, without remounting the canvas or the engine", () => {
    const { container, rerender } = render(<RouteParticles />);
    const canvas = container.querySelector("canvas");
    const engine = live()[0]!;
    const created = engines.length;

    for (const [path, preset] of [
      ["/pipeline", "current"],
      ["/agents-ia", "agents"],
      ["/agents-ia/a-valider", "vortex"],
      ["/parametres", "grid"],
      ["/contacts", "sphere"],
    ] as const) {
      navigation.pathname = path;
      rerender(<RouteParticles />);
      expect(engine.transitions.at(-1)).toBe(preset);
    }

    expect(engines).toHaveLength(created);
    expect(live()).toEqual([engine]);
    expect(container.querySelector("canvas")).toBe(canvas);
    expect(canvas?.dataset.preset).toBe("sphere");
  });

  it("asks nothing new when the route keeps the same shape (list to record)", () => {
    navigation.pathname = "/contacts";
    const { rerender } = render(<RouteParticles />);
    const engine = live()[0]!;
    const before = engine.transitions.length;
    navigation.pathname = "/contacts/3f0c";
    rerender(<RouteParticles />);
    // The effect only runs when the preset changes: no call at all.
    expect(engine.transitions.length).toBe(before);
  });

  it("places the shape per viewport class and follows a change of breakpoint", () => {
    const listeners: (() => void)[] = [];
    vi.stubGlobal(
      "matchMedia",
      (query: string) =>
        ({
          get matches() {
            return query.includes("min-width: 1024px") ? desktop : query.includes("max-width: 767px") ? mobile : false;
          },
          addEventListener: (_: string, listener: () => void) => listeners.push(listener),
          removeEventListener: vi.fn(),
        }) as unknown as MediaQueryList,
    );
    render(<RouteParticles />);
    const engine = live()[0]!;
    expect(engine.options.region).toEqual(BACKGROUND_LAYOUT.desktop.region);

    desktop = false;
    mobile = true;
    act(() => listeners.forEach((listener) => listener()));
    expect(engine.regions.at(-1)).toEqual(BACKGROUND_LAYOUT.mobile.region);
    expect(engine.intensities.at(-1)).toBe(BACKGROUND_LAYOUT.mobile.intensity);
    expect(live()).toEqual([engine]);
  });

  it("destroys the engine when the signed-in space is left", () => {
    const { unmount } = render(<RouteParticles />);
    expect(live()).toHaveLength(1);
    unmount();
    expect(live()).toHaveLength(0);
  });
});
