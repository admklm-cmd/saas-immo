/**
 * Electrical impulses of the network background (docs/design-system.md
 * §2.11.4): beats, excitation, refractory period, propagation along the real
 * length of each path, splits at the branchings (70 %), energy of the lit
 * cores — played in BOUNDED sequences only (arrival, then one per section, once).
 *
 * The reference fires a beat every 0.8–3 s forever. Here a sequence is
 * simulated in full the moment it starts (event queue in time order, seeded
 * draws): its outcome never depends on the frame rate, its end is known in
 * advance, and nothing is queued past its deadline. Drawing then only samples
 * the scheduled impulses at the current time (no allocation per frame).
 */

import { EventQueue } from "./event-queue";
import type { Network } from "./network";
import { chooseOrigins, type OriginContext } from "./origins";
import { createRandom, deriveSeed, type Random } from "./random";
import type { LivingScene } from "./scenes";

export type { OriginContext } from "./origins";

export type SequenceName = "arrivee" | Exclude<LivingScene, "hero">;

export type SequenceSpec = {
  /** Offsets of the beats from the start of the sequence, ms. */
  beats: readonly number[];
  /** Hops an impulse may make from neuron to neuron. */
  maxHops: number;
  /** No neuron is excited after this offset, ms. */
  exciteDeadline: number;
  /** Everything is off by this offset, ms (impulse ends included). */
  duration: number;
};

export const ARRIVAL_SEQUENCE: SequenceSpec = { beats: [0, 650], maxHops: 3, exciteDeadline: 2700, duration: 4800 };
export const SECTION_SEQUENCE: SequenceSpec = { beats: [0], maxHops: 2, exciteDeadline: 1700, duration: 3800 };

export function sequenceSpec(name: SequenceName): SequenceSpec {
  return name === "arrivee" ? ARRIVAL_SEQUENCE : SECTION_SEQUENCE;
}

/** Decision of the user (02/10): impulses 1.5 × the speed of the reference, never faster. */
export const SIGNAL_SPEED_FACTOR = 1.5;
/** Speed range of the reference, world units per ms. */
export const REFERENCE_SPEED: readonly [number, number] = [0.0003, 0.00046];
/** A lit core: rises in ≈ 0.2 s, off after 2.1 s. */
export const ENERGY_DURATION = 2100;
export const SPLIT_PROBABILITY = 0.7;
export const SPLIT_STRENGTH = 0.78;
export const HOP_STRENGTH = 0.79;
export const MIN_STRENGTH = 0.2;
export const REFRACTORY: readonly [number, number] = [1600, 3200];
export const LAUNCH_DELAY: readonly [number, number] = [45, 170];
/** Length of the fading trace behind a head (world units). */
export const TRAIL: readonly [number, number] = [0.012, 0.019];
/** Beats remembered per neuron (energy uses the latest one already started). */
const BEATS_PER_NODE = 4;

/** Energy of a core lit `age` ms ago: (1 − e^(−age/60))² × e^(−age/620), 0 outside [0, 2100). */
export function energyAt(age: number): number {
  if (!(age >= 0) || age >= ENERGY_DURATION) return 0;
  const rise = 1 - Math.exp(-age / 60);
  return rise * rise * Math.exp(-age / 620);
}

export type Pulse = {
  fiber: number;
  reverse: boolean;
  /** Time the front is at the start of the path, ms. */
  start: number;
  /** World units per ms. */
  speed: number;
  strength: number;
  hops: number;
  trail: number;
  /** Time the trail leaves the end of the path, ms. */
  end: number;
};

export type SignalEvent =
  | { kind: "excite"; time: number; node: number; hops: number; strength: number }
  | { kind: "launch"; time: number; fiber: number; reverse: boolean; start: number; end: number; hops: number }
  | { kind: "refused"; time: number; fiber: number; reason: "deadline" | "cap" };

export type SequenceRecord = {
  name: SequenceName;
  start: number;
  spec: SequenceSpec;
  origins: number[];
  events: SignalEvent[];
  /** Last excitation time (absolute ms), or -Infinity. */
  lastExcitation: number;
  /** Last impulse end (absolute ms), or -Infinity. */
  lastPulseEnd: number;
  /**
   * Effective end (absolute ms): last impulse gone and last core off. ≤ start
   * + spec.duration; equal to start when nothing could be played.
   */
  end: number;
};

type QueuedEvent =
  | { kind: "excite"; time: number; order: number; node: number; incoming: number; strength: number; hops: number }
  | { kind: "split"; time: number; order: number; pulse: Pulse; child: number };

