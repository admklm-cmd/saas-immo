import { describe, expect, it } from "vitest";

import {
  bucketIndexOf,
  isInRange,
  PILOTAGE_PERIODS,
  pilotagePeriodSchema,
  previousCoverage,
  resolvePilotagePeriod,
} from "./pilotage-periods";

/** 2026-10-12 is a Monday; 12:30 in Paris (summer time, UTC+2). */
const MONDAY = new Date("2026-10-12T10:30:00Z");

const HOURS = 3_600_000;

describe("pilotagePeriodSchema", () => {
  it("accepts exactly the four periods", () => {
    for (const key of PILOTAGE_PERIODS) expect(pilotagePeriodSchema.safeParse(key).success).toBe(true);
  });

  it("refuses anything else, without coercing", () => {
    for (const bad of ["1y", "31d", "7", 7, "", " 7d", "7D", null, undefined, {}, ["7d"]]) {
      expect(pilotagePeriodSchema.safeParse(bad).success, String(bad)).toBe(false);
    }
  });
});

describe("resolvePilotagePeriod — 7 days and 30 days (daily buckets)", () => {
  it("covers the 7 Paris days ending today, the last one partial", () => {
    const period = resolvePilotagePeriod("7d", MONDAY);
    expect(period.granularity).toBe("day");
    expect(period.currentBuckets.map((bucket) => bucket.bucketStart)).toEqual([
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
      "2026-10-11",
      "2026-10-12",
    ]);
    // Midnight Paris (UTC+2) of Oct 6 is Oct 5 22:00 UTC.
    expect(period.current).toEqual({ startsAt: "2026-10-05T22:00:00.000Z", endsAt: MONDAY.toISOString() });
    expect(period.currentBuckets.map((bucket) => bucket.partial)).toEqual([false, false, false, false, false, false, true]);
    expect(period.currentBuckets[6]!.endsAt).toBe(MONDAY.toISOString());
  });

  it("shifts the previous period back by 7 days, its end included, and lines the buckets up", () => {
    const period = resolvePilotagePeriod("7d", MONDAY);
    expect(period.previous).toEqual({ startsAt: "2026-09-28T22:00:00.000Z", endsAt: "2026-10-05T10:30:00.000Z" });
    expect(period.previousBuckets.map((bucket) => bucket.bucketStart)).toEqual([
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
      "2026-10-05",
    ]);
    expect(period.previousBuckets).toHaveLength(period.currentBuckets.length);
    // The partial day is compared with the same stretch of the day before.
    expect(period.previousBuckets[6]!.endsAt).toBe("2026-10-05T10:30:00.000Z");
    expect(period.previousBuckets[6]!.partial).toBe(true);
  });

  it("has 30 daily buckets for 30 days", () => {
    const period = resolvePilotagePeriod("30d", MONDAY);
    expect(period.currentBuckets).toHaveLength(30);
    expect(period.currentBuckets[0]!.bucketStart).toBe("2026-09-13");
    expect(period.previousBuckets[0]!.bucketStart).toBe("2026-08-14");
    expect(period.previous.endsAt).toBe("2026-09-12T10:30:00.000Z");
  });

  it("keeps midnight-Paris boundaries across the October clock change (a 25-hour day)", () => {
    // Tuesday Oct 27: Paris is back on UTC+1 since Sunday Oct 25.
    const period = resolvePilotagePeriod("7d", new Date("2026-10-27T10:00:00Z"));
    const days = period.currentBuckets.map((bucket) => bucket.bucketStart);
    expect(days).toEqual(["2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27"]);
    const length = (index: number) =>
      (Date.parse(period.currentBuckets[index]!.endsAt) - Date.parse(period.currentBuckets[index]!.startsAt)) / HOURS;
    expect(length(3)).toBe(24); // Oct 24
    expect(length(4)).toBe(25); // Oct 25: clocks go back
    expect(length(5)).toBe(24); // Oct 26
    expect(period.currentBuckets[4]!.startsAt).toBe("2026-10-24T22:00:00.000Z");
    expect(period.currentBuckets[5]!.startsAt).toBe("2026-10-25T23:00:00.000Z");
  });

  it("keeps midnight-Paris boundaries across the March clock change (a 23-hour day)", () => {
    const period = resolvePilotagePeriod("7d", new Date("2026-03-31T10:00:00Z"));
    const index = period.currentBuckets.findIndex((bucket) => bucket.bucketStart === "2026-03-29");
    const hours = (Date.parse(period.currentBuckets[index]!.endsAt) - Date.parse(period.currentBuckets[index]!.startsAt)) / HOURS;
    expect(hours).toBe(23);
    expect(period.currentBuckets[index]!.startsAt).toBe("2026-03-28T23:00:00.000Z");
  });

  it("puts an instant 23:59 Paris in its own day and 00:00 in the next", () => {
    const period = resolvePilotagePeriod("7d", MONDAY);
    // 23:59 Paris on Oct 9 = 21:59 UTC; 00:00 Paris on Oct 10 = 22:00 UTC.
    expect(period.currentBuckets[bucketIndexOf(period.currentBuckets, "2026-10-09T21:59:59.999Z")]!.bucketStart).toBe("2026-10-09");
    expect(period.currentBuckets[bucketIndexOf(period.currentBuckets, "2026-10-09T22:00:00.000Z")]!.bucketStart).toBe("2026-10-10");
  });
});

