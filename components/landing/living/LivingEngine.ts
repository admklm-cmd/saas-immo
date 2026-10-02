/**
 * Engine of the landing neural network background (docs/design-system.md
 * §2.11.4).
 *
 * States: `idle` (drawn at rest, arrival not played yet) → `sequence` (bounded
 * cascade of impulses) → `settled` (still, nothing scheduled); `camera` while
 * the camera follows a scroll; `reduced` (one fixed pose, one drawing, never a
 * frame); `hidden` (tab hidden: nothing runs, what was in flight is dropped).
 *
 * A requestAnimationFrame loop runs ONLY during a sequence or a camera move:
 * at rest there is no frame request and no timer at all.
 */

import {
  approach,
  createProjector,
  poseFromProgress,
  projectInto,
  REDUCED_POSE,
  SEQUENCE_DRIFT,
  sequenceDrift,
  setProjector,
  type Pose,
} from "./camera";
import { CENTER_OFFSET_CAP, centerOffset, EDGE_FADE } from "./composition";
import { FrameCostWindow, type FrameCost } from "./frame-cost";
import { buildNetwork, CLASS_BUDGET, fingerprint, STEP_DENSITY, type Network, type ScreenClass } from "./network";
import { createQuietZones, type QuietZones } from "./quiet";
import { DEFAULT_SEED } from "./random";
import type { LivingScene } from "./scenes";
import type { PaintInput, PaintStats } from "./renderer";
import { SignalField, type SequenceName } from "./signals";

export type { FrameCost } from "./frame-cost";

export type MotionState = "idle" | "sequence" | "camera" | "settled" | "reduced" | "hidden";

export type EngineEnvironment = {
  requestFrame: (callback: (timestamp: number) => void) => number;
  cancelFrame: (id: number) => void;
  /** Milliseconds, monotonic. */
  now: () => number;
};

/** What the engine needs from a painter (the canvas one, or a recorder in tests). */
export type Painter = {
  resize: (width: number, height: number, dpr: number) => void;
  setNetwork: (network: Network) => void;
  paint: (input: PaintInput) => PaintStats;
};

export type EngineStats = {
  frames: number;
  signals: number;
  lit: number;
  sequences: readonly SequenceName[];
};

export type LivingEngineOptions = {
  reduced: boolean;
  painter: Painter;
  seed?: number;
  env?: EngineEnvironment;
  /**
   * Fills the quiet zones (text blocks, read at each active frame) and the
   * opaque surfaces (read when a sequence picks its origin).
   */
  readZones?: (quiet: QuietZones, covers: QuietZones) => void;
  onMotion?: (state: MotionState) => void;
  onStats?: (stats: EngineStats) => void;
  onFrameCost?: (cost: FrameCost) => void;
  /** Fallbacks of §2.11.4 (« Replis »), in this order: drift → 0, steps 65 → 45, large 34 → 30. */
  drift?: number;
  stepDensity?: number;
  largeNeurons?: number;
  /** Recentring cap, fraction of W (§2.11.4 lever 3; contrast fallback 0.06). */
  centerOffsetCap?: number;
  /** Edge fade used to weigh the ink when recentring: must match the painter's. */
  edgeFade?: number;
};

export const MAX_PIXEL_RATIO = 2;
export const MAX_PIXEL_RATIO_COMPACT = 1.5;
/** Largest step fed to the camera smoothing, seconds (a stalled frame never jumps). */
const MAX_STEP_SECONDS = 0.1;

const browserEnvironment: EngineEnvironment = {
  requestFrame: (callback) => window.requestAnimationFrame(callback),
  cancelFrame: (id) => window.cancelAnimationFrame(id),
  now: () => performance.now(),
};

