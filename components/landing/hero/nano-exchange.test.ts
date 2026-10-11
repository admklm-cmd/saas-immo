import { describe, expect, it } from "vitest";

import {
  ANIMATED_PROPERTIES,
  EXCHANGE_MS,
  RELEASE_MS,
  exchangeChoreography,
  linkOffset,
  offsetAt,
  releaseChoreography,
  resolvePair,
  restOffset,
  returnPoint,
  trajectoryClearance,
  type Choreography,
  type PairGeometry,
  type Rect,
} from "./nano-exchange";
import { AMBIENT_ROBOTS, PAIR_SEEDS, seededRandom } from "./nano-population";
import { NanoScheduler, FIRST_START_MS, PAIR_REST_MS } from "./nano-scheduler";

const SEED = PAIR_SEEDS[0]!;
const OPEN = { x: 300, y: 300 };

function geometry(overrides: Partial<PairGeometry> = {}): PairGeometry {
  return { ...resolvePair(SEED, OPEN, "large", []), ...overrides };
}

function endOf(choreography: Choreography): number {
  return Math.max(...choreography.steps.map((step) => step.at + step.duration));
}

describe("population (docs/design-system.md §2.11.4 bis C)", () => {
  it("draws 48 ambient robots (32 kept on a phone) and 8 pairs, the same on every call", () => {
    expect(AMBIENT_ROBOTS).toHaveLength(48);
    expect(AMBIENT_ROBOTS.filter((robot) => !robot.compactHidden)).toHaveLength(32);
    expect(PAIR_SEEDS).toHaveLength(8);
    expect(PAIR_SEEDS.filter((pair) => pair.compactAnchor)).toHaveLength(4);
    for (const pair of PAIR_SEEDS) {
      expect(pair.theta).toBeGreaterThanOrEqual(-35);
      expect(pair.theta).toBeLessThanOrEqual(35);
    }
    const again = seededRandom(7);
    const first = [again(), again()];
    const replay = seededRandom(7);
    expect([replay(), replay()]).toEqual(first);
  });

  it("keeps the ambient drift posed: 6–22 px, 7–14 s, opacity 0.20–0.60", () => {
    for (const robot of AMBIENT_ROBOTS) {
      expect(robot.driftX).toBeGreaterThanOrEqual(6);
      expect(robot.driftX).toBeLessThanOrEqual(22);
      expect(robot.duration).toBeGreaterThanOrEqual(7_000);
      expect(robot.duration).toBeLessThanOrEqual(14_000);
      expect(robot.opacity).toBeGreaterThanOrEqual(0.2);
      expect(robot.opacity).toBeLessThanOrEqual(0.6);
    }
  });
});

