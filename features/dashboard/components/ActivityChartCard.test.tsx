// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { APP_TEXTS } from "@/components/texts";

import type { DashboardDailySeries } from "../types";
import { ActivityChartCard } from "./ActivityChartCard";

// The chart and the stage are tested apart; here only what the server card writes.
vi.mock("./ActivityAreaChart", () => ({ ActivityAreaChart: () => <div data-testid="chart-island" /> }));
vi.mock("@/components/charts/ChartStage", () => ({
  ChartStage: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const TEXTS = APP_TEXTS.dashboard.activity;
const SCOPE = {
  key: "last_30_days",
  startsAt: "2026-09-12T00:00:00Z",
  endsAt: "2026-10-12T00:00:00Z",
  days: 30,
  timeZone: "Europe/Paris",
} as const;

function series(received: number[], qualified: number[]): DashboardDailySeries {
  return {
    status: "ok",
    scope: SCOPE,
    points: received.map((r, i) => ({
      date: `2026-10-${String(i + 1).padStart(2, "0")}`,
      received: r,
      qualified: qualified[i]!,
    })),
    totals: { received: received.reduce((a, b) => a + b, 0), qualified: qualified.reduce((a, b) => a + b, 0) },
  };
}

afterEach(() => cleanup());

describe("ActivityChartCard", () => {
  it("shows exact totals, scope, simulation badge, legend and the table of values", () => {
    render(<ActivityChartCard series={series([3, 0, 46], [1, 0, 32])} />);

    expect(screen.getByRole("heading", { level: 2, name: TEXTS.title })).toBeDefined();
    expect(screen.getByText(TEXTS.scope)).toBeDefined();
    expect(screen.getByText(APP_TEXTS.states.simulation)).toBeDefined();
    const totals = screen.getAllByTestId("activity-total").map((el) => el.textContent);
    expect(totals[0]).toContain("49");
    expect(totals[1]).toContain("33");
    expect(screen.getByTestId("chart-island")).toBeDefined();
    const table = within(screen.getByTestId("activity-values")).getByRole("table", { name: TEXTS.tableCaption });
    expect(within(table).getAllByRole("row")).toHaveLength(4);
    expect(screen.getByTestId("activity-legend").textContent).toContain(TEXTS.qualifiedSeries);
  });

  it("a day without activity is a real 0 in the table", () => {
    render(<ActivityChartCard series={series([2, 0], [1, 0])} />);
    const rows = within(screen.getByTestId("activity-values")).getAllByRole("row");
    expect(within(rows[2]!).getAllByRole("cell").map((c) => c.textContent)).toEqual(["0", "0"]);
  });

  it("empty window: one neutral line, no chart, no axis", () => {
    render(<ActivityChartCard series={series([0, 0], [0, 0])} />);
    expect(screen.getByTestId("activity-empty").textContent).toBe(TEXTS.empty);
    expect(screen.queryByTestId("chart-island")).toBeNull();
    expect(screen.queryByTestId("activity-values")).toBeNull();
  });

  it("failed calculation: Indisponible, never a zero, never a chart", () => {
    render(<ActivityChartCard series={null} />);
    const box = screen.getByTestId("activity-unavailable");
    expect(box.textContent).toContain(TEXTS.unavailableTitle);
    expect(box.textContent).toContain(TEXTS.unavailableBody);
    expect(screen.queryByTestId("chart-island")).toBeNull();
    expect(screen.queryByTestId("activity-total")).toBeNull();

    cleanup();
    render(<ActivityChartCard series={{ status: "unavailable", scope: SCOPE }} />);
    expect(screen.getByTestId("activity-unavailable")).toBeDefined();
  });
});
