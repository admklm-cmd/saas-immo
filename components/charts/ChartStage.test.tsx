// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useChartReady } from "./ChartReadyContext";
import { ChartStage } from "./ChartStage";

const createTimeline = vi.fn();
vi.mock("animejs", () => ({
  createTimeline: (...args: unknown[]) => createTimeline(...args),
  cubicBezier: () => "ease",
  utils: { set: vi.fn(), stagger: () => 0 },
}));

function Probe() {
  return <p data-testid="probe">{String(useChartReady())}</p>;
}

function setReducedMotion(reduce: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduce && query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  cleanup();
  createTimeline.mockReset();
  vi.unstubAllGlobals();
});

describe("ChartStage", () => {
  it("reduced motion: no Anime.js timeline, the chart is ready at once, nothing is hidden", () => {
    setReducedMotion(true);
    const { container } = render(
      <ChartStage>
        <Probe />
      </ChartStage>,
    );
    expect(createTimeline).not.toHaveBeenCalled();
    expect(screen.getByTestId("probe").textContent).toBe("true");
    expect((container.firstChild as HTMLElement).style.opacity).toBe("");
  });

  it("normal motion, card off screen: waits for the observer, chart not ready, no timeline yet", () => {
    setReducedMotion(false);
    const observe = vi.fn();
    class FakeObserver {
      observe = observe;
      disconnect = vi.fn();
    }
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    // A tall card below the fold (jsdom rects are 0, so the position is faked).
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ top: 5000, bottom: 5400, height: 400 } as DOMRect);
    render(
      <ChartStage>
        <Probe />
      </ChartStage>,
    );
    expect(observe).toHaveBeenCalledTimes(1);
    expect(createTimeline).not.toHaveBeenCalled();
    expect(screen.getByTestId("probe").textContent).toBe("false");
  });

  it("a chart outside any stage simply shows", () => {
    render(<Probe />);
    expect(screen.getByTestId("probe").textContent).toBe("true");
  });
});
