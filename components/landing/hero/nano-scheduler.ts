/**
 * Who exchanges, and when (docs/design-system.md §2.11.4 bis D, « Ordonnanceur »).
 * Pure: it works on a VIRTUAL clock that only advances while the layer plays
 * (the client stops it off screen, in a hidden tab and on the pause button),
 * so a pause never shortens a rest nor bunches the exchanges on return.
 *
 * Computer: a new exchange about every 4.2 s (± 600 ms), at most two at once;
 * when two are running, the next one waits 1.2 s after the end of one of them.
 * Phone: one at a time, 2.4 s after the end of the previous one. A pair rests
 * at least 6 s between two exchanges; pairs take turns in an order shuffled
 * once. Never a burst: late by more than a second, the schedule restarts from
 * now instead of catching up.
 */

import { EXCHANGE_MS } from "./nano-exchange";
import { seededRandom } from "./nano-population";

export const FIRST_START_MS = 2_400;
export const START_INTERVAL_MS = 4_200;
export const START_JITTER_MS = 600;
export const AFTER_END_MS = 1_200;
export const COMPACT_AFTER_END_MS = 2_400;
export const PAIR_REST_MS = 6_000;
export const MAX_ACTIVE = 2;
export const MAX_ACTIVE_COMPACT = 1;
const MAX_LATE_MS = 1_000;

export type Exchange = {
  /** 1, 2, 3… in the order of the starts. */
  readonly serial: number;
  readonly pair: number;
  readonly startAt: number;
  readonly endAt: number;
  /** Seed of this exchange (its return jitter). */
  readonly seed: number;
};

export class NanoScheduler {
  private readonly random: () => number;
  private readonly order: number[];
  private turn = 0;
  private enabled: Set<number>;
  private readonly restUntil = new Map<number, number>();
  private running: Exchange[] = [];
  private nextAt = FIRST_START_MS;
  private compact: boolean;
  /** Exchanges started since the page loaded (never reset). */
  started = 0;

  constructor(options: { pairs: readonly number[]; compact: boolean; seed: number }) {
    this.random = seededRandom(options.seed);
    this.order = [...options.pairs];
    // Fisher–Yates, once.
    for (let index = this.order.length - 1; index > 0; index -= 1) {
      const other = Math.floor(this.random() * (index + 1));
      [this.order[index], this.order[other]] = [this.order[other]!, this.order[index]!];
    }
    this.enabled = new Set(options.pairs);
    this.compact = options.compact;
  }

  get maxActive(): number {
    return this.compact ? MAX_ACTIVE_COMPACT : MAX_ACTIVE;
  }

  /** Pairs allowed to exchange (the others are off: too close to a text, or hidden on a phone). */
  setEnabled(pairs: readonly number[]): void {
    this.enabled = new Set(pairs);
  }

  setCompact(compact: boolean): void {
    this.compact = compact;
  }

  /** A pair busy until `until` (the release of the still composition): it rests 6 s after. */
  hold(pair: number, until: number): void {
    this.restUntil.set(pair, until + PAIR_REST_MS);
  }

  /** Every running exchange is brought to its end now (a resize): rests start now. */
  endAll(now: number): Exchange[] {
    const ended = this.running;
    for (const exchange of ended) this.restUntil.set(exchange.pair, now + PAIR_REST_MS);
    this.running = [];
    if (ended.length > 0) this.nextAt = Math.max(this.nextAt, now + (this.compact ? COMPACT_AFTER_END_MS : AFTER_END_MS));
    return ended;
  }

  active(): readonly Exchange[] {
    return this.running;
  }

  /** Next instant (virtual) at which `tick` has something to do. */
  nextEventAt(): number {
    return Math.min(this.nextAt, ...this.running.map((exchange) => exchange.endAt));
  }

  /** Advances to `now` (virtual ms): the exchanges that ended, and those that start. */
  tick(now: number): { ended: Exchange[]; started: Exchange[] } {
    const ended: Exchange[] = [];
    const started: Exchange[] = [];
    if (this.nextAt < now - MAX_LATE_MS) this.nextAt = now;
    this.retire(now, ended);
    let guard = 0;
    while (this.nextAt <= now && guard < 16) {
      guard += 1;
      const at = this.nextAt;
      this.retire(at, ended);
      if (this.running.length >= this.maxActive) {
        const firstEnd = Math.min(...this.running.map((exchange) => exchange.endAt));
        this.nextAt = firstEnd + (this.compact ? COMPACT_AFTER_END_MS : AFTER_END_MS);
        continue;
      }
      const pair = this.pick(at);
      if (pair === null) {
        const waits = [...this.enabled].filter((id) => !this.isRunning(id)).map((id) => this.restUntil.get(id) ?? at);
        this.nextAt = waits.length > 0 ? Math.max(at + 1, Math.min(...waits)) : Infinity;
        continue;
      }
      this.started += 1;
      const exchange: Exchange = { serial: this.started, pair, startAt: at, endAt: at + EXCHANGE_MS, seed: Math.floor(this.random() * 0x7fff_ffff) };
      this.running.push(exchange);
      started.push(exchange);
      this.nextAt = this.compact
        ? exchange.endAt + COMPACT_AFTER_END_MS
        : at + START_INTERVAL_MS + Math.round((this.random() * 2 - 1) * START_JITTER_MS);
    }
    return { ended, started };
  }

  private retire(now: number, into: Exchange[]): void {
    const still: Exchange[] = [];
    for (const exchange of this.running) {
      if (exchange.endAt <= now) {
        this.restUntil.set(exchange.pair, exchange.endAt + PAIR_REST_MS);
        into.push(exchange);
      } else still.push(exchange);
    }
    this.running = still;
  }

  private isRunning(pair: number): boolean {
    return this.running.some((exchange) => exchange.pair === pair);
  }

  /** The next pair in turn that is enabled, not running and rested. */
  private pick(at: number): number | null {
    for (let offset = 0; offset < this.order.length; offset += 1) {
      const index = (this.turn + offset) % this.order.length;
      const pair = this.order[index]!;
      if (!this.enabled.has(pair) || this.isRunning(pair)) continue;
      if ((this.restUntil.get(pair) ?? -Infinity) > at) continue;
      this.turn = index + 1;
      return pair;
    }
    return null;
  }
}