export class SignalField {
  readonly network: Network;
  readonly maxSignals: number;
  readonly seed: number;
  /** Scheduled impulses (past ones are pruned). */
  readonly pulses: Pulse[] = [];
  readonly sequences: SequenceRecord[] = [];
  private readonly played = new Set<SequenceName>();
  private readonly refractory: Float64Array;
  private readonly beats: Float64Array;
  private readonly beatCount: Uint8Array;
  /** Nothing is lit nor in flight after this time (ms). */
  busyUntil = -Infinity;

  constructor(network: Network, maxSignals: number, seed: number) {
    this.network = network;
    this.maxSignals = maxSignals;
    this.seed = seed;
    this.refractory = new Float64Array(network.nodeCount).fill(-Infinity);
    this.beats = new Float64Array(network.nodeCount * BEATS_PER_NODE).fill(-Infinity);
    this.beatCount = new Uint8Array(network.nodeCount);
  }

  hasPlayed(name: SequenceName): boolean {
    return this.played.has(name);
  }

  /** Names of the sequences played (or skipped) so far, in order. */
  playedNames(): SequenceName[] {
    return [...this.played];
  }

  /** Marks a sequence as played without running it (hidden tab, reduced motion). */
  markPlayed(name: SequenceName): void {
    this.played.add(name);
  }

  /**
   * Starts a sequence at `now` (ms) — once per name. Returns its record, or
   * null when it was already played. Without an eligible origin the sequence
   * is still recorded as played, with no event.
   */
  start(name: SequenceName, now: number, context: OriginContext): SequenceRecord | null {
    if (this.played.has(name)) return null;
    this.played.add(name);
    const spec = sequenceSpec(name);
    const random = createRandom(deriveSeed(this.seed, name));
    const record: SequenceRecord = {
      name,
      start: now,
      spec,
      origins: chooseOrigins(this.network, context, this.refractory, now, random, spec.beats.length),
      events: [],
      lastExcitation: -Infinity,
      lastPulseEnd: -Infinity,
      end: now,
    };
    this.sequences.push(record);
    this.simulate(record, random);
    record.end = Math.max(now, record.lastPulseEnd, record.lastExcitation + ENERGY_DURATION);
    this.busyUntil = Math.max(this.busyUntil, record.end);
    return record;
  }

  /** Hidden tab: everything in flight is dropped, nothing will light up again. */
  cancel(): void {
    this.pulses.length = 0;
    this.beats.fill(-Infinity);
    this.beatCount.fill(0);
    this.busyUntil = -Infinity;
    for (const record of this.sequences) {
      record.start = -Infinity;
      record.end = -Infinity;
    }
  }

  /** Drops the impulses whose trail has left their path (in place, no allocation). */
  prune(now: number): void {
    let kept = 0;
    for (let i = 0; i < this.pulses.length; i++) {
      const pulse = this.pulses[i]!;
      if (pulse.end > now) this.pulses[kept++] = pulse;
    }
    this.pulses.length = kept;
  }

  /** Energy of a neuron's core at `now`: from its latest beat already started. */
  energy(node: number, now: number): number {
    let latest = -Infinity;
    const base = node * BEATS_PER_NODE;
    for (let k = 0; k < BEATS_PER_NODE; k++) {
      const beat = this.beats[base + k]!;
      if (beat <= now && beat > latest) latest = beat;
    }
    return latest === -Infinity ? 0 : energyAt(now - latest);
  }

  /** Impulses whose head or trail is on screen at `now`. */
  inFlight(now: number): number {
    let count = 0;
    for (const pulse of this.pulses) if (pulse.start <= now && now < pulse.end) count++;
    return count;
  }

  /** Lit cores at `now` (energy above the halo threshold). */
  litCount(now: number): number {
    let count = 0;
    for (let node = 0; node < this.network.nodeCount; node++) if (this.energy(node, now) > 0.01) count++;
    return count;
  }

