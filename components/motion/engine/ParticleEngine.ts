import { SHAPES, type ParticlePreset } from "../shapes";
import { POINT_STRIDE } from "../shapes/types";
import {
  ADAPTIVE_FRAME_BUDGET_MS,
  ADAPTIVE_WINDOW_MS,
  backgroundBudget,
  capPixelRatio,
  computeRegionFit,
  createFit,
  FULL_REGION,
  MAX_PARTICLES,
  nextAdaptiveCount,
  resolveParticleCount,
  type Region,
} from "./layout";
import { DEFAULT_TRANSITION_MS, Morph } from "./morph";
import { createSeeds } from "./prng";
import { projectShape } from "./project";
import { BACKGROUND_OPACITY, PointRenderer, ZONE_OPACITY, type DrawParams } from "./renderer";

export type ParticleDensity = number | "auto";

/**
 * "zone": a bounded decorative area (preview, header); count follows the zone size.
 * "background": one fixed canvas behind the whole page (spec §9); count follows the
 * viewport width (6 000 / 4 000 / 1 800), opacities .08–.35, adaptive density.
 */
export type ParticleMode = "zone" | "background";

export type ParticleEngineOptions = {
  preset: ParticlePreset;
  mode?: ParticleMode;
  /** Particle count, or "auto" (default) for the size of the zone / the viewport budget. */
  density?: ParticleDensity;
  /** Opacity multiplier, 1 by default (the output range of the mode is never exceeded). */
  intensity?: number;
  paused?: boolean;
  /** Part of the canvas the shape fits into (normalised). Whole canvas by default. */
  region?: Region;
  /** Lower the count by steps of 25 % when frames average more than 8 ms. Default: on in background mode. */
  adaptive?: boolean;
};

export type TransitionOptions = { durationMs?: number };

/** What the loop is doing, mirrored on `canvas.dataset.motion` for tests. */
export type MotionState = "running" | "transition" | "static" | "reduced" | "hidden";

/** Largest frame step fed to the clock: after a stall the motion resumes, never jumps. */
const MAX_STEP_MS = 50;
/** Free space (CSS px) around every shape: no point is ever cut at the edges. */
const PADDING = 6;
/** Relative change of the automatic count that justifies re-seeding the zone. */
const RECOUNT_THRESHOLD = 0.2;
/** Particles removed from the count fade out in place over this duration. */
const FADE_OUT_MS = 600;
const LARGE_AREA = 160_000;
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const MOBILE = "(max-width: 767px), (pointer: coarse)";

/**
 * Canvas 2D particle engine: one requestAnimationFrame loop per instance,
 * buffers allocated once, time-based motion (independent of the frame rate),
 * paused off-screen, in a hidden tab and under prefers-reduced-motion (a single
 * static frame is drawn instead). Purely decorative.
 */
