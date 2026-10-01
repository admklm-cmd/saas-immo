import { describe, expect, it } from "vitest";

import { createProjector, poseFromProgress, projectInto, setProjector } from "./camera";
import { buildNetwork, CLASS_BUDGET, samplePath, type Network } from "./network";
import { addQuietRect, createQuietZones, distanceToQuiet, ORIGIN_CLEARANCE, type QuietZones } from "./quiet";
import { DEFAULT_SEED } from "./random";
import {
  ARRIVAL_SEQUENCE,
  ENERGY_DURATION,
  energyAt,
  SECTION_SEQUENCE,
  SIGNAL_SPEED_FACTOR,
  SignalField,
  type OriginContext,
  type SequenceRecord,
} from "./signals";

const WIDTH = 1440;
const HEIGHT = 900;
const network = buildNetwork({ seed: DEFAULT_SEED, screenClass: "large" });

function contextFor(net: Network, zones: QuietZones = createQuietZones(), progress = 0): OriginContext {
  const pose = poseFromProgress(progress);
  const projector = setProjector(createProjector(), pose.yaw, pose.pitch, WIDTH, HEIGHT, net.screenClass);
  const out = new Float64Array(4);
  const screenX: number[] = [];
  const screenY: number[] = [];
  for (let n = 0; n < net.nodeCount; n++) {
    projectInto(projector, net.nodeX[n]!, net.nodeY[n]!, net.nodeZ[n]!, out, 0);
    screenX.push(out[0]!);
    screenY.push(out[1]!);
  }
  return { screenX, screenY, width: WIDTH, height: HEIGHT, zones };
}

function field(maxSignals = CLASS_BUDGET.large.maxSignals) {
  return new SignalField(network, maxSignals, DEFAULT_SEED);
}

function excitations(record: SequenceRecord) {
  return record.events.filter((event) => event.kind === "excite");
}

/** Peak number of impulses alive at once. */
function peakConcurrency(target: SignalField): number {
  let peak = 0;
  for (const probe of target.pulses) {
    let count = 0;
    for (const other of target.pulses) if (other.start <= probe.start && probe.start < other.end) count++;
    peak = Math.max(peak, count);
  }
  return peak;
}

describe("energy of a lit core", () => {
  it("rises in ≈ 0.2 s, decays, and is off from 2.1 s", () => {
    expect(energyAt(0)).toBe(0);
    expect(energyAt(-1)).toBe(0);
    expect(energyAt(200)).toBeGreaterThan(0.6);
    expect(energyAt(1000)).toBeLessThan(energyAt(200));
    expect(energyAt(ENERGY_DURATION)).toBe(0);
    expect(energyAt(5000)).toBe(0);
  });
});

describe("propagation", () => {
  const target = field();
  const record = target.start("arrivee", 1000, contextFor(network))!;

  it("keeps the head of every impulse on its path", () => {
    const point = new Float64Array(3);
    for (const pulse of target.pulses.slice(0, 20)) {
      const length = network.fiberLength[pulse.fiber]!;
      for (const share of [0, 0.13, 0.5, 0.87, 1]) {
        samplePath(network, pulse.fiber, length * share, point);
        expect(distanceToPolyline(network, pulse.fiber, point)).toBeLessThan(1e-6);
      }
    }
  });

  it("excites the far neuron exactly when the head arrives: real length / speed", () => {
    const hops = excitations(record).filter((event) => event.hops > 0);
    expect(hops.length).toBeGreaterThan(0);
    for (const event of hops) {
      const arrival = target.pulses.find(
        (pulse) =>
          network.fiberOther[pulse.fiber]! >= 0 &&
          Math.abs(pulse.start + network.fiberLength[pulse.fiber]! / pulse.speed - event.time) < 1e-6,
      );
      expect(arrival, `excitation at ${event.time}`).toBeDefined();
    }
  });

  it("runs 1.5 × the reference speed, never faster", () => {
    expect(SIGNAL_SPEED_FACTOR).toBe(1.5);
    for (const pulse of target.pulses) {
      expect(pulse.speed).toBeGreaterThanOrEqual(0.0003 * 1.5 - 1e-12);
      expect(pulse.speed).toBeLessThanOrEqual(0.00046 * 1.5 + 1e-12);
    }
  });
});

