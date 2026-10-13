import { ADAPTIVE, HANDS_EMPHASIS, HANDS_GROWTH, LIVE_FRAME_STEP, PLANES, PULSE, ROBOT_PORT, ROBOT_TRAIL, resolveTier, type Tier } from "./hero-config";
import { decodeHands, type BakedHands } from "./hands-data";
import { HeroScene } from "./HeroScene";
import { computeLayout, type Rect } from "./layout";
import { SEQUENCE_CAP_MS, SEQUENCE_END_MS, birthOpacity, contactOpacity, phaseAt, type PhaseState } from "./timeline";
import { easeInOutSine } from "./trajectory";
import type { RobotPose } from "./robots";

/**
 * Canvas renderer and loop of the hero particles (docs/design-system.md §2.11.4 ter G, H): one 2D
 * canvas, its own `requestAnimationFrame` loop (Anime.js stays reserved to the DOM). The sequence
 * is played once; the living end state (micro-movement, robots, pulse) is the only loop, drawn at
 * 30 frames/s, and the loop really stops off screen, in a hidden tab and on the user's pause.
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
  private tick = 0;
  private sequenceMs = 0;
  private liveSec = 0;
  private drawCount = 0;
  private drawnPhase = "";
  private lastDataset = -1000;
  private capPublished = false;
  private readonly intervals: number[] = [];
  private readonly costs: number[] = [];
  private readonly work: number[] = [];
  private frames = 0;
  private colors = { ink: "currentColor", canvas: "Canvas", accent: "currentColor" };
  private readonly ghost: RobotPose = { x: 0, y: 0, z: 0, alpha: 0 };

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
    } else if (this.state === "stopped") {
      this.state = "playing";
    }
    this.afterChange();
  }

  setReduced(reduced: boolean): void {
    if (reduced) {
      this.state = "reduced";
      this.jumpToEnd();
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
    this.tick++;
    const living = this.sequenceMs >= SEQUENCE_END_MS;
    if (!living || this.tick % LIVE_FRAME_STEP === 0) {
      this.draw(false);
      const cost = performance.now() - started;
      this.work.push(cost);
      if (this.work.length > 120) this.work.shift();
      this.adapt(cost, living);
    }
    // The clock stops at the end of the sequence: its last value is published at once.
    const capped = this.sequenceMs >= SEQUENCE_CAP_MS;
    this.publish(capped && !this.capPublished, now);
    this.capPublished = capped;
    if (this.running) this.raf = requestAnimationFrame(this.frame);
  };

  /** Adaptive density: mean cost over 30 frames above the budget lowers the points by 25 % (floor 40 %). */
  private adapt(cost: number, living: boolean): void {
    if (living || !this.scene) return;
    this.frames++;
    if (this.frames <= 10) return;
    this.costs.push(cost);
    if (this.costs.length < ADAPTIVE.window) return;
    const mean = this.costs.reduce((sum, value) => sum + value, 0) / this.costs.length;
    this.costs.length = 0;
    const floor = Math.round(this.scene.count * ADAPTIVE.floor);
    if (mean > ADAPTIVE.budgetMs && this.drawCount > floor) this.drawCount = Math.max(floor, Math.round(this.drawCount * ADAPTIVE.step));
  }

  private draw(still: boolean): void {
    const ctx = this.ctx;
    const scene = this.scene;
    const geometry = this.geometry;
    if (!ctx || !scene || !geometry) return;
    if (still && !scene.ready) return;
    const sequenceMs = still ? SEQUENCE_CAP_MS : this.sequenceMs;
    const state = phaseAt(sequenceMs);
    const micro = !still;
    scene.compute(state, sequenceMs, this.liveSec, micro, this.drawCount);
    scene.computeRobots(state, sequenceMs, this.liveSec, still);

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, geometry.width, geometry.height);
    // The final image is drawn a little stronger and larger than the ball: the hands carry the message.
    const handsShare = still ? 1 : state.phase === "hands" ? 1 : state.phase === "to-hands" ? state.progress : 0;
    const birth = (still ? 1 : birthOpacity(sequenceMs)) * (1 + handsShare * HANDS_EMPHASIS);
    const grow = 1 + handsShare * HANDS_GROWTH * (scene.tier.name === "phone" ? 0.4 : 1);
    ctx.fillStyle = this.colors.ink;
    for (let b = 0; b < PLANES.length; b++) {
      const plane = PLANES[b]!;
      const list = scene.buckets[b]!;
      const size = plane.size * grow;
      const half = size / 2;
      ctx.globalAlpha = Math.min(1, plane.alpha * birth);
      ctx.beginPath();
      for (let k = 0, n = scene.bucketSize[b]!; k < n; k++) {
        const i = list[k]!;
        ctx.rect(scene.x[i]! - half, scene.y[i]! - half, size, size);
      }
      ctx.fill();
    }
    this.drawRobots(ctx, scene, state, still);
    this.drawContact(ctx, scene, sequenceMs, still);
    ctx.globalAlpha = 1;
    this.drawnPhase = state.phase;
  }

  private drawRobots(ctx: CanvasRenderingContext2D, scene: HeroScene, state: PhaseState, still: boolean): void {
    const size = scene.tier.robotSize;
    const port = ROBOT_PORT;
    const trails = !still && state.phase === "hands";
    for (let i = 0; i < scene.robots.length; i++) {
      const pose = scene.robots[i]!;
      if (pose.alpha <= 0.01) continue;
      const depth = pose.z < -0.12 ? 0.55 : 1;
      if (trails) {
        ctx.fillStyle = this.colors.ink;
        for (const { gap, alpha } of ROBOT_TRAIL) {
          scene.ghostPose(i, this.liveSec, gap, this.ghost);
          ctx.globalAlpha = alpha * this.ghost.alpha;
          ctx.fillRect(this.ghost.x - 1.5, this.ghost.y - 1.5, 3, 3);
        }
      }
      ctx.globalAlpha = pose.alpha * depth;
      ctx.fillStyle = this.colors.ink;
      ctx.fillRect(pose.x - size / 2, pose.y - size / 2, size, size);
      ctx.fillStyle = this.colors.canvas;
      ctx.fillRect(pose.x - port / 2, pose.y - port / 2, port, port);
    }
  }

  /** The cobalt contact point between the index fingers, then (living only) the ring and the bit. */
  private drawContact(ctx: CanvasRenderingContext2D, scene: HeroScene, sequenceMs: number, still: boolean): void {
    const layout = scene.currentLayout;
    const hands = scene.handsData;
    if (!layout || !hands) return;
    const opacity = still ? 1 : contactOpacity(sequenceMs);
    if (opacity <= 0) return;
    const size = scene.tier.contactSize;
    ctx.fillStyle = this.colors.accent;
    ctx.globalAlpha = opacity;
    ctx.fillRect(layout.contact.x - size / 2, layout.contact.y - size / 2, size, size);
    if (still || this.liveSec < SEQUENCE_END_MS / 1000 + 0.4) return;
    const t = (this.liveSec - (SEQUENCE_END_MS / 1000 + 0.4)) % PULSE.period;
    if (t < PULSE.ring) {
      const q = t / PULSE.ring;
      ctx.globalAlpha = 0.6 * (1 - q);
      ctx.strokeStyle = this.colors.accent;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(layout.contact.x, layout.contact.y, PULSE.ringFrom + (PULSE.ringTo - PULSE.ringFrom) * q, 0, Math.PI * 2);
      ctx.stroke();
    }
    const bit = (t - PULSE.bitDelay) / PULSE.bitDuration;
    if (bit >= 0 && bit <= 1) {
      const place = layout.hands;
      const a = hands.tips.left;
      const b = hands.tips.right;
      const e = easeInOutSine(bit);
      const x = place.cx + (a[0] + (b[0] - a[0]) * e) * place.sx;
      const y = place.cy + (a[1] + (b[1] - a[1]) * e) * place.sy;
      ctx.globalAlpha = 1;
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
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
    dataset.points = String(this.scene && (this.state === "playing" || this.state === "paused" || this.drawnPhase) ? this.drawCount : 0);
    if (this.intervals.length >= 20) {
      dataset.frameP95 = percentile(this.intervals, 0.95).toFixed(1);
      dataset.frameMs = percentile(this.work, 0.75).toFixed(2);
    }
  }
}
