import { ADAPTIVE, LIVE_WORK_BUDGET_MS, resolveTier, type Tier } from "./hero-config";
import { decodeHands, type BakedHands } from "./hands-data";
import { HeroScene } from "./HeroScene";
import { handsShareOf, paintContact, paintPoints, paintRobots, type PaintStats, type Palette } from "./hero-paint";
import { computeLayout, type Rect } from "./layout";
import { SEQUENCE_CAP_MS, SEQUENCE_END_MS, birthOpacity, contactOpacity, phaseAt } from "./timeline";

/**
 * Canvas renderer and loop of the hero particles (docs/design-system.md §2.11.4 ter G, H): one 2D
 * canvas, its own `requestAnimationFrame` loop (Anime.js stays reserved to the DOM). The sequence
 * is played once; then the living act (the second animation: the two index fingers that reach
 * towards each other, §2.11.4 ter S) is the only loop, drawn at 60 frames/s on a computer, and it
 * really stops off screen, in a hidden tab and on the user's pause.
 * Colours are read from the CSS tokens of the canvas.
 */

export type EngineState = "playing" | "paused" | "stopped" | "reduced";

export type StageGeometry = { readonly width: number; readonly height: number; readonly zone: Rect; readonly coarsePointer: boolean };

/** Percentile of a ring of numbers (copy sorted): small, called once per second. */
export function percentile(values: readonly number[], share: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(share * sorted.length))]!;
}

export class HeroParticleEngine {
  private ctx: CanvasRenderingContext2D | null;
  private scene: HeroScene | null = null;
  private baked: BakedHands | null = null;
  private geometry: StageGeometry | null = null;
  private dpr = 1;
  private state: EngineState;
  private visible = true;
  private pageVisible = true;
  private disposed = false;
  private raf = 0;
  private lastTick = 0;
  private sequenceMs = 0;
  private liveSec = 0;
  /** Seconds since the living act began (the second animation); frozen with the loop. */
  private actSec = 0;
  private liveFrames = 0;
  private liveStep = 1;
  private readonly liveWork: number[] = [];
  private lastGap = -1000;
  private drawCount = 0;
  private drawnPhase = "";
  private lastDataset = -1000;
  private capPublished = false;
  private readonly intervals: number[] = [];
  private readonly costs: number[] = [];
  private readonly work: number[] = [];
  private frames = 0;
  private colors: Palette = { ink: "currentColor", canvas: "Canvas", accent: "currentColor" };
  private readonly stats: PaintStats = { robots: 0, cobalt: 0 };

  constructor(
    private readonly canvas: HTMLCanvasElement,
    reduced: boolean,
  ) {
    this.ctx = canvas.getContext("2d");
    this.state = reduced ? "reduced" : "playing";
    this.readColors();
    this.publish(true, 0);
  }

  private readColors(): void {
    const style = getComputedStyle(this.canvas);
    const token = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
    this.colors = { ink: token("--color-ink", style.color), canvas: token("--color-canvas", "Canvas"), accent: token("--color-accent", style.color) };
  }