describe("bounded sequences (simulated clock, default seed, 1440 × 900)", () => {
  it("arrival: last excitation ≤ 2 700 ms, last impulse ≤ 4 800 ms, all off at 4 800 ms, ≤ 3 hops", () => {
    const start = 1000;
    const target = field();
    const record = target.start("arrivee", start, contextFor(network))!;
    expect(record.origins).toHaveLength(2);
    expect(excitations(record).length).toBeGreaterThan(2);
    expect(record.lastExcitation - start).toBeLessThanOrEqual(ARRIVAL_SEQUENCE.exciteDeadline);
    expect(record.lastPulseEnd - start).toBeLessThanOrEqual(ARRIVAL_SEQUENCE.duration);
    expect(Math.max(...excitations(record).map((event) => event.hops))).toBeLessThanOrEqual(3);
    // The cascade really travels: at least one neuron reached through a connection.
    expect(Math.max(...excitations(record).map((event) => event.hops))).toBeGreaterThanOrEqual(1);
    const end = start + ARRIVAL_SEQUENCE.duration;
    for (let node = 0; node < network.nodeCount; node++) expect(target.energy(node, end)).toBe(0);
    expect(target.inFlight(end)).toBe(0);
    expect(target.busyUntil).toBeLessThanOrEqual(end);
  });

  it("section: ≤ 1 700 / ≤ 3 800 ms, ≤ 2 hops", () => {
    const start = 500;
    const target = field();
    const record = target.start("agents", start, contextFor(network, createQuietZones(), 0.5))!;
    expect(record.origins).toHaveLength(1);
    expect(record.lastExcitation - start).toBeLessThanOrEqual(SECTION_SEQUENCE.exciteDeadline);
    expect(record.lastPulseEnd - start).toBeLessThanOrEqual(SECTION_SEQUENCE.duration);
    expect(Math.max(...excitations(record).map((event) => event.hops))).toBeLessThanOrEqual(2);
    for (let node = 0; node < network.nodeCount; node++) expect(target.energy(node, start + SECTION_SEQUENCE.duration)).toBe(0);
  });

  it("never exceeds the cap of simultaneous impulses, even when sequences overlap", () => {
    const target = field();
    target.start("arrivee", 0, contextFor(network));
    target.start("probleme", 300, contextFor(network, createQuietZones(), 0.2));
    target.start("solution", 600, contextFor(network, createQuietZones(), 0.4));
    expect(peakConcurrency(target)).toBeLessThanOrEqual(CLASS_BUDGET.large.maxSignals);

    const tight = field(5);
    const record = tight.start("arrivee", 0, contextFor(network))!;
    expect(peakConcurrency(tight)).toBeLessThanOrEqual(5);
    expect(record.events.some((event) => event.kind === "refused" && event.reason === "cap")).toBe(true);
  });

  it("gives the same events for the same seed", () => {
    const a = field().start("arrivee", 1000, contextFor(network))!;
    const b = field().start("arrivee", 1000, contextFor(network))!;
    expect(b.events).toEqual(a.events);
    expect(b.origins).toEqual(a.origins);
  });

  it("plays each sequence once: a section already played replays nothing", () => {
    const target = field();
    expect(target.start("probleme", 0, contextFor(network))).not.toBeNull();
    const pulses = target.pulses.length;
    expect(target.start("probleme", 9000, contextFor(network))).toBeNull();
    expect(target.pulses.length).toBe(pulses);
    expect(target.playedNames()).toEqual(["probleme"]);
  });

  it("cancels everything in flight (hidden tab): no impulse, no lit core", () => {
    const target = field();
    target.start("arrivee", 0, contextFor(network));
    target.cancel();
    expect(target.pulses).toHaveLength(0);
    expect(target.litCount(800)).toBe(0);
    expect(target.inFlight(800)).toBe(0);
    expect(target.hasPlayed("arrivee")).toBe(true);
  });
});

describe("origins and quiet zones", () => {
  it("never starts a sequence closer than 48 px to a text block", () => {
    const zones = createQuietZones();
    // A hero-like text column and a heading band.
    addQuietRect(zones, 48, 140, 700, 780);
    addQuietRect(zones, 760, 120, 1300, 260);
    const context = contextFor(network, zones);
    const target = field();
    const record = target.start("arrivee", 0, context)!;
    expect(record.origins.length).toBeGreaterThan(0);
    for (const origin of record.origins) {
      expect(distanceToQuiet(zones, context.screenX[origin]!, context.screenY[origin]!)).toBeGreaterThanOrEqual(ORIGIN_CLEARANCE);
    }
  });

  it("records the sequence as played with no event when no neuron is eligible", () => {
    const zones = createQuietZones();
    addQuietRect(zones, -100, -100, WIDTH + 100, HEIGHT + 100);
    const target = field();
    const record = target.start("controle", 0, contextFor(network, zones))!;
    expect(record.origins).toEqual([]);
    expect(record.events).toEqual([]);
    expect(target.hasPlayed("controle")).toBe(true);
  });
});

function distanceToPolyline(net: Network, fiber: number, point: Float64Array): number {
  const start = net.fiberStart[fiber]!;
  let best = Infinity;
  for (let i = start; i < start + net.fiberSize[fiber]! - 1; i++) {
    const ax = net.points[i * 3]!;
    const ay = net.points[i * 3 + 1]!;
    const az = net.points[i * 3 + 2]!;
    const bx = net.points[i * 3 + 3]! - ax;
    const by = net.points[i * 3 + 4]! - ay;
    const bz = net.points[i * 3 + 5]! - az;
    const px = point[0]! - ax;
    const py = point[1]! - ay;
    const pz = point[2]! - az;
    const lengthSquared = bx * bx + by * by + bz * bz;
    const t = lengthSquared > 0 ? Math.max(0, Math.min(1, (px * bx + py * by + pz * bz) / lengthSquared)) : 0;
    best = Math.min(best, Math.hypot(px - bx * t, py - by * t, pz - bz * t));
  }
  return best;
}