describe("choreography of an exchange (C8)", () => {
  const pair = geometry();
  const choreography = exchangeChoreography(pair, { a: restOffset(pair, "a"), b: restOffset(pair, "b") }, { a: restOffset(pair, "a"), b: restOffset(pair, "b") });

  it("animates only translateX, translateY, scale, scaleX and opacity", () => {
    const used = new Set(choreography.steps.flatMap((step) => Object.keys(step.props)));
    for (const property of used) expect(ANIMATED_PROPERTIES).toContain(property);
    expect(used).toEqual(new Set(ANIMATED_PROPERTIES));
  });

  it("lasts 8 420 ms and walks through the seven phases in order", () => {
    expect(choreography.duration).toBe(8_420);
    expect(EXCHANGE_MS).toBe(8_420);
    expect(endOf(choreography)).toBe(8_420);
    expect(choreography.phases.map((phase) => [phase.at, phase.phase])).toEqual([
      [0, "approach"],
      [2_800, "contact"],
      [3_640, "link"],
      [4_060, "transfer"],
      [4_780, "hold"],
      [5_380, "release"],
      [8_420, "idle"],
    ]);
  });

  it("brings the edges into contact (gap 0), then 28 px apart while the wire is stretched", () => {
    const contactA = choreography.steps.find((step) => step.target === "a" && step.at === 2_800)!.props.translateX![1];
    const contactB = choreography.steps.find((step) => step.target === "b" && step.at === 2_800)!.props.translateX![1];
    const contactAy = choreography.steps.find((step) => step.target === "a" && step.at === 2_800)!.props.translateY![1];
    const contactBy = choreography.steps.find((step) => step.target === "b" && step.at === 2_800)!.props.translateY![1];
    expect(Math.hypot(contactB - contactA, contactBy - contactAy)).toBeCloseTo(pair.size, 6);
    const a = linkOffset(pair, "a");
    const b = linkOffset(pair, "b");
    expect(Math.hypot(b.x - a.x, b.y - a.y) - pair.size).toBeCloseTo(28, 6);
  });

  it("never rebounds: every scale stays within [1, 1.12], every opacity within [0, 1]", () => {
    const scales = choreography.steps.flatMap((step) => step.props.scale ?? []);
    const opacities = choreography.steps.flatMap((step) => step.props.opacity ?? []);
    expect(Math.min(...scales)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...scales)).toBeLessThanOrEqual(1.12);
    expect(Math.min(...opacities)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...opacities)).toBeLessThanOrEqual(1);
  });

  it("parts the still composition in 2 040 ms with the same properties", () => {
    const release = releaseChoreography(pair);
    expect(endOf(release)).toBe(RELEASE_MS);
    for (const property of release.steps.flatMap((step) => Object.keys(step.props))) expect(ANIMATED_PROPERTIES).toContain(property);
  });
});

describe("avoidance rule (C8)", () => {
  const text: Rect = { left: 200, top: 260, right: 400, bottom: 340 };

  it("switches off a pair whose meeting point is inside a text, and hides it when its rest is in the text too", () => {
    const placed = resolvePair(SEED, { x: 300, y: 300 }, "large", [text]);
    expect(placed.active).toBe(false);
  });

  it("shrinks the rest distance before switching a pair off", () => {
    const flat = { ...SEED, theta: 0, spread: 1 };
    // 200 px wide at rest would reach the text 70 px to the right; 80 px keeps 24 px clear.
    const near = { left: 400, top: 0, right: 600, bottom: 600 };
    const placed = resolvePair(flat, { x: 300, y: 300 }, "large", [near]);
    expect(placed.active).toBe(true);
    expect(placed.distance).toBeLessThan(200);
    const b = { x: 300 + placed.distance / 2, y: 300 };
    expect(trajectoryClearance({ x: 300 - placed.distance / 2, y: 300 }, b, placed.size, [near])).toBeGreaterThanOrEqual(24);
  });

  it("keeps a free pair at its preferred distance (140–200 px on a computer)", () => {
    const placed = resolvePair(SEED, OPEN, "large", []);
    expect(placed.active).toBe(true);
    expect(placed.distance).toBeGreaterThanOrEqual(140);
    expect(placed.distance).toBeLessThanOrEqual(200);
    const phone = resolvePair(SEED, OPEN, "compact", []);
    expect(phone.distance).toBeGreaterThanOrEqual(72);
    expect(phone.distance).toBeLessThanOrEqual(110);
    expect(phone.size).toBe(5);
  });

  it("returns near the rest (± 10 px) but never closer than 24 px to a text", () => {
    const pair = geometry();
    const random = seededRandom(3);
    const rest = restOffset(pair, "a");
    for (let index = 0; index < 20; index += 1) {
      const point = returnPoint(pair, "a", random, []);
      expect(Math.abs(point.x - rest.x)).toBeLessThanOrEqual(10);
      expect(Math.abs(point.y - rest.y)).toBeLessThanOrEqual(10);
    }
    const restAbsolute = { x: pair.anchor.x + rest.x, y: pair.anchor.y + rest.y };
    const wall: Rect = { left: restAbsolute.x - 200, top: restAbsolute.y + 26, right: restAbsolute.x + 200, bottom: restAbsolute.y + 400 };
    expect(returnPoint(pair, "a", () => 1, [wall])).toEqual(rest);
    expect(offsetAt(pair, "b", 10)).toEqual({ x: pair.ux * 10, y: pair.uy * 10 });
  });
});

