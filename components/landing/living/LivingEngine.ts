/**
 * Animation loop of the landing living background.
 *
 * One engine, one requestAnimationFrame loop. Time-based (independent of the
 * frame rate), capped steps so a stall never makes the scene jump, paused in a
 * hidden tab and off screen. Under prefers-reduced-motion no loop runs at all:
 * one representative composition is drawn per scene.
 */

import { buildFrame, DEFAULT_SEED, displayedPoints, STATIC_TIME } from "./model";
import { drawFrame, type Palette } from "./renderer";
import type { LivingScene } from "./scenes";
import type { SceneState, Viewport } from "./types";

export type MotionState = "running" | "reduced" | "hidden" | "idle";

export type EngineEnvironment = {
  requestFrame: (callback: (timestamp: number) => void) => number;
  cancelFrame: (id: number) => void;
  now: () => number;
};

export type LivingEngineOptions = {
  scene: LivingScene;
  reduced: boolean;
  palette?: Palette;
  seed?: number;
  env?: EngineEnvironment;
  /** Called when the loop starts, stops or switches to the static composition. */
  onMotion?: (state: MotionState) => void;
  /** Average cost of one frame (ms) over the last 2 s window. */
  onFrameCost?: (milliseconds: number) => void;
};

/** Largest clock step fed to the model, in seconds. */
const MAX_STEP = 0.05;
/** Opacity at rest; scrolling raises it briefly towards 1. */
export const REST_INTENSITY = 0.72;
const BOOST_DECAY_SECONDS = 1.6;
const STATS_WINDOW_MS = 2000;
export const MAX_PIXEL_RATIO = 2;
export const MAX_PIXEL_RATIO_COMPACT = 1.5;

const browserEnvironment: EngineEnvironment = {
  requestFrame: (callback) => window.requestAnimationFrame(callback),
  cancelFrame: (id) => window.cancelAnimationFrame(id),
  now: () => performance.now(),
};

