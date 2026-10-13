// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { APP_TEXTS } from "@/components/texts";

import { makePilotage } from "./pilotage-fixture";
import { PERIOD_ORDER } from "./pilotage-format";
import { buildPilotageView, unavailableView, type PilotageView } from "./pilotage-view";
import { PilotageDashboard } from "./PilotageDashboard";

// The chart islands (Bklit, Motion) have their own browser tests: here only the page logic.
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@/components/charts/ChartStage", () => ({ ChartStage: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

const TEXTS = APP_TEXTS.dashboard.pilotage;

function views(override: Partial<Record<(typeof PERIOD_ORDER)[number], PilotageView>> = {}) {
  return Object.fromEntries(PERIOD_ORDER.map((key) => [key, override[key] ?? buildPilotageView(makePilotage(key))])) as Record<
    (typeof PERIOD_ORDER)[number],
    PilotageView
  >;
}

function mount(props: Partial<React.ComponentProps<typeof PilotageDashboard>> = {}) {
  return render(
    <PilotageDashboard
      views={views()}
      initialPeriod="365d"
      reminder={<p>rappel</p>}
      noActionSample={null}
      killSwitch={{ status: "ok", paused: false }}
      humanWaiting={4}
      {...props}
    />,
  );
}

beforeEach(() => {
  // Reduced motion: no timeline, the page changes at once.
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: true, media: query, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("IntersectionObserver", undefined);
  window.history.replaceState(null, "", "/dashboard");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PilotageDashboard", () => {
  it("shows the giant count, its comparison and the written scope of the period", () => {
    mount();
    expect(screen.getByTestId("stage-giant").textContent).toContain("5");
    expect(screen.getByTestId("stage-comparison").textContent).toBe("+2 par rapport aux 12 mois précédents (3)");
    expect(screen.getByTestId("pilotage-scope").textContent).toContain("heure de Paris");
    expect(screen.getAllByText("Simulation").length).toBeGreaterThan(0);
  });

  it("changes period at once under reduced motion, writes it in the URL and announces it", () => {
    mount();
    fireEvent.click(screen.getByTestId("period-30d"));
    expect(window.location.search).toBe("?periode=30j");
    expect(screen.getByTestId("pilotage").getAttribute("data-period")).toBe("30d");
    expect(screen.getByTestId("period-30d").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByTestId("pilotage-announce").textContent).toContain("30 derniers jours");
  });

  it("the arrow keys of the selector change and confirm the period", () => {
    mount();
    const group = screen.getByRole("radiogroup", { name: TEXTS.periodGroupLabel });
    fireEvent.keyDown(group, { key: "ArrowLeft" });
    expect(screen.getByTestId("period-90d").getAttribute("aria-checked")).toBe("true");
    fireEvent.keyDown(group, { key: "Home" });
    expect(screen.getByTestId("period-7d").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByTestId("period-7d").getAttribute("tabindex")).toBe("0");
  });

  it("the back button restores the period of the URL", () => {
    mount();
    fireEvent.click(screen.getByTestId("period-7d"));
    window.history.replaceState(null, "", "/dashboard?periode=3m");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.getByTestId("pilotage").getAttribute("data-period")).toBe("90d");
  });

  it("a failed block reads « Indisponible », never 0, and the others stay", () => {
    const broken = buildPilotageView(makePilotage("365d", { mandates: { status: "unavailable" }, conversion: { status: "unavailable" } }));
    mount({ views: views({ "365d": broken }) });
    const stage = screen.getByTestId("pilotage-stage");
    expect(within(stage).getByTestId("stage-unavailable").textContent).toContain(TEXTS.unavailable);
    expect(within(screen.getByTestId("figure-conversion")).getByTestId("figure-unavailable")).toBeDefined();
    expect(screen.getByTestId("figure-delay").getAttribute("data-status")).toBe("ok");
  });

  it("no evolution is written when the previous period is not covered", () => {
    const data = makePilotage("365d");
    data.period.previousCoverage = "partial";
    mount({ views: views({ "365d": buildPilotageView(data) }) });
    expect(screen.getByTestId("stage-comparison").textContent).toBe("Période précédente : indisponible");
    expect(screen.getByTestId("stage-history-note").textContent).toContain("istorique disponible depuis le");
  });

  it("the Atelier: kill switch on stops the scene, blocked tokens are capped at two", () => {
    const { unmount } = mount();
    expect(screen.getByTestId("atelier-station-hugo").getAttribute("data-blocked-visible")).toBe("2");
    expect(screen.getByTestId("pilotage-atelier").getAttribute("data-mode")).toBe("live");
    expect(screen.queryByTestId("atelier-replay")).toBeNull(); // reduced motion: nothing to replay
    unmount();

    mount({ killSwitch: { status: "ok", paused: true } });
    expect(screen.getByTestId("pilotage-atelier").getAttribute("data-mode")).toBe("paused");
    expect(screen.getByTestId("atelier-paused-banner").textContent).toContain("Coupe-circuit actif");
  });

  it("the Atelier: unavailable counts show « Indisponible » and no token", () => {
    mount({ views: views({ "365d": unavailableView("365d") }) });
    expect(screen.getByTestId("pilotage-atelier").getAttribute("data-mode")).toBe("unavailable");
    expect(screen.getAllByTestId("atelier-unavailable").length).toBe(7);
    expect(screen.queryAllByTestId("atelier-blocked-token").length).toBe(0);
  });
});