  private simulate(record: SequenceRecord, random: Random): void {
    const queue = new EventQueue<QueuedEvent>();
    let order = 0;
    record.spec.beats.forEach((offset, index) => {
      const node = record.origins[index];
      if (node === undefined) return;
      queue.push({ kind: "excite", time: record.start + offset, order: order++, node, incoming: -1, strength: 1, hops: 0 });
    });

    const network = this.network;
    const deadline = record.start + record.spec.exciteDeadline;
    const end = record.start + record.spec.duration;

    const launch = (fiber: number, reverse: boolean, start: number, speed: number, strength: number, hops: number, decidedAt: number) => {
      const trail = random.range(TRAIL[0], TRAIL[1]);
      const length = network.fiberLength[fiber]!;
      const pulseEnd = start + (length + trail) / speed;
      if (pulseEnd > end) {
        record.events.push({ kind: "refused", time: decidedAt, fiber, reason: "deadline" });
        return;
      }
      if (this.peakOverlap(start, pulseEnd) >= this.maxSignals) {
        record.events.push({ kind: "refused", time: decidedAt, fiber, reason: "cap" });
        return;
      }
      const pulse: Pulse = { fiber, reverse, start, speed, strength, hops, trail, end: pulseEnd };
      this.pulses.push(pulse);
      record.events.push({ kind: "launch", time: decidedAt, fiber, reverse, start, end: pulseEnd, hops });
      record.lastPulseEnd = Math.max(record.lastPulseEnd, pulseEnd);
      const other = network.fiberOther[fiber]!;
      if (other >= 0) {
        // A connection: the neuron at the far end is excited the instant the head arrives.
        const target = reverse ? network.fiberOwner[fiber]! : other;
        queue.push({ kind: "excite", time: start + length / speed, order: order++, node: target, incoming: fiber, strength: strength * HOP_STRENGTH, hops: hops + 1 });
      } else if (!reverse) {
        for (let c = network.childStart[fiber]!; c < network.childStart[fiber + 1]!; c++) {
          queue.push({ kind: "split", time: start + network.childDistance[c]! / speed, order: order++, pulse, child: network.childFiber[c]! });
        }
      }
    };

    const candidates: { fiber: number; reverse: boolean }[] = [];
    for (let event = queue.pop(); event; event = queue.pop()) {
      if (event.kind === "split") {
        if (random.next() < SPLIT_PROBABILITY) {
          const { pulse } = event;
          launch(event.child, false, event.time, pulse.speed, pulse.strength * SPLIT_STRENGTH, pulse.hops, event.time);
        }
        continue;
      }
      const { node, time: at } = event;
      if (at > deadline || at < this.refractory[node]! || event.hops > record.spec.maxHops || event.strength < MIN_STRENGTH) continue;
      this.addBeat(node, at);
      this.refractory[node] = at + random.range(REFRACTORY[0], REFRACTORY[1]);
      record.events.push({ kind: "excite", time: at, node, hops: event.hops, strength: event.strength });
      record.lastExcitation = Math.max(record.lastExcitation, at);

      candidates.length = 0;
      for (let o = network.outStart[node]!; o < network.outStart[node + 1]!; o++) {
        const fiber = network.outFiber[o]!;
        if (fiber !== event.incoming) candidates.push({ fiber, reverse: network.outReverse[o] === 1 });
      }
      // Shuffle once at activation (seeded), then send a few anatomically connected signals.
      for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(random.next() * (i + 1));
        const swap = candidates[i]!;
        candidates[i] = candidates[j]!;
        candidates[j] = swap;
      }
      const linkShare = random.next() < 0.3 ? 2 : 1;
      const dendriteShare = Math.floor(random.range(2, 5));
      const paths = [
        ...candidates.filter((c) => network.fiberOther[c.fiber]! >= 0).slice(0, linkShare),
        ...candidates.filter((c) => network.fiberOther[c.fiber]! < 0).slice(0, dendriteShare),
      ];
      const speed = random.range(REFERENCE_SPEED[0], REFERENCE_SPEED[1]) * SIGNAL_SPEED_FACTOR;
      for (const path of paths) {
        launch(path.fiber, path.reverse, at + random.range(LAUNCH_DELAY[0], LAUNCH_DELAY[1]), speed, event.strength, event.hops, at);
      }
    }
  }

  /** Largest number of scheduled impulses alive at once within [from, to). */
  private peakOverlap(from: number, to: number): number {
    let peak = 0;
    for (const probe of this.pulses) {
      const at = probe.start > from ? probe.start : from;
      if (at >= to || probe.end <= from) continue;
      let count = 0;
      for (const other of this.pulses) if (other.start <= at && at < other.end) count++;
      if (count > peak) peak = count;
    }
    // The window may start while impulses are already alive and none starts inside.
    let atStart = 0;
    for (const other of this.pulses) if (other.start <= from && from < other.end) atStart++;
    return Math.max(peak, atStart);
  }

  private addBeat(node: number, at: number): void {
    const slot = this.beatCount[node]! % BEATS_PER_NODE;
    this.beats[node * BEATS_PER_NODE + slot] = at;
    this.beatCount[node] = (this.beatCount[node]! + 1) % 256;
  }
}
