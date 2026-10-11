/**
 * Drives the nanorobot layer of the hero (docs/design-system.md §2.11.4 bis
 * C, D, F) with Anime.js 4.5.0: the slow drift of the ambient robots, and one
 * timeline per exchange, started by the pure `NanoScheduler` on a virtual
 * clock. Only `transform` and `opacity` move. Paused off screen, in a hidden
 * tab and on the pause button: then no timer is armed and every tickable is
 * paused (Anime.js stops requesting frames). Under reduced motion: the still
 * composition, no timer, no timeline.
 *
 * Client only; the markup is rendered by `HeroNanoField`.
 */

import { animate, createTimeline, utils, type JSAnimation, type Timeline } from "animejs";

import {
  RELEASE_MS,
  exchangeChoreography,
  linkLength,
  linkOffset,
  releaseChoreography,
  resolvePair,
  restOffset,
  returnPoint,
  ENGAGED_OPACITY,
  REST_OPACITY,
  type Choreography,
  type NanoPhase,
  type NanoScreen,
  type NanoTarget,
  type PairGeometry,
  type Rect,
  type Role,
} from "./nano-exchange";
import { AMBIENT_ROBOTS, PAIR_SEEDS, STILL_LINKED_PAIRS, seededRandom, type Point } from "./nano-population";
import { NanoScheduler, type Exchange } from "./nano-scheduler";

export type LoopState = "playing" | "paused" | "stopped" | "reduced";

type PairNodes = { root: HTMLElement; wire: HTMLElement; link: HTMLElement; bit: HTMLElement; a: HTMLElement; b: HTMLElement; portA: HTMLElement; portB: HTMLElement };

const LARGE_MIN_WIDTH = 1024;
const SCHEDULER_SEED = 0x2a5e;

export class NanoFieldController {
  private readonly pairs = new Map<number, PairNodes>();
  private readonly ambients: HTMLElement[];
  private geometry = new Map<number, PairGeometry>();
  private positions = new Map<number, Record<Role, Point>>();
  private quiet: Rect[] = [];
  private screen: NanoScreen = "large";
  private scheduler: NanoScheduler;
  private drifts: JSAnimation[] = [];
  private readonly timelines = new Set<Timeline>();
  private timer: number | null = null;
  private clockBase = 0;
  private clockSince: number | null = null;
  private started = false;
  private state: LoopState = "paused";
  private onScreen = false;
  private pageVisible = true;
  private stopped = false;
  private reduced: boolean;

  constructor(
    private readonly field: HTMLElement,
    private readonly stage: HTMLElement,
    options: { reduced: boolean; compact: boolean },
  ) {
    this.ambients = Array.from(field.querySelectorAll<HTMLElement>("[data-nano-robot='ambient']"));
    for (const root of field.querySelectorAll<HTMLElement>("[data-nano-pair]")) {
      const id = Number(root.dataset.nanoPair);
      const get = (selector: string) => root.querySelector<HTMLElement>(selector)!;
      const a = get("[data-role='a']");
      const b = get("[data-role='b']");
      this.pairs.set(id, { root, wire: get("[data-nano-wire]"), link: get("[data-nano-link]"), bit: get("[data-nano-bit]"), a, b, portA: a.querySelector<HTMLElement>("[data-nano-port]")!, portB: b.querySelector<HTMLElement>("[data-nano-port]")! });
    }
    this.reduced = options.reduced;
    this.scheduler = new NanoScheduler({ pairs: PAIR_SEEDS.map((pair) => pair.id), compact: options.compact, seed: SCHEDULER_SEED });
  }

  /** First measure, then the still composition or the motion. */
  init(compact: boolean): void {
    this.measure(compact);
    this.placeStill();
    if (this.reduced) this.setState("reduced");
    else this.startMotion();
  }

  setOnScreen(onScreen: boolean): void {
    this.onScreen = onScreen;
    this.sync();
  }

  setPageVisible(visible: boolean): void {
    this.pageVisible = visible;
    this.sync();
  }

  setStopped(stopped: boolean): void {
    this.stopped = stopped;
    this.sync();
  }

  setReduced(reduced: boolean): void {
    if (reduced === this.reduced) return;
    this.reduced = reduced;
    if (reduced) {
      this.halt();
      this.placeStill();
      this.setState("reduced");
      return;
    }
    this.placeStill();
    this.startMotion();
  }

  /** Resize (debounced by the caller): running exchanges jump to their end, then the geometry is redone. */
  resize(compact: boolean): void {
    for (const timeline of [...this.timelines]) timeline.complete();
    this.timelines.clear();
    this.scheduler.endAll(this.now());
    this.measure(compact);
    if (this.reduced) {
      this.placeStill();
      return;
    }
    for (const id of this.pairs.keys()) this.placeRest(id);
    this.updateCounters();
    this.arm();
  }

  dispose(): void {
    this.halt();
  }

  // ------------------------------------------------------------------ state

  private sync(): void {
    if (this.reduced || !this.started) return;
    const wanted = this.onScreen && this.pageVisible && !this.stopped;
    if (wanted && this.state !== "playing") this.play();
    else if (!wanted) this.pause(this.stopped ? "stopped" : "paused");
  }

