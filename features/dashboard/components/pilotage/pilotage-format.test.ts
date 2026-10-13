import { describe, expect, it } from "vitest";

import {
  axisIndexes,
  compareCounts,
  compareDelays,
  compareRates,
  formatDelay,
  formatPercent,
  gridTicks,
  parsePeriodParam,
  runningTotal,
} from "./pilotage-format";

const PHRASE = "aux 12 mois précédents";

describe("parsePeriodParam", () => {
  it("reads the four values and falls back to « 1 an »", () => {
    expect(parsePeriodParam("7j")).toBe("7d");
    expect(parsePeriodParam("30j")).toBe("30d");
    expect(parsePeriodParam("3m")).toBe("90d");
    expect(parsePeriodParam("1a")).toBe("365d");
    expect(parsePeriodParam(undefined)).toBe("365d");
    expect(parsePeriodParam("1y")).toBe("365d");
    expect(parsePeriodParam(["30j", "7j"])).toBe("30d");
  });
});

describe("comparisons are written, never coloured", () => {
  it("up, down, same, previous at zero", () => {
    expect(compareCounts(38, 35, PHRASE, true)).toBe("+3 par rapport aux 12 mois précédents (35)");
    expect(compareCounts(38, 40, PHRASE, true)).toBe("−2 par rapport aux 12 mois précédents (40)");
    expect(compareCounts(38, 38, PHRASE, true)).toBe("Identique aux 12 mois précédents (38)");
    expect(compareCounts(5, 0, PHRASE, true)).toBe("+5 par rapport aux 12 mois précédents (0)");
  });

  it("never gives a delta when the previous period is not fully covered", () => {
    expect(compareCounts(38, 35, PHRASE, false)).toBe("Période précédente : indisponible");
    expect(compareRates(0.1, 0.2, PHRASE, false)).toBe("Période précédente : indisponible");
    expect(compareDelays(10, 20, PHRASE, false)).toBe("Période précédente : indisponible");
  });

  it("compares rates in whole points and delays in written time", () => {
    expect(compareRates(0.09, 0.1, PHRASE, true)).toContain("−1 point par rapport");
    expect(compareRates(0.2, 0.1, PHRASE, true)).toContain("+10 points par rapport");
    expect(compareRates(null, 0.1, PHRASE, true)).toBe("Période précédente : non mesurable");
    expect(compareDelays(200, 247, PHRASE, true)).toBe("−47 min par rapport aux 12 mois précédents (4 h 07)");
  });
});

describe("figures", () => {
  it("writes a delay with two units at most", () => {
    expect(formatDelay(47)).toBe("47 min");
    expect(formatDelay(200)).toBe("3 h 20");
    expect(formatDelay(180)).toBe("3 h");
    expect(formatDelay(28 * 60)).toBe("1 j 4 h");
    expect(formatDelay(null)).toBe("—");
  });

  it("never turns a missing rate into 0", () => {
    expect(formatPercent(null)).toBe("—");
    expect(formatPercent(0.08)).toBe("8 %");
    expect(formatPercent(0)).toBe("0 %");
  });

  it("running total, whole-number grid and axis indexes", () => {
    expect(runningTotal([1, 0, 4])).toEqual([1, 1, 5]);
    expect(gridTicks(22)).toEqual([0, 11, 22]);
    expect(gridTicks(1)).toEqual([0, 2, 4]);
    expect(axisIndexes(30, 4)).toEqual([0, 10, 19, 29]);
    expect(axisIndexes(3, 4)).toEqual([0, 1, 2]);
    expect(axisIndexes(12, 4).at(0)).toBe(0);
    expect(axisIndexes(12, 4).at(-1)).toBe(11);
  });
});