export class ParticleEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D | null;
  private readonly seeds = createSeeds(MAX_PARTICLES);
  private target = new Float32Array(MAX_PARTICLES * POINT_STRIDE);
  private display = new Float32Array(MAX_PARTICLES * POINT_STRIDE);
  private readonly morph = new Morph(MAX_PARTICLES);
  private readonly renderer = new PointRenderer(MAX_PARTICLES);
  private readonly fit = createFit();
  private readonly drawParams: DrawParams;
  private readonly reducedQuery: MediaQueryList;
  private readonly mobileQuery: MediaQueryList;
  private readonly resizeObserver: ResizeObserver;
  private readonly intersectionObserver: IntersectionObserver;
  private readonly mode: ParticleMode;
  private readonly adaptive: boolean;

  private currentPreset: ParticlePreset;
  private density: ParticleDensity;
  private intensity: number;
  private paused: boolean;
  private region: Region;
  private frozenTime: number | null = null;
  private count = 0;
  /** Count before any adaptive reduction (background budget or zone count). */
  private budget = 0;
  /** Adaptive ceiling; Infinity until the first reduction. */
  private adaptiveCap = Number.POSITIVE_INFINITY;
  private width = 0;
  private height = 0;
  private ratio = 1;
  private clock = 0;
  private lastFrame = 0;
  private frame = 0;
  private visible = true;
  private hasDrawn = false;
  private destroyed = false;
  private motionState: MotionState | null = null;
  /** Newcomers [spawnStart, spawnEnd) still waiting for their target position. */
  private spawnStart = 0;
  private spawnEnd = 0;
  /** Particles [count, fadeEnd) fading out since fadeStart. */
  private fadeEnd = 0;
  private fadeStart = 0;
  /** Frame cost measurement window (CPU time spent in the frame, not the refresh interval). */
  private windowStart = 0;
  private windowWork = 0;
  private windowFrames = 0;
  private lastAverage = 0;

  constructor(canvas: HTMLCanvasElement, options: ParticleEngineOptions) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.currentPreset = options.preset;
    this.mode = options.mode ?? "zone";
    this.adaptive = options.adaptive ?? this.mode === "background";
    this.density = options.density ?? "auto";
    this.intensity = options.intensity ?? 1;
    this.paused = options.paused ?? false;
    this.region = options.region ?? FULL_REGION;
    this.drawParams = {
      count: 0,
      width: 0,
      height: 0,
      intensity: this.intensity,
      minSize: 0.4,
      sizeRange: 0.5,
      opacity: this.mode === "background" ? BACKGROUND_OPACITY : ZONE_OPACITY,
      fadeEnd: 0,
      fade: 0,
    };
    this.reducedQuery = window.matchMedia(REDUCED_MOTION);
    this.mobileQuery = window.matchMedia(MOBILE);
    this.resizeObserver = new ResizeObserver(this.handleResize);
    this.intersectionObserver = new IntersectionObserver(this.handleIntersection);
    this.resizeObserver.observe(canvas);
    this.intersectionObserver.observe(canvas);
    this.reducedQuery.addEventListener("change", this.handleWake);
    document.addEventListener("visibilitychange", this.handleWake);
    canvas.dataset.mode = this.mode;
    this.handleResize();
  }

  get preset(): ParticlePreset {
    return this.currentPreset;
  }

  /** Shape clock in seconds (frozen time when set). */
  get time(): number {
    return this.frozenTime ?? this.clock;
  }

  get particleCount(): number {
    return this.count;
  }

  /** Average CPU time of a frame (ms) over the last complete 2 s window, 0 before the first one. */
  get averageFrameMs(): number {
    return this.lastAverage;
  }

  /**
   * Morphs from the positions currently displayed to `preset` (spec §5):
   * slight deterministic dispersion, soft ease, 850 ms by default (clamped to
   * 700–1 000 ms). Calling it again mid-way restarts from what is on screen
   * towards the latest preset. Instantaneous under reduced motion or when the
   * canvas is not visible. Never blocks anything: it only records the request.
   */
  transitionTo(preset: ParticlePreset, options: TransitionOptions = {}): void {
    if (this.destroyed) return;
    // Already the destination (displayed or on its way): nothing to restart.
    if (preset === this.currentPreset) return;
    this.currentPreset = preset;
    this.clock = 0;
    this.updateFit();
    if (this.hasDrawn && this.canMove()) {
      const duration = Math.min(1_000, Math.max(700, options.durationMs ?? DEFAULT_TRANSITION_MS));
      this.morph.begin(this.display, this.count, performance.now(), duration);
    } else {
      this.morph.active = false;
    }
    this.requestFrame();
  }

  setPaused(paused: boolean): void {
    if (paused === this.paused) return;
    this.paused = paused;
    this.requestFrame();
  }

  setIntensity(intensity: number): void {
    if (intensity === this.intensity) return;
    this.intensity = intensity;
    this.drawParams.intensity = intensity;
    this.requestFrame();
  }

  setDensity(density: ParticleDensity): void {
    if (density === this.density) return;
    this.density = density;
    this.adaptiveCap = Number.POSITIVE_INFINITY;
    this.recount(true);
  }

  /** Moves the shape to another part of the canvas (normalised), morphing from what is displayed. */
  setRegion(region: Region): void {
    const current = this.region;
    if (region.x === current.x && region.y === current.y && region.width === current.width && region.height === current.height) return;
    this.region = { ...region };
    this.updateFit();
    if (this.hasDrawn && this.canMove()) this.morph.begin(this.display, this.count, performance.now(), DEFAULT_TRANSITION_MS, 0);
    this.requestFrame();
  }

  /** Development aid: pins the shape clock to `time` seconds (null resumes). */
  setFrozenTime(time: number | null): void {
    if (time === this.frozenTime) return;
    if (time === null) this.clock = this.frozenTime ?? this.clock;
    this.frozenTime = time;
    this.requestFrame();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.resizeObserver.disconnect();
    this.intersectionObserver.disconnect();
    this.reducedQuery.removeEventListener("change", this.handleWake);
    document.removeEventListener("visibilitychange", this.handleWake);
  }

  private canMove(): boolean {
    return this.visible && !document.hidden && !this.reducedQuery.matches;
  }

  private fading(now: number): boolean {
    return this.fadeEnd > this.count && now - this.fadeStart < FADE_OUT_MS;
  }

  private shouldLoop(now: number): boolean {
    return this.canMove() && (this.morph.active || this.fading(now) || (!this.paused && this.frozenTime === null));
  }

  private requestFrame(): void {
    if (this.destroyed || this.frame || !this.visible || document.hidden) return;
    this.frame = requestAnimationFrame(this.tick);
  }

  private readonly tick = (now: number): void => {
    this.frame = 0;
    if (this.destroyed || !this.context || this.width === 0 || this.height === 0) return;
    const workStart = performance.now();
    const reduced = this.reducedQuery.matches;
    const step = this.lastFrame ? Math.min(now - this.lastFrame, MAX_STEP_MS) : 0;
    this.lastFrame = now;
    if (!reduced && !this.paused && this.frozenTime === null) this.clock += step / 1000;

    const definition = SHAPES[this.currentPreset];
    const time = reduced ? definition.staticTime : (this.frozenTime ?? this.clock);
    projectShape(definition, this.count, time, this.seeds, this.fit, this.target);
    if (this.spawnEnd > this.spawnStart) {
      this.morph.fadeInAt(this.target, this.spawnStart, Math.min(this.spawnEnd, this.count));
      this.spawnStart = this.spawnEnd = 0;
    }
    if (this.morph.active && !reduced) {
      this.morph.blend(this.target, this.seeds, this.count, now, PADDING / this.width, PADDING / this.height, this.display);
    } else {
      this.morph.active = false;
      const swap = this.display;
      this.display = this.target;
      this.target = swap;
    }

    const fading = !reduced && this.fading(now);
    if (!fading) this.fadeEnd = 0;
    const params = this.drawParams;
    params.count = this.count;
    params.width = this.width;
    params.height = this.height;
    params.fadeEnd = this.fadeEnd;
    params.fade = fading ? 1 - (now - this.fadeStart) / FADE_OUT_MS : 0;
    const large = this.mode === "background" || this.width * this.height >= LARGE_AREA;
    params.minSize = large ? 0.55 : 0.4;
    params.sizeRange = large ? 0.55 : 0.5;
    this.context.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    this.renderer.draw(this.context, this.display, this.seeds, params);
    this.hasDrawn = true;

    const loop = this.shouldLoop(now);
    this.setMotionState(reduced ? "reduced" : this.morph.active ? "transition" : loop ? "running" : "static");
    if (loop) {
      // Schedule first: an adaptive recount below must find the loop already running.
      this.frame = requestAnimationFrame(this.tick);
      // Only steady frames count: a transition or a fade-out would bias the average upwards.
      if (this.morph.active || fading) this.windowStart = 0;
      else this.measure(now, performance.now() - workStart);
    } else {
      this.lastFrame = 0;
      this.windowStart = 0;
    }
  };

  /** Averages the frame cost over 2 s windows; lowers the density by 25 % when over budget (spec §9). */
  private measure(now: number, workMs: number): void {
    if (!this.windowStart) {
      this.windowStart = now;
      this.windowWork = 0;
      this.windowFrames = 0;
      return;
    }
    this.windowWork += workMs;
    this.windowFrames += 1;
    if (now - this.windowStart < ADAPTIVE_WINDOW_MS) return;
    this.lastAverage = this.windowWork / Math.max(1, this.windowFrames);
    this.canvas.dataset.frameMs = this.lastAverage.toFixed(2);
    this.windowStart = 0;
    if (!this.adaptive || this.lastAverage <= ADAPTIVE_FRAME_BUDGET_MS) return;
    const next = nextAdaptiveCount(this.count, this.budget);
    if (next >= this.count) return;
    this.adaptiveCap = next;
    this.recount(true, now);
  }

  private setMotionState(state: MotionState): void {
    if (state === this.motionState) return;
    this.motionState = state;
    this.canvas.dataset.motion = state;
  }

  private updateFit(): void {
    const definition = SHAPES[this.currentPreset];
    computeRegionFit(definition.bounds, definition.maxStretch, this.width, this.height, PADDING, this.region, this.fit);
  }

  private resolveBudget(): number {
    if (this.mode === "background") {
      const budget = backgroundBudget(window.innerWidth || this.width);
      return this.density === "auto" ? budget : Math.max(200, Math.min(budget, Math.round(this.density)));
    }
    return resolveParticleCount(this.density, this.width, this.height, this.mobileQuery.matches);
  }

  private recount(animate: boolean, now = performance.now()): void {
    if (this.width === 0 || this.height === 0) return;
    this.budget = this.resolveBudget();
    const next = Math.min(this.budget, this.adaptiveCap);
    if (next === this.count) return;
    const previous = this.count;
    const shrinking = next < previous;
    if (this.mode === "zone" && this.density === "auto" && this.adaptiveCap === Number.POSITIVE_INFINITY && previous > 0 && Math.abs(next - previous) / previous < RECOUNT_THRESHOLD) return;
    const moving = animate && this.hasDrawn && this.canMove();
    if (shrinking && moving) {
      // Removed particles stay where they are (in both buffers) and fade out.
      const from = next * POINT_STRIDE;
      const to = previous * POINT_STRIDE;
      for (let k = from; k < to; k++) this.target[k] = this.display[k] ?? 0;
      this.fadeEnd = previous;
      this.fadeStart = now;
    } else if (!shrinking) {
      this.fadeEnd = 0;
      for (let i = previous; i < next; i++) this.display[i * POINT_STRIDE + 2] = 0;
      this.spawnStart = previous;
      this.spawnEnd = next;
    }
    this.count = next;
    this.canvas.dataset.count = String(next);
    // Shape layouts may depend on the count (grid): survivors morph, newcomers fade in.
    if (moving) this.morph.begin(this.display, this.count, now, DEFAULT_TRANSITION_MS, 0);
    this.windowStart = 0;
    this.requestFrame();
  }

  private readonly handleResize = (): void => {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    this.ratio = capPixelRatio(window.devicePixelRatio || 1, window.innerWidth || width);
    this.canvas.width = Math.max(1, Math.round(width * this.ratio));
    this.canvas.height = Math.max(1, Math.round(height * this.ratio));
    this.updateFit();
    this.recount(this.hasDrawn);
    // Resizing the canvas clears it: redraw even when the loop is idle.
    this.requestFrame();
  };

  private readonly handleIntersection = (entries: IntersectionObserverEntry[]): void => {
    const entry = entries[entries.length - 1];
    this.visible = entry ? entry.isIntersecting : true;
    this.handleWake();
  };

  private readonly handleWake = (): void => {
    this.lastFrame = 0;
    this.windowStart = 0;
    if (!this.visible || document.hidden) {
      if (this.frame) cancelAnimationFrame(this.frame);
      this.frame = 0;
      this.setMotionState("hidden");
      return;
    }
    this.requestFrame();
  };
}