describe("resolvePilotagePeriod — 3 months (13 weeks)", () => {
  it("has 13 Monday-to-Sunday weeks, the current one partial", () => {
    const period = resolvePilotagePeriod("90d", MONDAY);
    expect(period.granularity).toBe("week");
    expect(period.currentBuckets).toHaveLength(13);
    expect(period.currentBuckets[12]!.bucketStart).toBe("2026-10-12"); // this Monday
    expect(period.currentBuckets[0]!.bucketStart).toBe("2026-07-20");
    for (const bucket of period.currentBuckets) {
      expect(new Date(`${bucket.bucketStart}T12:00:00Z`).getUTCDay(), bucket.bucketStart).toBe(1);
    }
  });

  it("finds the Monday of a Sunday evening in the right week", () => {
    const sunday = new Date("2026-10-11T21:30:00Z"); // 23:30 Paris, Sunday
    const period = resolvePilotagePeriod("90d", sunday);
    expect(period.currentBuckets[12]!.bucketStart).toBe("2026-10-05");
    // And Monday 00:10 Paris (22:10 UTC Sunday) already belongs to the new week.
    const justAfter = resolvePilotagePeriod("90d", new Date("2026-10-11T22:10:00Z"));
    expect(justAfter.currentBuckets[12]!.bucketStart).toBe("2026-10-12");
  });

  it("shifts the previous period back by 13 weeks (91 days), Mondays preserved", () => {
    const period = resolvePilotagePeriod("90d", MONDAY);
    expect(period.previousBuckets).toHaveLength(13);
    expect(period.previousBuckets[0]!.bucketStart).toBe("2026-04-20");
    expect(period.previousBuckets[12]!.bucketStart).toBe("2026-07-13");
    expect(period.previous.endsAt).toBe("2026-07-13T10:30:00.000Z");
    for (const bucket of period.previousBuckets) {
      expect(new Date(`${bucket.bucketStart}T12:00:00Z`).getUTCDay(), bucket.bucketStart).toBe(1);
    }
  });
});

describe("resolvePilotagePeriod — 1 year (12 calendar months)", () => {
  it("has the 12 months ending with the current one, the current one partial", () => {
    const period = resolvePilotagePeriod("365d", MONDAY);
    expect(period.granularity).toBe("month");
    expect(period.currentBuckets.map((bucket) => bucket.bucketStart)).toEqual([
      "2025-11-01",
      "2025-12-01",
      "2026-01-01",
      "2026-02-01",
      "2026-03-01",
      "2026-04-01",
      "2026-05-01",
      "2026-06-01",
      "2026-07-01",
      "2026-08-01",
      "2026-09-01",
      "2026-10-01",
    ]);
    expect(period.currentBuckets[11]!.partial).toBe(true);
    // Nov 1, 2025 is on winter time: 00:00 Paris = 23:00 UTC the day before.
    expect(period.current.startsAt).toBe("2025-10-31T23:00:00.000Z");
  });

  it("shifts the previous period back by 12 months, its end included", () => {
    const period = resolvePilotagePeriod("365d", MONDAY);
    expect(period.previousBuckets[0]!.bucketStart).toBe("2024-11-01");
    expect(period.previousBuckets[11]!.bucketStart).toBe("2025-10-01");
    expect(period.previous.endsAt).toBe("2025-10-12T10:30:00.000Z");
    expect(period.previousBuckets[11]!.endsAt).toBe(period.previous.endsAt);
  });

  it("clamps the previous end on February 29 (leap year)", () => {
    const period = resolvePilotagePeriod("365d", new Date("2028-02-29T10:00:00Z"));
    expect(period.previous.endsAt).toBe("2027-02-28T10:00:00.000Z");
    const march = resolvePilotagePeriod("365d", new Date("2027-03-31T10:00:00Z"));
    expect(march.previousBuckets[11]!.bucketStart).toBe("2026-03-01");
  });

  it("crosses the new year without gap", () => {
    const period = resolvePilotagePeriod("365d", new Date("2026-01-15T12:00:00Z"));
    expect(period.currentBuckets[0]!.bucketStart).toBe("2025-02-01");
    expect(period.currentBuckets[11]!.bucketStart).toBe("2026-01-01");
  });
});