export class LivingEngine {
  private readonly env: EngineEnvironment;
  private readonly painter: Painter;
  private readonly seed: number;
  private readonly drift: number;
  private readonly stepDensity: number;
  private readonly largeNeurons: number | undefined;
  private readonly centerOffsetCap: number;
  private readonly edgeFade: number;
  /** Shift of the projection centre (CSS px), computed on resize only. */
  private offsetX = 0;
  private readonly readZones?: (quiet: QuietZones, covers: QuietZones) => void;
  private readonly onMotion?: (state: MotionState) => void;
  private readonly onStats?: (stats: EngineStats) => void;

  private network: Network | null = null;
  private field: SignalField | null = null;
  private screenClass: ScreenClass | null = null;
  private width = 0;
  private height = 0;
  private reduced: boolean;
  private hidden = false;
  private destroyed = false;

  private readonly target: Pose = { ...REDUCED_POSE };
  private readonly pose: Pose = { ...REDUCED_POSE };
  private hasTarget = false;
  private readonly projector = createProjector();
  private readonly zones = createQuietZones();
  private readonly covers = createQuietZones();
  private readonly emptyZones = createQuietZones();
  private nodeScreen = new Float32Array(0);
  private readonly nodeX: number[] = [];
  private readonly nodeY: number[] = [];

  private frameId: number | null = null;
  private lastFrame: number | null = null;
  private motion: MotionState | null = null;
  private frames = 0;
  private readonly costs: FrameCostWindow;

  constructor(options: LivingEngineOptions) {
    this.env = options.env ?? browserEnvironment;
    this.painter = options.painter;
    this.seed = options.seed ?? DEFAULT_SEED;
    this.reduced = options.reduced;
    this.drift = options.drift ?? SEQUENCE_DRIFT;
    this.stepDensity = options.stepDensity ?? STEP_DENSITY;
    this.largeNeurons = options.largeNeurons;
    this.centerOffsetCap = options.centerOffsetCap ?? CENTER_OFFSET_CAP;
    this.edgeFade = options.edgeFade ?? EDGE_FADE;
    this.readZones = options.readZones;
    this.onMotion = options.onMotion;
    this.onStats = options.onStats;
    this.costs = new FrameCostWindow(options.onFrameCost);
  }

  get motionState(): MotionState {
    return this.motion ?? "idle";
  }

  get frameCount(): number {
    return this.frames;
  }

  get currentNetwork(): Network | null {
    return this.network;
  }

  /** Recentring shift of the projection centre, CSS px (tests, `data-center-offset`). */
  get projectionOffset(): number {
    return this.offsetX;
  }

  get geometry(): string {
    return this.network ? fingerprint(this.network) : "";
  }

  /** True while a frame is requested (tests). */
  get looping(): boolean {
    return this.frameId !== null;
  }

  get signalField(): SignalField | null {
    return this.field;
  }

  resize(width: number, height: number, devicePixelRatio: number, screenClass: ScreenClass): void {
    if (this.destroyed) return;
    this.width = width;
    this.height = height;
    const cap = screenClass === "compact" ? MAX_PIXEL_RATIO_COMPACT : MAX_PIXEL_RATIO;
    const dpr = Math.max(1, Math.min(devicePixelRatio || 1, cap));
    this.painter.resize(width, height, dpr);
    if (screenClass !== this.screenClass || !this.network) {
      // A new class is a new network; a mere resize only re-projects it.
      this.screenClass = screenClass;
      const network = buildNetwork({
        seed: this.seed,
        screenClass,
        stepDensity: this.stepDensity,
        neurons: screenClass === "large" ? this.largeNeurons : undefined,
      });
      const previous = this.field;
      this.network = network;
      this.field = new SignalField(network, CLASS_BUDGET[screenClass].maxSignals, this.seed);
      // Sequences already played are never replayed with the new network.
      for (const name of previous?.playedNames() ?? []) this.field.markPlayed(name);
      this.nodeScreen = new Float32Array(network.nodeCount * 4);
      this.painter.setNetwork(network);
    }
    // Recentred at the reference pose, once per resize (never per frame): §2.11.4 lever 3.
    this.offsetX = centerOffset(this.network!, width, height, screenClass, { cap: this.centerOffsetCap, fade: this.edgeFade });
    if (this.reduced || this.hidden || this.frameId === null) this.paintNow();
    this.publishStats();
  }

