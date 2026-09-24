import { describe, expect, it } from "vitest";

import { LANDING_TEXTS } from "@/components/landing-texts";

import {
  absorbedAt,
  CAUSE_EVENTS,
  causeDelayMs,
  causeOfEvent,
  curveY,
  eventDelayMs,
  eventPoint,
  expectedY,
  FRICTION_START,
  isEarlyEvent,
  LABEL_LANE_Y,
  mandates,
  PROBLEM_CAUSES,
  PROBLEM_EVENT_KINDS,
  PROBLEM_EVENTS,
  VIEW,
  xAt,
} from "./problem-scene";

describe("problem scene: mapping between causes and events", () => {
  it("links every event kind to exactly one cause", () => {
    const mapped = PROBLEM_CAUSES.flatMap((cause) => CAUSE_EVENTS[cause]);
    expect([...mapped].sort()).toEqual([...PROBLEM_EVENT_KINDS].sort());
    for (const cause of PROBLEM_CAUSES) {
      expect(CAUSE_EVENTS[cause].length).toBeGreaterThan(0);
      for (const kind of CAUSE_EVENTS[cause]) expect(causeOfEvent(kind)).toBe(cause);
    }
  });

  it("gives each cause events that read as its consequence", () => {
    expect(CAUSE_EVENTS).toEqual({
      relances: ["relance"],
      dossiers: ["dossier", "document"],
      doublons: ["doublon"],
      suivi: ["suivi", "validation"],
    });
  });

  it("matches the four causes written next to the chart, in the same order", () => {
    expect(LANDING_TEXTS.problem.symptoms.map((symptom) => symptom.key)).toEqual([...PROBLEM_CAUSES]);
  });

  it("names every event kind, and draws each of them with exactly one visible word", () => {
    expect(Object.keys(LANDING_TEXTS.problem.chart.events).sort()).toEqual([...PROBLEM_EVENT_KINDS].sort());
    for (const kind of PROBLEM_EVENT_KINDS) {
      const events = PROBLEM_EVENTS.filter((event) => event.kind === kind);
      expect(events.length, kind).toBeGreaterThan(0);
      expect(events.filter((event) => event.label).length, kind).toBe(1);
    }
  });
});

describe("problem scene: the shape tells the story", () => {
  it("progresses then plateaus: steep in the middle, almost flat at the end", () => {
    expect(mandates(0)).toBeCloseTo(0, 5);
    expect(mandates(1)).toBeCloseTo(1, 5);
    const middle = mandates(0.45) - mandates(0.35);
    const end = mandates(1) - mandates(0.9);
    expect(middle).toBeGreaterThan(end * 10);
  });

  it("absorbs more and more capacity once the friction starts", () => {
    expect(absorbedAt(FRICTION_START)).toBe(0);
    expect(absorbedAt(0.7)).toBeLessThan(absorbedAt(0.85));
    expect(absorbedAt(0.85)).toBeLessThan(absorbedAt(1));
  });

  it("makes the events denser as time goes by", () => {
    const count = (from: number, to: number) => PROBLEM_EVENTS.filter((event) => event.t >= from && event.t < to).length;
    expect(count(0.3, 0.6)).toBeLessThan(count(0.6, 0.8));
    expect(count(0.6, 0.8)).toBeLessThan(count(0.8, 1));
  });

  it("keeps at most two early events, and every other event strictly inside the friction zone", () => {
    expect(PROBLEM_EVENTS.filter(isEarlyEvent).length).toBeLessThanOrEqual(2);
    for (const event of PROBLEM_EVENTS) {
      const point = eventPoint(event);
      expect(point.y, event.id).toBeGreaterThan(0);
      expect(point.y, event.id).toBeLessThan(VIEW.height);
      expect(xAt(event.t), event.id).toBeLessThanOrEqual(VIEW.width);
      if (isEarlyEvent(event)) {
        expect(event.label, event.id).toBeUndefined();
        continue;
      }
      expect(point.y, event.id).toBeLessThan(curveY(event.t));
      expect(point.y, event.id).toBeGreaterThan(expectedY(event.t));
    }
  });

  it("shows few words at rest, one per cause at most, on one lane under the curve", () => {
    const rest = PROBLEM_EVENTS.filter((event) => event.label === "rest");
    const wide = PROBLEM_EVENTS.filter((event) => event.label === "wide");
    expect(rest).toHaveLength(2);
    expect(wide).toHaveLength(1);
    const causes = [...rest, ...wide].map((event) => causeOfEvent(event.kind));
    expect(new Set(causes).size).toBe(causes.length);
    for (const event of PROBLEM_EVENTS.filter((item) => item.label)) {
      // A word spans at most ±0.11 of time on a phone, and hangs 0.5 rem under
      // the lane: the lane never rises above the curve there.
      expect(LABEL_LANE_Y, event.id).toBeGreaterThanOrEqual(curveY(event.t - 0.11));
    }
  });

  it("lets the events accumulate after the curve passed them, and each cause arrive with its first event", () => {
    const delays = PROBLEM_EVENTS.map(eventDelayMs);
    expect(delays).toEqual([...delays].sort((a, b) => a - b));
    for (const cause of PROBLEM_CAUSES) {
      const first = PROBLEM_EVENTS.find((event) => CAUSE_EVENTS[cause].includes(event.kind));
      expect(first).toBeDefined();
      if (first) expect(causeDelayMs(cause)).toBe(eventDelayMs(first));
    }
  });
});