describe("every period, at many instants (including both clock changes and year ends)", () => {
  const INSTANTS = [
    "2026-01-01T00:30:00Z",
    "2026-03-28T23:30:00Z",
    "2026-03-29T00:30:00Z",
    "2026-03-29T01:30:00Z",
    "2026-03-30T08:00:00Z",
    "2026-05-31T22:30:00Z",
    "2026-06-30T21:59:00Z",
    "2026-10-24T22:30:00Z",
    "2026-10-25T00:30:00Z",
    "2026-10-25T23:30:00Z",
    "2026-12-31T23:30:00Z",
    "2027-01-01T10:00:00Z",
    "2028-02-29T23:30:00Z",
  ].map((value) => new Date(value));

  it.each(PILOTAGE_PERIODS)("%s: contiguous, ordered, same length, last bucket ends at the read", (key) => {
    for (const now of INSTANTS) {
      const period = resolvePilotagePeriod(key, now);
      expect(period.previousBuckets.length).toBe(period.currentBuckets.length);
      for (const buckets of [period.currentBuckets, period.previousBuckets]) {
        for (let index = 0; index < buckets.length - 1; index += 1) {
          expect(buckets[index]!.endsAt, `${key} ${now.toISOString()} #${index}`).toBe(buckets[index + 1]!.startsAt);
          expect(Date.parse(buckets[index]!.startsAt)).toBeLessThan(Date.parse(buckets[index]!.endsAt));
        }
        const last = buckets[buckets.length - 1]!;
        expect(Date.parse(last.startsAt)).toBeLessThan(Date.parse(last.endsAt));
      }
      expect(period.currentBuckets.at(-1)!.endsAt).toBe(now.toISOString());
      expect(period.current.startsAt).toBe(period.currentBuckets[0]!.startsAt);
      expect(period.previous.startsAt).toBe(period.previousBuckets[0]!.startsAt);
      // The previous period is entirely before the current one.
      expect(Date.parse(period.previous.endsAt)).toBeLessThanOrEqual(Date.parse(period.current.startsAt) + 25 * HOURS);
      expect(Date.parse(period.previous.endsAt)).toBeLessThan(Date.parse(period.current.endsAt));
    }
  });
});

describe("bucketIndexOf / isInRange", () => {
  const period = resolvePilotagePeriod("7d", MONDAY);

  it("treats a bucket start as inclusive and its end as exclusive", () => {
    expect(bucketIndexOf(period.currentBuckets, period.currentBuckets[3]!.startsAt)).toBe(3);
    expect(bucketIndexOf(period.currentBuckets, "2026-10-08T21:59:59.999Z")).toBe(2);
  });

  it("returns -1 outside the period, at the read instant and for an invalid date", () => {
    expect(bucketIndexOf(period.currentBuckets, "2026-10-05T21:59:59.999Z")).toBe(-1);
    expect(bucketIndexOf(period.currentBuckets, MONDAY.toISOString())).toBe(-1);
    expect(bucketIndexOf(period.currentBuckets, "pas une date")).toBe(-1);
    expect(bucketIndexOf([], "2026-10-08T10:00:00Z")).toBe(-1);
  });

  it("isInRange is [start, end)", () => {
    expect(isInRange(period.current, period.current.startsAt)).toBe(true);
    expect(isInRange(period.current, period.current.endsAt)).toBe(false);
    expect(isInRange(period.current, "n'importe quoi")).toBe(false);
  });
});

describe("previousCoverage", () => {
  const { previous } = resolvePilotagePeriod("365d", MONDAY);

  it("is full when the history starts before the previous period", () => {
    expect(previousCoverage("2024-01-01T00:00:00Z", previous)).toBe("full");
    expect(previousCoverage(previous.startsAt, previous)).toBe("full");
  });

  it("is partial when the history starts inside it, none after it", () => {
    expect(previousCoverage("2025-08-01T00:00:00Z", previous)).toBe("partial");
    expect(previousCoverage(previous.endsAt, previous)).toBe("none");
    expect(previousCoverage("2026-01-01T00:00:00Z", previous)).toBe("none");
  });

  it("is unknown when the first dossier could not be read", () => {
    expect(previousCoverage(null, previous)).toBe("unknown");
    expect(previousCoverage("date invalide", previous)).toBe("unknown");
  });
});