  /** First geometry (or a new one: resize, breakpoint). The sequence time is kept. */
  setGeometry(geometry: StageGeometry): void {
    if (this.disposed) return;
    this.geometry = geometry;
    const tier = resolveTier(geometry.width, geometry.coarsePointer);
    this.dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, tier.dprCap));
    this.canvas.width = Math.max(1, Math.round(geometry.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(geometry.height * this.dpr));
    if (!this.scene || this.scene.tier.name !== tier.name) this.buildScene(tier);
    this.liveStep = Math.max(this.liveStep, tier.liveFrameStep);
    this.scene!.setLayout(computeLayout(geometry.width, geometry.height, geometry.zone, tier));
    this.afterChange();
  }

  private buildScene(tier: Tier): void {
    this.scene = new HeroScene(tier);
    this.drawCount = tier.points;
    this.costs.length = 0;
    if (this.baked) this.scene.setHands(decodeHands(this.baked, tier.points));
  }

  /** The baked hands arrived (dynamic import). */
  setHands(baked: BakedHands): void {
    if (this.disposed) return;
    this.baked = baked;
    this.scene?.setHands(decodeHands(baked, this.scene.count));
    this.afterChange();
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.afterChange();
  }

  setPageVisible(visible: boolean): void {
    this.pageVisible = visible;
    this.afterChange();
  }

  /** The user's pause (the terminal button): the final image, still. « Reprendre » only revives the end state. */
  setStopped(stopped: boolean): void {
    if (this.state === "reduced") return;
    if (stopped) {
      this.state = "stopped";
      this.jumpToEnd();
      // « Reprendre » restarts the cycle at its beginning (S.9).
      this.actSec = 0;
    } else if (this.state === "stopped") {
      this.state = "playing";
    }
    this.afterChange();
  }

  setReduced(reduced: boolean): void {
    if (reduced) {
      this.state = "reduced";
      this.jumpToEnd();
      this.actSec = 0;
    } else if (this.state === "reduced") {
      this.state = "playing";
    }
    this.afterChange();
  }

  /** « Rejouer les animations »: back to the cloud, the sequence starts again. */
  replay(): void {
    if (this.state === "reduced") return;
    this.state = "playing";
    this.sequenceMs = 0;
    this.liveSec = 0;
    this.actSec = 0;
    this.liveFrames = 0;
    this.liveWork.length = 0;
    this.scene?.resetLive();
    this.capPublished = false;
    this.drawnPhase = "cloud";
    this.afterChange();
  }

  private jumpToEnd(): void {
    this.sequenceMs = SEQUENCE_CAP_MS;
    this.liveSec = Math.max(this.liveSec, SEQUENCE_CAP_MS / 1000);
  }

  dispose(): void {
    this.disposed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private get running(): boolean {
    return this.state === "playing" && this.visible && this.pageVisible && !this.disposed && this.scene !== null;
  }

  /** Reconciles the loop with the state: starts or stops it, redraws a still image. */
  private afterChange(): void {
    if (this.disposed || !this.geometry || !this.scene) return;
    if (this.state === "playing" && !this.visible) this.publishState("paused");
    else if (this.state === "playing" && !this.pageVisible) this.publishState("paused");
    else this.publishState(this.state);
    if (this.running) {
      if (!this.raf) {
        this.lastTick = 0;
        this.raf = requestAnimationFrame(this.frame);
      }
      return;
    }
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    // A still image (stopped, reduced) is redrawn on every change; a paused loop keeps its last frame.
    if (this.state === "stopped" || this.state === "reduced") this.draw(true);
    this.publish(true, this.lastTick);
  }

  private readonly frame = (now: number): void => {
    this.raf = 0;
    if (!this.running) return;
    const started = performance.now();
    const gap = this.lastTick ? now - this.lastTick : 16.7;
    this.lastTick = now;
    if (gap < 100) this.intervals.push(gap);
    if (this.intervals.length > 120) this.intervals.shift();
    const dt = Math.min(gap, 50);
    this.liveSec += dt / 1000;
    const hold = this.scene!.holdMs;
    this.sequenceMs = Math.min(SEQUENCE_CAP_MS, hold, this.sequenceMs + dt);
    const living = this.sequenceMs >= SEQUENCE_END_MS;
    if (living) this.actSec += dt / 1000;
    // The living act is drawn every frame (60/s) on a computer, every other one on a phone or when the work exceeds its budget (S.10).
    if (!living || ++this.liveFrames % this.liveStep === 0) {
      this.draw(false);
      const cost = performance.now() - started;
      this.work.push(cost);
      if (this.work.length > 120) this.work.shift();
      if (living) this.watchBudget(cost);
      else this.adapt(cost);
    }
    // The clock stops at the end of the sequence: its last value is published at once.
    const capped = this.sequenceMs >= SEQUENCE_CAP_MS;
    this.publish(capped && !this.capPublished, now);
    this.capPublished = capped;
    if (this.running) this.raf = requestAnimationFrame(this.frame);
  };

  /** Adaptive density: mean cost over 30 frames above the budget lowers the points by 25 % (floor 40 %). */
  private adapt(cost: number): void {
    if (!this.scene) return;
    this.frames++;
    if (this.frames <= 10) return;
    this.costs.push(cost);
    if (this.costs.length < ADAPTIVE.window) return;
    const mean = this.costs.reduce((sum, value) => sum + value, 0) / this.costs.length;
    this.costs.length = 0;
    const floor = Math.round(this.scene.count * ADAPTIVE.floor);
    if (mean > ADAPTIVE.budgetMs && this.drawCount > floor) this.drawCount = Math.max(floor, Math.round(this.drawCount * ADAPTIVE.step));
  }

  /** Living act: if the work of the last 120 images exceeds its budget at the 75th percentile, fall back to 30 images/s. */
  private watchBudget(cost: number): void {
    this.liveWork.push(cost);
    if (this.liveWork.length > 120) this.liveWork.shift();
    if (this.liveStep === 1 && this.liveWork.length >= 120 && percentile(this.liveWork, 0.75) > LIVE_WORK_BUDGET_MS) this.liveStep = 2;
  }

  private draw(still: boolean): void {
    const ctx = this.ctx;
    const scene = this.scene;
    const geometry = this.geometry;
    if (!ctx || !scene || !geometry) return;
    if (still && !scene.ready) return;
    const sequenceMs = still ? SEQUENCE_CAP_MS : this.sequenceMs;
    const state = phaseAt(sequenceMs);
    // The second animation runs from the end of the opening; a still image shows the rest position.
    const moving = !still && sequenceMs >= SEQUENCE_END_MS;
    scene.updateLive(this.actSec, moving);
    scene.compute(state, sequenceMs, this.liveSec, !still, this.drawCount);
    scene.computeRobots(state, sequenceMs, this.liveSec, still);

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, geometry.width, geometry.height);
    const share = handsShareOf(state, still);
    this.stats.cobalt = 0;
    paintPoints(ctx, scene, this.colors, share, still ? 1 : birthOpacity(sequenceMs));
    paintRobots(ctx, scene, this.colors, state, share, still, this.stats);
    paintContact(ctx, scene, this.colors, still ? 1 : contactOpacity(sequenceMs), still, this.stats);
    ctx.globalAlpha = 1;
    this.drawnPhase = state.phase;
  }

  private publishState(state: EngineState): void {
    this.canvas.dataset.state = state;
  }

  /** Mirrors the engine on the canvas attributes the tests read. */
  private publish(force: boolean, now: number): void {
    const dataset = this.canvas.dataset;
    if (this.drawnPhase && dataset.phase !== this.drawnPhase) dataset.phase = this.drawnPhase;
    if (!force && now - this.lastDataset < 100) return;
    this.lastDataset = now;
    dataset.sequenceMs = String(Math.round(this.sequenceMs));
    // The second animation (S.2): the act, the step and the number of the cycle, the gap between the tips (4 times a second).
    const live = this.scene?.live;
    // A still image (pause, reduced motion) is the image of rest of the living act.
    dataset.act = this.sequenceMs >= SEQUENCE_END_MS || this.state === "reduced" || this.state === "stopped" ? "live" : "intro";
    dataset.liveStep = live && dataset.act === "live" ? live.step : "rest";
    dataset.liveCycle = String(live && dataset.act === "live" ? live.cycle : 0);
    dataset.robots = String(this.stats.robots);
    dataset.cobalt = String(this.stats.cobalt);
    dataset.liveFrameStep = String(this.liveStep);
    if (live && live.g0 > 0 && (force || now - this.lastGap >= 250)) {
      this.lastGap = now;
      dataset.tipGap = live.gap.toFixed(1);
      dataset.tipGapRest = live.g0.toFixed(1);
      dataset.tipGapNear = live.g1.toFixed(1);
    }
    dataset.points = String(this.scene && (this.state === "playing" || this.state === "paused" || this.drawnPhase) ? this.drawCount : 0);
    if (this.intervals.length >= 20) {
      dataset.frameP95 = percentile(this.intervals, 0.95).toFixed(1);
      dataset.frameMs = percentile(this.work, 0.75).toFixed(2);
    }
  }
}