  /** Scroll progress of the page (0 → 1): the camera pose follows it. */
  setScrollProgress(progress: number): void {
    if (this.destroyed) return;
    poseFromProgress(progress, this.target);
    if (!this.hasTarget) {
      // First reading (before the first drawing): the camera starts posed.
      this.hasTarget = true;
      this.pose.yaw = this.target.yaw;
      this.pose.pitch = this.target.pitch;
      return;
    }
    if (this.reduced || this.hidden) return;
    if (this.pose.yaw !== this.target.yaw || this.pose.pitch !== this.target.pitch) this.ensureLoop();
  }

  /**
   * A section became the current scene: its first entry plays one salvo.
   * The hero never does (it has the arrival cascade).
   */
  enterScene(scene: LivingScene): boolean {
    if (scene === "hero") return false;
    return this.startSequence(scene);
  }

  /**
   * Plays a sequence (once per name). Returns false when it does not play:
   * already played, reduced motion, hidden tab, or no network yet.
   */
  startSequence(name: SequenceName): boolean {
    if (this.destroyed || !this.field || !this.network || this.reduced) return false;
    if (this.hidden) {
      this.field.markPlayed(name);
      this.publishStats();
      return false;
    }
    const now = this.env.now();
    this.updateProjector(now);
    this.readAllZones();
    for (let n = 0; n < this.network.nodeCount; n++) {
      projectInto(this.projector, this.network.nodeX[n]!, this.network.nodeY[n]!, this.network.nodeZ[n]!, this.nodeScreen, n * 4);
      this.nodeX[n] = this.nodeScreen[n * 4]!;
      this.nodeY[n] = this.nodeScreen[n * 4 + 1]!;
    }
    const record = this.field.start(name, now, {
      screenX: this.nodeX,
      screenY: this.nodeY,
      width: this.width,
      height: this.height,
      zones: this.zones,
      covers: this.covers,
    });
    this.publishStats();
    if (!record) return false;
    this.ensureLoop();
    return true;
  }

  setHidden(hidden: boolean): void {
    if (this.destroyed || hidden === this.hidden) return;
    this.hidden = hidden;
    if (hidden) {
      this.stopLoop();
      // Nothing surges when the tab comes back: what was in flight is dropped.
      if (this.field && this.isSequenceActive(this.env.now())) this.field.cancel();
      this.setMotion(this.reduced ? "reduced" : "hidden");
      return;
    }
    if (this.reduced) {
      this.setMotion("reduced");
      return;
    }
    // Back: the camera lands on its target at once, the network is drawn at rest.
    this.pose.yaw = this.target.yaw;
    this.pose.pitch = this.target.pitch;
    this.paintNow();
    this.setMotion(this.restState());
  }

  setReduced(reduced: boolean): void {
    if (this.destroyed || reduced === this.reduced) return;
    this.reduced = reduced;
    if (reduced) {
      this.stopLoop();
      this.field?.cancel();
    } else {
      this.pose.yaw = this.target.yaw;
      this.pose.pitch = this.target.pitch;
    }
    this.paintNow();
  }

  destroy(): void {
    this.destroyed = true;
    this.stopLoop();
  }

  /** Synchronous drawing outside the loop (first drawing, resize, reduced motion, return of the tab). */
  private paintNow(): void {
    if (!this.network || this.width <= 0) return;
    const now = this.env.now();
    this.updateProjector(now);
    if (!this.reduced) this.readAllZones();
    this.paintFrame(now);
    if (this.reduced) this.setMotion("reduced");
    else if (this.hidden) this.setMotion("hidden");
    else if (this.frameId === null) this.setMotion(this.restState());
  }

