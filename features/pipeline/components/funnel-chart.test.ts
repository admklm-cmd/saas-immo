import { describe, expect, it } from "vitest";

import type { PipelineFunnel } from "../types";
import { buildSlices, formatRate, funnelAriaLabel, isEmptyFunnel } from "./funnel-chart";

const NN = "\u202F";
const reached = [84, 63, 36, 22, 12, 5];
const STAGES = ["nouveau", "qualifie", "chaud", "rdv_planifie", "estimation_faite", "mandat_signe"] as const;

function funnel(values: number[]): PipelineFunnel {
  return {
    scope: { key: "all_dossiers", at: "2026-10-11T12:00:00.000Z" },
    total: values[0] ?? 0,
    steps: values.map((value, i) => ({
      stage: STAGES[i]!,
      reached: value,
      current: 0,
      lostHere: 0,
      rateFromPrevious: i === 0 ? null : values[i - 1] ? value / values[i - 1]! : null,
      rateFromStart: values[0] ? value / values[0] : null,
    })),
    lost: { total: 14, untraced: 4 },
  };
}

describe("formatRate", () => {
  it("rounds to the nearest whole number, half up, with a thin no-break space before %", () => {
    expect(formatRate(0.75)).toBe(`75${NN}%`);
    expect(formatRate(63 / 84)).toBe(`75${NN}%`);
    expect(formatRate(0.625)).toBe(`63${NN}%`);
    expect(formatRate(0.624)).toBe(`62${NN}%`);
    expect(formatRate(0.005)).toBe(`1${NN}%`);
    expect(formatRate(0)).toBe(`0${NN}%`);
    expect(formatRate(1)).toBe(`100${NN}%`);
  });

  it("writes — when there is nothing to divide by", () => {
    expect(formatRate(null)).toBe("—");
    expect(formatRate(Number.NaN)).toBe("—");
  });
});

describe("buildSlices", () => {
  it("gives six slices in order, counts untouched, five rates, and the rate of each Math.round", () => {
    const slices = buildSlices(funnel(reached));
    expect(slices.map((s) => s.label)).toEqual(["Nouveau", "Qualifié", "Chaud", "RDV planifié", "Estimation faite", "Mandat signé"]);
    expect(slices.map((s) => s.reached)).toEqual(reached);
    expect(slices.map((s) => s.rate)).toEqual([null, "75 %", "57 %", "61 %", "55 %", "42 %"].map((r) => r?.replace(" ", NN) ?? null));
    expect(slices[1]!.rateName).toBe(`75${NN}% des dossiers « Nouveau » passent à « Qualifié »`);
  });

  it("keeps the raw numbers behind each rate for the tooltip", () => {
    const slices = buildSlices(funnel(reached));
    expect(slices[0]!.ratioToNext).toBe("63 sur 84 dossiers");
    expect(slices[5]!.ratioToNext).toBeNull();
    expect(slices[0]!.passToNext).toContain("passent à « Qualifié »");
  });

  it("reads — and names the case when the previous stage is empty (denominator 0)", () => {
    const slices = buildSlices(funnel([5, 0, 0, 0, 0, 0]));
    expect(slices[1]!.rate).toBe(`0${NN}%`);
    expect(slices[2]!.rate).toBe("—");
    expect(slices[2]!.rateName).toContain("non calculable");
    expect(slices[2]!.ratioToNext).toBeNull();
  });

  it("detects a funnel without any dossier and writes the whole summary", () => {
    expect(isEmptyFunnel(funnel([0, 0, 0, 0, 0, 0]))).toBe(true);
    const label = funnelAriaLabel(buildSlices(funnel(reached)));
    expect(label).toContain("Nouveau : 84 dossiers.");
    expect(label).toContain("Mandat signé : 5 dossiers.");
  });
});
