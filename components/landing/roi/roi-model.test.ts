import { describe, expect, it } from "vitest";

import {
  ARRIVAL_DELAY_MS,
  ARRIVAL_END_MS,
  FOLLOWUP,
  MANDATES,
  MANDATES_DEFAULTS,
  SPEED,
  TIME,
  TIME_DEFAULTS,
  clampToSlider,
  computeMandates,
  computeTime,
  differsFromDefaults,
  fill,
  formatInteger,
  formatOneDecimal,
  roundTo,
} from "./roi-model";

/** Normalises the narrow no-break space of fr-FR grouping for readable assertions. */
const plain = (text: string) => text.replace(/[  ]/g, " ");

describe("ROI model (docs/design-system.md §2.11.8.8 L4-B, docs/recherche-roi-agences.md)", () => {
  it("keeps the published figures of the study", () => {
    expect(SPEED).toEqual({ odds: 21, hourOdds: 7 });
    expect(FOLLOWUP.share).toBe(93);
    expect(FOLLOWUP.contacts).toBe(6);
    expect(FOLLOWUP.channels).toEqual(["email", "messages", "phone", "email", "messages", "phone"]);
    expect(MANDATES.price).toBe(367000);
    expect(MANDATES.fee).toBe(0.04);
  });

  it("uses the defaults, bounds and steps of the spec", () => {
    expect(TIME.negotiators).toEqual({ min: 1, max: 15, step: 1, defaultValue: 4 });
    expect(TIME.hours).toEqual({ min: 2, max: 10, step: 1, defaultValue: 5 });
    expect([TIME.weeks, TIME.automatable, TIME.hourlyCost]).toEqual([45, 0.3, 40]);
    expect(MANDATES.requests).toEqual({ min: 10, max: 100, step: 5, defaultValue: 40 });
    expect(MANDATES.lateShare).toEqual({ min: 5, max: 30, step: 1, defaultValue: 15 });
    expect([MANDATES.toMandate, MANDATES.toSale]).toEqual([0.08, 0.6]);
  });

  it("W2 at the defaults: 900 h, ≈ 270 h, ≈ 10 800 €", () => {
    const result = computeTime(TIME_DEFAULTS);
    expect(result.yearlyHours).toBe(900);
    expect(result.recoverableHours).toBeCloseTo(270, 9);
    expect(result.recoverableHoursRounded).toBe(270);
    expect(result.value).toBeCloseTo(10800, 6);
    expect(result.valueRounded).toBe(10800);
  });

  it("W2 with 5 negotiators: 340 h and 13 500 € (keyboard step of L4-B4)", () => {
    const result = computeTime({ negotiators: 5, hours: 5 });
    expect(result.recoverableHoursRounded).toBe(340);
    expect(result.valueRounded).toBe(13500);
  });

  it("W2 at its maximum: 2 030 h and 81 000 €", () => {
    const result = computeTime({ negotiators: 15, hours: 10 });
    expect(result.recoverableHours).toBeCloseTo(2025, 6);
    expect(result.recoverableHoursRounded).toBe(2030);
    expect(result.valueRounded).toBe(81000);
  });

  it("W3 at the defaults: 480 → 72 → ≈ 5,8 → ≈ 3,5, ≈ 51 000 € HT", () => {
    const result = computeMandates(MANDATES_DEFAULTS);
    expect(result.yearlyRequests).toBe(480);
    expect(result.late).toBe(72);
    expect(result.mandates).toBeCloseTo(5.76, 9);
    expect(result.sales).toBeCloseTo(3.456, 9);
    expect(result.fees).toBeCloseTo(50734, 0);
    expect([result.lateRounded, result.mandatesRounded, result.salesRounded, result.feesRounded]).toEqual([72, 5.8, 3.5, 51000]);
  });

  it("W3 at its maximum: ≈ 254 000 € HT", () => {
    expect(computeMandates({ requests: 100, lateShare: 30 }).feesRounded).toBe(254000);
  });

  it("clamps to the bounds and to the step grid", () => {
    expect(clampToSlider(0, TIME.negotiators)).toBe(1);
    expect(clampToSlider(99, TIME.negotiators)).toBe(15);
    expect(clampToSlider(42, MANDATES.requests)).toBe(40);
    expect(clampToSlider(43, MANDATES.requests)).toBe(45);
    expect(clampToSlider(Number.NaN, MANDATES.lateShare)).toBe(15);
    expect(computeTime({ negotiators: 100, hours: 100 }).recoverableHoursRounded).toBe(2030);
  });

  it("rounds to the ten, the hundred, the thousand", () => {
    expect(roundTo(337.5, 10)).toBe(340);
    expect(roundTo(13_549, 100)).toBe(13_500);
    expect(roundTo(50_734, 1000)).toBe(51_000);
  });

  it("formats in fr-FR: narrow no-break space between thousands, decimal comma", () => {
    expect(formatInteger(10800)).toBe("10 800");
    expect(plain(formatInteger(51000))).toBe("51 000");
    expect(formatInteger(900)).toBe("900");
    expect(formatOneDecimal(5.76)).toBe("5,8");
    expect(formatOneDecimal(3.456)).toBe("3,5");
    expect(formatOneDecimal(4)).toBe("4,0");
  });

  it("fills the text templates", () => {
    expect(fill("≈ {value} h", { value: "270" })).toBe("≈ 270 h");
    expect(fill("{n} négociateurs", { n: 4 })).toBe("4 négociateurs");
    expect(fill("{missing}", {})).toBe("{missing}");
  });

  it("tells when a value differs from its defaults", () => {
    expect(differsFromDefaults(TIME_DEFAULTS, TIME_DEFAULTS)).toBe(false);
    expect(differsFromDefaults({ ...TIME_DEFAULTS, negotiators: 5 }, TIME_DEFAULTS)).toBe(true);
  });

  it("ends every arrival within 1.6 s of its start (≤ 1.84 s after the threshold)", () => {
    expect(ARRIVAL_END_MS).toEqual({ speed: 1220, time: 1300, mandates: 1600, followup: 1120 });
    for (const end of Object.values(ARRIVAL_END_MS)) expect(end + ARRIVAL_DELAY_MS).toBeLessThanOrEqual(1840);
  });
});
