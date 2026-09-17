// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { APP_TEXTS } from "@/components/texts";

import { AgentRunReplay } from "./AgentRunReplay";
import type { ReplayStep } from "./replay";

const TEXTS = APP_TEXTS.replay;

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Reflect.deleteProperty(window, "matchMedia");
});

function step(index: number, overrides: Partial<ReplayStep> = {}): ReplayStep {
  return {
    key: `step-${index}`,
    phase: "context_loaded",
    phaseLabel: "Dossier chargé",
    label: `Étape numéro ${index}`,
    status: "ok",
    statusLabel: "Terminé",
    detail: {},
    startedAt: "2026-09-17T08:00:00.000Z",
    finishedAt: "2026-09-17T08:00:00.100Z",
    durationMs: 100,
    ...overrides,
  };
}

/** Four steps: 100 + 200 + 300 + 50 = 650 ms measured, replayed ×10. */
const RUN: ReplayStep[] = [
  step(1, { phase: "guardrails", phaseLabel: "Garde-fous", durationMs: 100 }),
  step(2, { phase: "ai_call", phaseLabel: "Appel du fournisseur IA", durationMs: 200 }),
  step(3, { phase: "decision", phaseLabel: "Décision du code", durationMs: 300 }),
  step(4, { phase: "persisted", phaseLabel: "Écritures", durationMs: 50 }),
];

function visibleSteps(): HTMLElement[] {
  return screen.queryAllByTestId("replay-step");
}

function stubReducedMotion(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

describe("AgentRunReplay", () => {
  it("reveals the steps one by one, at the measured pace and nothing else", () => {
    vi.useFakeTimers();
    render(<AgentRunReplay steps={RUN} />);

    // The slowdown is announced, and the real measurement stays readable.
    expect(screen.getByText(TEXTS.speedFactor(10))).toBeDefined();
    expect(screen.getByText("650 ms")).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(visibleSteps()).toHaveLength(1);

    // 100 ms measured × 10 = the first step closes, the second opens.
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(visibleSteps()).toHaveLength(2);

    // Not a millisecond earlier: the second step lasted 200 ms (× 10).
    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(visibleSteps()).toHaveLength(2);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(visibleSteps()).toHaveLength(3);

    act(() => {
      vi.advanceTimersByTime(3500);
    });
    expect(visibleSteps()).toHaveLength(4);
    expect(screen.getByTestId("replay-restart")).toBeDefined();
  });

  it("separates what the code does from the single call to the AI provider", () => {
    vi.useFakeTimers();
    render(<AgentRunReplay steps={RUN} autoPlay={false} />);

    // One "Fournisseur IA" step, three "Code" steps: that is the argument.
    expect(screen.getAllByText(TEXTS.authorAi)).toHaveLength(1);
    expect(screen.getAllByText(TEXTS.authorCode)).toHaveLength(3);
    expect(screen.getByText(TEXTS.decisionMarker)).toBeDefined();
    expect(screen.getByText(TEXTS.authorLegend)).toBeDefined();
  });

  it("shows everything at once when asked, without waiting for the timers", () => {
    vi.useFakeTimers();
    render(<AgentRunReplay steps={RUN} />);

    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(visibleSteps()).toHaveLength(1);

    act(() => {
      fireEvent.click(screen.getByTestId("replay-show-all"));
    });
    expect(visibleSteps()).toHaveLength(4);
    expect(screen.queryByTestId("replay-show-all")).toBeNull();
  });

  it("honours prefers-reduced-motion: no animation, the whole list is there", () => {
    stubReducedMotion(true);
    vi.useFakeTimers();
    render(<AgentRunReplay steps={RUN} />);

    // No timer was needed at all.
    expect(visibleSteps()).toHaveLength(4);
    expect(vi.getTimerCount()).toBe(0);
    expect(screen.queryByTestId("replay-show-all")).toBeNull();
    expect(screen.queryByTestId("replay-restart")).toBeNull();
  });

  it("shows where and why a blocked run stopped", () => {
    const blocked = [
      step(1, {
        phase: "guardrails",
        phaseLabel: "Garde-fous",
        label: "Arrêt : le coupe-circuit de l'agence est actif.",
        status: "blocked",
        statusLabel: "Bloqué",
        detail: { reason: "ai_paused" },
        durationMs: 12,
      }),
    ];
    render(<AgentRunReplay steps={blocked} autoPlay={false} />);

    const rows = visibleSteps();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.getAttribute("data-status")).toBe("blocked");
    expect(screen.getByText("Arrêt : le coupe-circuit de l'agence est actif.")).toBeDefined();
    expect(screen.getByText("Bloqué")).toBeDefined();
    expect(screen.getByText(TEXTS.stopped)).toBeDefined();
    // Total and step duration are the same here: both show the measured value.
    expect(screen.getAllByText("12 ms")).toHaveLength(2);
  });

  it("shows a failed run as failed, with its machine detail available as text", () => {
    const failed = [
      step(1, { phase: "guardrails", phaseLabel: "Garde-fous", durationMs: 10 }),
      step(2, {
        phase: "ai_call",
        phaseLabel: "Appel du fournisseur IA",
        label: "Fournisseur IA indisponible : aucune action.",
        status: "failed",
        statusLabel: "Échec",
        detail: { error_code: "ai_provider_unavailable" },
        durationMs: 20,
      }),
    ];
    render(<AgentRunReplay steps={failed} autoPlay={false} />);

    expect(screen.getByText("Échec")).toBeDefined();
    expect(screen.getByText(TEXTS.stopped)).toBeDefined();
    expect(screen.getByText("ai_provider_unavailable")).toBeDefined();
  });

  it("says plainly when an execution recorded no step", () => {
    render(<AgentRunReplay steps={[]} />);
    expect(screen.getByText(TEXTS.empty)).toBeDefined();
  });
});