  private setState(state: LoopState): void {
    this.state = state;
    this.field.dataset.loopState = state;
  }

  private now(): number {
    return this.clockBase + (this.clockSince === null ? 0 : performance.now() - this.clockSince);
  }

  private play(): void {
    this.clockSince = performance.now();
    for (const drift of this.drifts) drift.resume();
    for (const timeline of this.timelines) timeline.resume();
    this.setState("playing");
    this.tick();
  }

  private pause(state: "paused" | "stopped"): void {
    if (this.state === state) return;
    this.clockBase = this.now();
    this.clockSince = null;
    this.clearTimer();
    for (const drift of this.drifts) drift.pause();
    for (const timeline of this.timelines) timeline.pause();
    this.setState(state);
  }

  /** Everything stops for good (reduced motion, unmount). */
  private halt(): void {
    this.clearTimer();
    for (const timeline of this.timelines) timeline.pause();
    this.timelines.clear();
    for (const drift of this.drifts) drift.revert();
    this.drifts = [];
    for (const robot of this.ambients) utils.set(robot, { translateX: 0, translateY: 0, scale: 1, rotate: 0 });
    this.clockSince = null;
    this.started = false;
  }

  private startMotion(): void {
    this.started = true;
    this.setState("paused");
    this.drifts = this.ambients.map((robot, index) => {
      const config = AMBIENT_ROBOTS[index]!;
      const turning = config.shape !== "dot";
      return animate(robot, {
        translateX: [0, config.driftX * (index % 2 === 0 ? 1 : -1)],
        translateY: [0, config.driftY * (index % 3 === 0 ? -1 : 1)],
        scale: [1, index % 2 === 0 ? 1.06 : 0.92],
        rotate: turning ? [0, index % 2 === 0 ? 8 : -8] : [0, 0],
        opacity: [config.opacity, config.opacity * 0.6],
        duration: config.duration,
        delay: config.delay,
        ease: "inOutSine",
        loop: true,
        alternate: true,
        autoplay: false,
      });
    });
    // The pairs drawn linked part once (wire off, back to rest), then rest 6 s.
    const linked = this.stillLinked();
    for (const id of linked) {
      const geometry = this.geometry.get(id)!;
      const release = releaseChoreography(geometry);
      // Phone: the second linked pair never lit its port (one cobalt point at most).
      const dark = this.screen === "compact" && id !== linked[0];
      this.run(id, dark ? { ...release, steps: release.steps.filter((step) => step.target !== "portB") } : release, null);
      this.positions.set(id, { a: restOffset(geometry, "a"), b: restOffset(geometry, "b") });
      this.scheduler.hold(id, this.now() + RELEASE_MS);
    }
    this.sync();
  }

  // ---------------------------------------------------------------- schedule

  private clearTimer(): void {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
  }

  private arm(): void {
    this.clearTimer();
    if (this.state !== "playing") return;
    const next = this.scheduler.nextEventAt();
    if (!Number.isFinite(next)) return;
    this.timer = window.setTimeout(() => {
      this.timer = null;
      this.tick();
    }, Math.max(0, next - this.now()));
  }

  private tick(): void {
    if (this.state !== "playing") return;
    const { started } = this.scheduler.tick(this.now());
    for (const exchange of started) this.launch(exchange);
    this.updateCounters();
    this.arm();
  }

  private updateCounters(): void {
    this.field.dataset.exchanges = String(this.scheduler.started);
    this.field.dataset.exchangesActive = String(this.scheduler.active().length);
  }

  private launch(exchange: Exchange): void {
    const geometry = this.geometry.get(exchange.pair);
    if (!geometry) return;
    const start = this.positions.get(exchange.pair) ?? { a: restOffset(geometry, "a"), b: restOffset(geometry, "b") };
    const random = seededRandom(exchange.seed);
    const back = { a: returnPoint(geometry, "a", random, this.quiet), b: returnPoint(geometry, "b", random, this.quiet) };
    this.positions.set(exchange.pair, back);
    this.run(exchange.pair, exchangeChoreography(geometry, start, back), exchange);
  }

  /** One Anime.js timeline for a choreography. */
  private run(id: number, choreography: Choreography, exchange: Exchange | null): void {
    const nodes = this.pairs.get(id);
    if (!nodes) return;
    const target: Record<NanoTarget, HTMLElement> = { a: nodes.a, b: nodes.b, link: nodes.link, bit: nodes.bit, portA: nodes.portA, portB: nodes.portB };
    const timeline = createTimeline({
      autoplay: this.state === "playing",
      onComplete: () => {
        this.timelines.delete(timeline);
        this.setPhase(id, "idle");
      },
    });
    for (const step of choreography.steps) {
      if (step.duration === 0) {
        const values = Object.fromEntries(Object.entries(step.props).map(([property, range]) => [property, range[1]]));
        timeline.set(target[step.target], values, step.at);
      } else {
        const values = Object.fromEntries(Object.entries(step.props).map(([property, range]) => [property, [range[0], range[1]]]));
        timeline.add(target[step.target], { ...values, duration: step.duration, ease: step.ease }, step.at);
      }
    }
    for (const phase of choreography.phases) timeline.call(() => this.setPhase(id, phase.phase), phase.at);
    if (exchange) nodes.root.dataset.exchange = String(exchange.serial);
    this.timelines.add(timeline);
  }

