// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { APP_TEXTS } from "@/components/texts";

import type { PipelineFunnel } from "../types";
import { PipelineFunnelCard } from "./PipelineFunnelCard";

vi.mock("./PipelineFunnelChart", () => ({ PipelineFunnelChart: () => <div data-testid="chart-island" /> }));
vi.mock("@/components/charts/ChartStage", () => ({
  ChartStage: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const TEXTS = APP_TEXTS.pipeline.funnel;
const STAGES = ["nouveau", "qualifie", "chaud", "rdv_planifie", "estimation_faite", "mandat_signe"] as const;

function funnel(values: number[], lost = { total: 14, untraced: 4 }): PipelineFunnel {
  return {
    scope: { key: "all_dossiers", at: "2026-10-11T12:00:00.000Z" },
    total: values[0]!,
    steps: values.map((value, i) => ({
      stage: STAGES[i]!,
      reached: value,
      current: 0,
      lostHere: 0,
      rateFromPrevious: i === 0 ? null : values[i - 1] ? value / values[i - 1]! : null,
      rateFromStart: values[0] ? value / values[0] : null,
    })),
    lost,
  };
}

afterEach(() => cleanup());

describe("PipelineFunnelCard", () => {
  it("shows the title, scope, finding, the lost dossiers apart and the table of values", () => {
    render(<PipelineFunnelCard funnel={funnel([84, 63, 36, 22, 12, 5])} />);
    expect(screen.getByRole("heading", { level: 2, name: TEXTS.title })).toBeDefined();
    expect(screen.getByText(TEXTS.scope)).toBeDefined();
    expect(screen.getByText(TEXTS.finding)).toBeDefined();
    const lost = screen.getByTestId("funnel-lost");
    expect(lost.textContent).toContain("Perdus : 14");
    expect(lost.textContent).toContain("Dont 4 sans historique");
    const rows = within(screen.getByTestId("funnel-values")).getAllByRole("row");
    expect(rows).toHaveLength(7);
    expect(within(rows[1]!).getAllByRole("cell").map((c) => c.textContent)).toEqual(["84", "75 %"]);
    expect(within(rows[6]!).getAllByRole("cell")[1]!.textContent).toBe("—");
  });

  it("empty (0 dossier): the empty sentence, no funnel", () => {
    render(<PipelineFunnelCard funnel={funnel([0, 0, 0, 0, 0, 0], { total: 0, untraced: 0 })} />);
    expect(screen.getByTestId("funnel-empty").textContent).toBe(TEXTS.empty);
    expect(screen.queryByTestId("chart-island")).toBeNull();
  });

  it("only one stage filled: the funnel is drawn, the following rates read a dash and the reason is written", () => {
    render(<PipelineFunnelCard funnel={funnel([5, 0, 0, 0, 0, 0], { total: 0, untraced: 0 })} />);
    expect(screen.getByTestId("chart-island")).toBeDefined();
    expect(screen.getByTestId("funnel-not-computable").textContent).toBe(TEXTS.notComputable);
  });

  it("failed calculation: Indisponible, no zeros", () => {
    render(<PipelineFunnelCard funnel={null} />);
    expect(screen.getByTestId("funnel-unavailable").textContent).toContain(TEXTS.unavailableTitle);
    expect(screen.queryByTestId("funnel-lost")).toBeNull();
    expect(screen.queryByTestId("chart-island")).toBeNull();
  });
});