  private ensureLoop(): void {
    if (this.destroyed || this.reduced || this.hidden || this.frameId !== null || !this.network) return;
    this.lastFrame = null;
    this.costs.reset();
    this.frameId = this.env.requestFrame(this.tick);
    this.setMotion(this.isSequenceActive(this.env.now()) ? "sequence" : "camera");
  }

  private stopLoop(): void {
    if (this.frameId !== null) this.env.cancelFrame(this.frameId);
    this.frameId = null;
    this.lastFrame = null;
  }

  private readonly tick = () => {
    this.frameId = null;
    if (this.destroyed || this.reduced || this.hidden) return;
    const now = this.env.now();
    const dt = this.lastFrame === null ? 1 / 60 : Math.min(Math.max(now - this.lastFrame, 0) / 1000, MAX_STEP_SECONDS);
    this.lastFrame = now;
    this.pose.yaw = approach(this.pose.yaw, this.target.yaw, dt);
    this.pose.pitch = approach(this.pose.pitch, this.target.pitch, dt);
    const cameraMoving = this.pose.yaw !== this.target.yaw || this.pose.pitch !== this.target.pitch;
    const sequence = this.isSequenceActive(now);

    this.updateProjector(now);
    this.readAllZones();
    this.paintFrame(now);
    this.field?.prune(now);

    if (cameraMoving || sequence) {
      this.frameId = this.env.requestFrame(this.tick);
      this.setMotion(sequence ? "sequence" : "camera");
      return;
    }
    // The frame just drawn is the network at rest: stop, nothing is armed.
    this.lastFrame = null;
    this.costs.flush();
    this.setMotion(this.restState());
  };

  private paintFrame(now: number): void {
    const network = this.network;
    if (!network) return;
    const started = this.env.now();
    const stats = this.painter.paint({
      network,
      projector: this.projector,
      yaw: this.projectedYaw,
      pitch: this.projectedPitch,
      zones: this.reduced ? this.emptyZones : this.zones,
      quietBodies: !this.reduced,
      field: this.reduced ? null : this.field,
      time: now,
    });
    const cost = this.env.now() - started;
    this.frames += 1;
    if (this.frameId !== null || this.lastFrame !== null) this.costs.record(cost, stats.repainted);
    this.publishStats(now);
  }

  private projectedYaw = 0;
  private projectedPitch = 0;

  private updateProjector(now: number): void {
    const pose = this.reduced ? REDUCED_POSE : this.pose;
    const yaw = pose.yaw + (this.reduced ? 0 : this.currentDrift(now));
    this.projectedYaw = yaw;
    this.projectedPitch = pose.pitch;
    setProjector(this.projector, yaw, pose.pitch, this.width, this.height, this.screenClass ?? "large", this.offsetX);
  }

  private currentDrift(now: number): number {
    if (!this.field || this.drift === 0) return 0;
    let drift = 0;
    for (const record of this.field.sequences) {
      // Over the effective length of the sequence: back to 0 when its last core goes off.
      const value = sequenceDrift(now - record.start, record.end - record.start, this.drift);
      if (value > drift) drift = value;
    }
    return drift;
  }

  private isSequenceActive(now: number): boolean {
    if (!this.field) return false;
    return now < this.field.busyUntil;
  }

  private readAllZones(): void {
    this.zones.count = 0;
    this.covers.count = 0;
    this.readZones?.(this.zones, this.covers);
  }

  private restState(): MotionState {
    return this.field?.hasPlayed("arrivee") ? "settled" : "idle";
  }

  private setMotion(state: MotionState): void {
    if (state === this.motion) return;
    this.motion = state;
    this.onMotion?.(state);
  }

  private publishStats(now = this.env.now()): void {
    if (!this.onStats) return;
    const field = this.field;
    this.onStats({
      frames: this.frames,
      signals: field && !this.reduced ? field.inFlight(now) : 0,
      lit: field && !this.reduced ? field.litCount(now) : 0,
      sequences: field ? field.playedNames() : [],
    });
  }
}