  private setPhase(id: number, phase: NanoPhase): void {
    const nodes = this.pairs.get(id);
    if (!nodes) return;
    nodes.a.dataset.phase = phase;
    nodes.b.dataset.phase = phase;
  }

  // ---------------------------------------------------------------- geometry

  private measure(compact: boolean): void {
    const box = this.field.getBoundingClientRect();
    this.screen = compact ? "compact" : window.innerWidth >= LARGE_MIN_WIDTH ? "large" : "medium";
    this.quiet = Array.from(this.stage.querySelectorAll<HTMLElement>("[data-network-quiet]"))
      .map((element) => element.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0)
      .map((rect) => ({ left: rect.left - box.left, top: rect.top - box.top, right: rect.right - box.left, bottom: rect.bottom - box.top }));
    const free = this.stage.querySelector<HTMLElement>("[data-nano-stage]")?.getBoundingClientRect();
    const enabled: number[] = [];
    this.geometry = new Map();
    for (const seed of PAIR_SEEDS) {
      const nodes = this.pairs.get(seed.id);
      if (!nodes) continue;
      let anchor: Point | null = null;
      if (this.screen !== "compact") anchor = { x: (seed.anchor.x / 100) * box.width, y: (seed.anchor.y / 100) * box.height };
      else if (seed.compactAnchor && free) {
        anchor = { x: free.left - box.left + (seed.compactAnchor.x / 100) * free.width, y: free.top - box.top + (seed.compactAnchor.y / 100) * free.height };
      }
      if (!anchor) {
        nodes.root.dataset.active = "false";
        continue;
      }
      const geometry = resolvePair(seed, anchor, this.screen, this.quiet);
      this.geometry.set(seed.id, geometry);
      if (geometry.active) enabled.push(seed.id);
      nodes.root.dataset.active = String(geometry.active);
      nodes.root.style.left = `${anchor.x}px`;
      nodes.root.style.top = `${anchor.y}px`;
      nodes.root.style.opacity = geometry.shown ? "" : "0";
      const wire = linkOffset(geometry, "a");
      nodes.wire.style.transform = `translate(${wire.x}px, ${wire.y}px) rotate(${geometry.angle}deg)`;
      nodes.link.style.width = `${linkLength(geometry)}px`;
    }
    this.scheduler.setEnabled(enabled);
    this.scheduler.setCompact(this.screen === "compact");
  }

  /** Pairs drawn linked when still: pairs 3 and 4, or the first active ones. */
  private stillLinked(): number[] {
    const order = [...STILL_LINKED_PAIRS, ...PAIR_SEEDS.map((pair) => pair.id).filter((id) => !STILL_LINKED_PAIRS.includes(id))];
    return order.filter((id) => this.geometry.get(id)?.active).slice(0, 2);
  }

  private placeRest(id: number): void {
    const nodes = this.pairs.get(id);
    const geometry = this.geometry.get(id);
    if (!nodes || !geometry) return;
    const a = restOffset(geometry, "a");
    const b = restOffset(geometry, "b");
    utils.set(nodes.a, { translateX: a.x, translateY: a.y, scale: 1, opacity: REST_OPACITY });
    utils.set(nodes.b, { translateX: b.x, translateY: b.y, scale: 1, opacity: REST_OPACITY });
    utils.set([nodes.portA, nodes.portB], { opacity: 0 });
    utils.set(nodes.link, { scaleX: 0, opacity: 0 });
    utils.set(nodes.bit, { translateX: 0, opacity: 0 });
    this.positions.set(id, { a, b });
    this.setPhase(id, "idle");
  }

  /** The still composition: two pairs linked, the bit in the port of B; the others at rest. */
  private placeStill(): void {
    const linked = this.stillLinked();
    for (const id of this.pairs.keys()) {
      this.placeRest(id);
      const nodes = this.pairs.get(id)!;
      const geometry = this.geometry.get(id);
      if (!geometry || !linked.includes(id)) continue;
      const a = linkOffset(geometry, "a");
      const b = linkOffset(geometry, "b");
      utils.set(nodes.a, { translateX: a.x, translateY: a.y, opacity: ENGAGED_OPACITY });
      utils.set(nodes.b, { translateX: b.x, translateY: b.y, opacity: ENGAGED_OPACITY });
      utils.set(nodes.link, { scaleX: 1, opacity: 1 });
      // On a phone, one cobalt point at most: the second linked pair shows its wire only.
      utils.set(nodes.portB, { opacity: this.screen === "compact" && id !== linked[0] ? 0 : 1 });
      this.positions.set(id, { a, b });
      this.setPhase(id, "link");
    }
  }
}
