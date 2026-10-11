import { describe, expect, it } from "vitest";

import type { DashboardDailyPoint } from "../types";
import {
  axisTickCount,
  chartAspectRatio,
  describeDay,
  integerGridTicks,
  isEmptySeries,
  maxOfSeries,
  parisDayToDate,
  toChartDays,
} from "./activity-chart";

const POINTS: DashboardDailyPoint[] = [
  { date: "2026-10-10", received: 0, qualified: 0 },
  { date: "2026-10-11", received: 3, qualified: 1 },
];

describe("activity-chart helpers", () => {
  it("keeps every count exactly and turns the Paris day into a stable Date", () => {
    const days = toChartDays(POINTS);
    expect(days.map((d) => [d.received, d.qualified])).toEqual([
      [0, 0],
      [3, 1],
    ]);
    expect(parisDayToDate("2026-10-11").toISOString()).toBe("2026-10-11T12:00:00.000Z");
  });

  it("detects an empty window, but not a window with one request", () => {
    expect(isEmptySeries([POINTS[0]!])).toBe(true);
    expect(isEmptySeries(POINTS)).toBe(false);
  });

  it("writes the live-region text with the day and both exact counts", () => {
    expect(describeDay(POINTS[1]!)).toBe("11 octobre : 3 demandes reçues, 1 dossier qualifié");
    expect(describeDay(POINTS[0]!)).toBe("10 octobre : 0 demande reçue, 0 dossier qualifié");
  });

  it("picks the axis density and aspect ratio by width", () => {
    expect([1440, 1024, 390].map(axisTickCount)).toEqual([7, 5, 4]);
    expect([1440, 1024, 390].map(chartAspectRatio)).toEqual(["4 / 1", "3 / 1", "16 / 10"]);
  });

  it("only ever proposes whole-number grid marks", () => {
    for (const max of [1, 2, 3, 5, 7, 13]) {
      const ticks = integerGridTicks(max);
      expect(ticks.every(Number.isInteger)).toBe(true);
      expect(ticks[0]).toBe(0);
      expect(ticks.at(-1)).toBe(max);
      expect(new Set(ticks).size).toBe(ticks.length);
    }
    expect(maxOfSeries(POINTS)).toBe(3);
  });
});