describe("scheduler (C8)", () => {
  const PAIRS = [1, 2, 3, 4, 5, 6, 7, 8];

  function run(compact: boolean, until: number, pairs = PAIRS) {
    const scheduler = new NanoScheduler({ pairs, compact, seed: 11 });
    const starts: { pair: number; at: number }[] = [];
    let maxActive = 0;
    for (let now = 0; now <= until; now += 50) {
      const { started } = scheduler.tick(now);
      for (const exchange of started) starts.push({ pair: exchange.pair, at: exchange.startAt });
      maxActive = Math.max(maxActive, scheduler.active().length);
    }
    return { scheduler, starts, maxActive };
  }

  it("starts the first exchange at 2 400 ms, never earlier", () => {
    const { starts } = run(false, 30_000);
    expect(starts[0]!.at).toBe(FIRST_START_MS);
  });

  it("computer: at most two exchanges at once, a start about every 4.2 s (3.6 to 4.8 s, or later when two run)", () => {
    const { starts, maxActive } = run(false, 120_000);
    expect(maxActive).toBe(2);
    expect(starts.length).toBeGreaterThan(20);
    for (let index = 1; index < starts.length; index += 1) {
      expect(starts[index]!.at - starts[index - 1]!.at).toBeGreaterThanOrEqual(3_600);
    }
  });

  it("phone: one exchange at a time, 2.4 s after the end of the previous one", () => {
    const { starts, maxActive } = run(true, 120_000, [1, 2, 3, 4]);
    expect(maxActive).toBe(1);
    for (let index = 1; index < starts.length; index += 1) {
      expect(starts[index]!.at - starts[index - 1]!.at).toBe(8_420 + 2_400);
    }
  });

  it("lets every pair rest at least 6 s between two exchanges", () => {
    for (const compact of [false, true]) {
      const { starts } = run(compact, 200_000, compact ? [1, 2] : PAIRS);
      const last = new Map<number, number>();
      for (const start of starts) {
        const previous = last.get(start.pair);
        if (previous !== undefined) expect(start.at - (previous + 8_420)).toBeGreaterThanOrEqual(PAIR_REST_MS);
        last.set(start.pair, start.at);
      }
    }
  });

  it("skips the switched-off pairs and the pairs held by the still composition", () => {
    const scheduler = new NanoScheduler({ pairs: PAIRS, compact: false, seed: 11 });
    scheduler.setEnabled([3, 4]);
    scheduler.hold(3, 2_040);
    scheduler.hold(4, 2_040);
    const { started } = scheduler.tick(FIRST_START_MS);
    expect(started).toEqual([]);
    expect(scheduler.nextEventAt()).toBe(2_040 + PAIR_REST_MS);
    const later = scheduler.tick(2_040 + PAIR_REST_MS);
    expect(later.started.map((exchange) => exchange.pair)).toHaveLength(1);
  });

  it("never bursts after a long gap: the schedule restarts from now", () => {
    const scheduler = new NanoScheduler({ pairs: PAIRS, compact: false, seed: 11 });
    const { started } = scheduler.tick(60_000);
    expect(started).toHaveLength(1);
    expect(started[0]!.startAt).toBe(60_000);
    expect(scheduler.started).toBe(1);
  });

  it("brings every running exchange to its end on a resize", () => {
    const scheduler = new NanoScheduler({ pairs: PAIRS, compact: false, seed: 11 });
    scheduler.tick(FIRST_START_MS);
    expect(scheduler.active()).toHaveLength(1);
    expect(scheduler.endAll(3_000)).toHaveLength(1);
    expect(scheduler.active()).toHaveLength(0);
    expect(scheduler.nextEventAt()).toBeGreaterThanOrEqual(4_200);
  });
});