export class LivingEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D | null;
  private readonly env: EngineEnvironment;
  private readonly seed: number;
  private readonly palette?: Palette;
  private readonly onMotion?: (state: MotionState) => void;
  private readonly onFrameCost?: (milliseconds: number) => void;

  private state: SceneState;
  private viewport: Viewport = { width: 0, height: 0, compact: false };
  private pixelRatio = 1;
  private reduced: boolean;
  private hidden = false;
  private offscreen = false;
  private clock = 0;
  private lastTimestamp: number | null = null;
  private frameId: number | null = null;
  private boostLevel = 0;
  private motion: MotionState = "idle";
  private statsStart = 0;
  private statsTotal = 0;
  private statsCount = 0;
  private destroyed = false;

  constructor(canvas: HTMLCanvasElement, options: LivingEngineOptions) {
    this.canvas = canvas;
    this.context = safeContext(canvas);
    this.env = options.env ?? browserEnvironment;
    this.seed = options.seed ?? DEFAULT_SEED;
    this.palette = options.palette;
    this.reduced = options.reduced;
    this.onMotion = options.onMotion;
    this.onFrameCost = options.onFrameCost;
    this.state = { scene: options.scene, since: 0, previous: null, from: null };
  }

  /** Clock of the animation, in seconds (stands still while paused). */
  get time(): number {
    return this.clock;
  }

  get scene(): LivingScene {
    return this.state.scene;
  }

  get motionState(): MotionState {
    return this.motion;
  }

  resize(width: number, height: number, devicePixelRatio: number, compact: boolean) {
    if (this.destroyed) return;
    this.viewport = { width, height, compact };
    this.pixelRatio = Math.max(1, Math.min(devicePixelRatio || 1, compact ? MAX_PIXEL_RATIO_COMPACT : MAX_PIXEL_RATIO));
    this.canvas.width = Math.max(1, Math.round(width * this.pixelRatio));
    this.canvas.height = Math.max(1, Math.round(height * this.pixelRatio));
    this.refresh();
  }

  setScene(scene: LivingScene) {
    if (this.destroyed || scene === this.state.scene) return;
    if (this.reduced) {
      this.state = { scene, since: 0, previous: null, from: null };
      this.refresh();
      return;
    }
    // Start from what is displayed: a quick scroll never makes the path jump.
    const from = this.viewport.width > 0 ? displayedPoints(this.state, this.viewport, this.clock, this.seed) : null;
    this.state = { scene, since: this.clock, previous: from ? this.state.scene : null, from };
    this.refresh();
  }

  setReduced(reduced: boolean) {
    if (this.destroyed || reduced === this.reduced) return;
    this.reduced = reduced;
    if (reduced) this.state = { scene: this.state.scene, since: 0, previous: null, from: null };
    this.refresh();
  }

  setHidden(hidden: boolean) {
    this.hidden = hidden;
    this.refresh();
  }

  setOffscreen(offscreen: boolean) {
    this.offscreen = offscreen;
    this.refresh();
  }

  /** Scrolling: the background gets slightly more present, then calms down. */
  boost() {
    this.boostLevel = 1;
  }

  destroy() {
    this.destroyed = true;
    if (this.frameId !== null) this.env.cancelFrame(this.frameId);
    this.frameId = null;
  }

  private refresh() {
    if (this.destroyed) return;
    if (this.reduced) {
      this.stopLoop();
      this.drawStatic();
      this.setMotion("reduced");
      return;
    }
    const canRun = !this.hidden && !this.offscreen && this.viewport.width > 0;
    if (!canRun) {
      this.stopLoop();
      this.setMotion(this.hidden || this.offscreen ? "hidden" : "idle");
      return;
    }
    if (this.frameId === null) this.frameId = this.env.requestFrame(this.tick);
    this.setMotion("running");
  }

  private stopLoop() {
    if (this.frameId !== null) this.env.cancelFrame(this.frameId);
    this.frameId = null;
    // The next frame restarts from a zero step: no jump after a pause.
    this.lastTimestamp = null;
  }

  private readonly tick = (timestamp: number) => {
    this.frameId = null;
    if (this.destroyed) return;
    const step = this.lastTimestamp === null ? 0 : Math.min(Math.max(timestamp - this.lastTimestamp, 0) / 1000, MAX_STEP);
    this.lastTimestamp = timestamp;
    this.clock += step;
    this.boostLevel = Math.max(0, this.boostLevel - step / BOOST_DECAY_SECONDS);

    const started = this.env.now();
    this.draw(this.clock, this.state, REST_INTENSITY + (1 - REST_INTENSITY) * this.boostLevel);
    this.recordCost(this.env.now() - started, started);

    if (!this.reduced && !this.hidden && !this.offscreen) this.frameId = this.env.requestFrame(this.tick);
  };

  private drawStatic() {
    this.draw(STATIC_TIME, { scene: this.state.scene, since: STATIC_TIME - 60, previous: null, from: null }, REST_INTENSITY);
  }

  private draw(time: number, state: SceneState, intensity: number) {
    if (!this.context || this.viewport.width <= 0) return;
    const frame = buildFrame({ time, state, viewport: this.viewport, seed: this.seed });
    drawFrame(this.context, frame, {
      width: this.viewport.width,
      height: this.viewport.height,
      dpr: this.pixelRatio,
      intensity,
      compact: this.viewport.compact,
      palette: this.palette,
    });
  }

  private recordCost(milliseconds: number, now: number) {
    if (this.statsCount === 0) this.statsStart = now;
    this.statsTotal += milliseconds;
    this.statsCount += 1;
    if (now - this.statsStart >= STATS_WINDOW_MS) {
      this.onFrameCost?.(this.statsTotal / this.statsCount);
      this.statsTotal = 0;
      this.statsCount = 0;
    }
  }

  private setMotion(state: MotionState) {
    if (state === this.motion) return;
    this.motion = state;
    this.onMotion?.(state);
  }
}

/** jsdom and old browsers may not implement the 2D context: stay silent. */
function safeContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  try {
    return canvas.getContext("2d");
  } catch {
    return null;
  }
}
