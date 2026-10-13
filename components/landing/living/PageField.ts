import {
  DUST,
  WAVE,
  breathing,
  buildPlane,
  driftOffset,
  fieldCount,
  planeCount,
  ringAlpha,
  ringGain,
  ringRadius,
  ringReach,
  type PlaneTile,
} from "./page-dust";

/**
 * Renderer and loop of the particle field of the page (docs/design-system.md T.6). Each plane is drawn
 * ONCE in a tile (a canvas) and repeated by a pattern fill that slides with the plane's drift: three fills per
 * image, whatever the number of points. A wave (a ring from the title near the middle of the window) is
 * the only per-point work: the points near the ring are drawn again, a little stronger. `setInterval`
 * (never `requestAnimationFrame`: the hero owns the only one of the page), 30 images/s, 20 on a phone.
 * Nothing is drawn while the opaque hero covers the window, nor in a hidden tab, nor on the user's pause.
 */
export type FieldState = "playing" | "paused" | "reduced";

/** Levels of the automatic fall back (T.6): 0 full, 1 one ring and 20 images/s, 2 half the points and no ring, 3 still. */
type Level = 0 | 1 | 2 | 3;

const LEVELS_AT = 60;
const BUDGET_MS = { desktop: 2, phone: 3 } as const;
const ORIGIN_CHECK_MS = 250;
const GAIN_LEVELS = 4;

export class PageField {
  private readonly ctx: CanvasRenderingContext2D;
  private ink = "currentColor";
  private width = 1;
  private height = 1;
  private dpr = 1;
  private visibleCount = 0;
  private tiles: PlaneTile[] = [];
  private patterns: CanvasPattern[] = [];
  private timer: number | null = null;
  private last = 0;
  /** Active time (ms): drift, breathing and the waves follow it, and it stops with the loop. */
  private clock = 0;
  private reduced: boolean;
  private stopped = false;
  private pageVisible = true;
  private heroCovers = false;
  private level: Level = 0;
  /** Waves alive: emission time (active ms) and origin (window px). */
  private rings: { at: number; x: number; y: number }[] = [];
  private nextEmit = 0;
  private armed = false;
  private originCheckedAt = -1e9;
  private origin: { x: number; y: number } | null = null;
  private readonly work: number[] = [];
  private bins: { x: Float32Array; y: Float32Array; count: number }[] = [];
  private forced: { x: number; y: number; r: number } | null = null;
  private disposed = false;
  private readonly observer: MutationObserver | null;
  /** Titles that can send a wave, kept by an IntersectionObserver (no layout read in the loop): document position and visible share. */
  private readonly origins = new Map<Element, { x: number; y: number; ratio: number }>();
  private readonly originObserver: IntersectionObserver | null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    reduced: boolean,
  ) {
    this.ctx = canvas.getContext("2d")!;
    this.reduced = reduced;
    const style = getComputedStyle(canvas);
    this.ink = style.getPropertyValue("--color-ink").trim() || style.color;
    // Test hook (docs T.10, 37): `data-pulse-force="x,y,r"` draws the worst wave there, at its maximum.
    this.observer = typeof MutationObserver === "undefined" ? null : new MutationObserver(() => this.readForce());
    this.observer?.observe(canvas, { attributes: true, attributeFilter: ["data-pulse-force"] });
    this.originObserver =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            (entries) => {
              for (const entry of entries) {
                const rect = entry.boundingClientRect;
                this.origins.set(entry.target, { x: rect.left + rect.width / 2 + window.scrollX, y: rect.top + rect.height / 2 + window.scrollY, ratio: entry.isIntersecting ? entry.intersectionRatio : 0 });
              }
            },
            { threshold: [0, 0.2, 0.4, 0.6, 0.8, 1] },
          );
    for (const element of document.querySelectorAll("[data-pulse-origin]")) this.originObserver?.observe(element);
  }

  private get phone(): boolean {
    return this.width < DUST.phoneWidth;
  }

  private get frameMs(): number {
    return this.phone || this.level >= 1 ? DUST.phoneFrameMs : DUST.frameMs;
  }

  private get maxRings(): number {
    return this.phone || this.level >= 1 ? 1 : WAVE.maxRings;
  }

  /** New window size: the tiles are rebuilt only when the number of points changes. */
  resize(width: number, height: number): void {
    if (this.disposed) return;
    this.width = Math.max(1, Math.round(width));
    this.height = Math.max(1, Math.round(height));
    this.dpr = 1;
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    const wanted = Math.round(fieldCount(this.width, this.height) * (this.level >= 2 ? 0.5 : 1));
    this.rebuild(wanted);
    this.paint();
    this.reconcile();
  }

  private rebuild(visible: number): void {
    this.visibleCount = visible;
    this.tiles = DUST.planes.map((_, plane) => buildPlane(plane, planeCount(visible, this.width, this.height, plane)));
    this.patterns = [];
    this.tiles.forEach((tile, plane) => {
      const spec = DUST.planes[plane]!;
      const size = Math.round(tile.side * this.dpr);
      const surface = document.createElement("canvas");
      surface.width = size;
      surface.height = size;
      const ctx = surface.getContext("2d")!;
      ctx.fillStyle = this.ink;
      ctx.beginPath();
      for (let i = 0; i < tile.count; i++) {
        // On the device pixel grid: a one pixel point stays crisp.
        const x = Math.round(tile.x[i]! * this.dpr);
        const y = Math.round(tile.y[i]! * this.dpr);
        ctx.rect(x, y, spec.size * this.dpr, spec.size * this.dpr);
      }
      ctx.fill();
      const pattern = this.ctx.createPattern(surface, "repeat");
      if (pattern) this.patterns.push(pattern);
    });
    const capacity = Math.min(12_000, Math.max(...this.tiles.map((tile) => tile.count)) + 1);
    this.bins = Array.from({ length: DUST.planes.length * GAIN_LEVELS }, () => ({ x: new Float32Array(capacity), y: new Float32Array(capacity), count: 0 }));
    this.canvas.dataset.points = String(visible);
  }

  setStopped(stopped: boolean): void {
    this.stopped = stopped;
    // « Reprendre » restarts the waves from zero; the pause froze the field in place.
    if (!stopped) this.rearm();
    this.paint();
    this.reconcile();
  }

  setReduced(reduced: boolean): void {
    this.reduced = reduced;
    this.paint();
    this.reconcile();
  }

  setPageVisible(visible: boolean): void {
    this.pageVisible = visible;
    this.reconcile();
  }

  /** True while the opaque hero covers the whole window: nothing is drawn then. */
  setHeroCovers(covers: boolean): void {
    this.heroCovers = covers;
    this.reconcile();
  }

  /** « Rejouer les animations »: the waves start again from zero. */
  replay(): void {
    this.rearm();
    this.paint();
  }

  dispose(): void {
    this.disposed = true;
    this.observer?.disconnect();
    this.originObserver?.disconnect();
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  private rearm(): void {
    this.rings = [];
    this.armed = false;
    this.originCheckedAt = -1e9;
  }

  private get running(): boolean {
    return !this.disposed && !this.reduced && !this.stopped && this.pageVisible && !this.heroCovers && this.level < 3;
  }

  private reconcile(): void {
    if (this.disposed) return;
    const running = this.running;
    this.canvas.dataset.loopState = running ? "playing" : "paused";
    this.canvas.dataset.state = this.reduced ? "reduced" : running ? "playing" : "paused";
    if (running && this.timer === null) {
      this.last = performance.now();
      this.timer = window.setInterval(this.step, this.frameMs);
    } else if (!running && this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  private readonly step = (): void => {
    const started = performance.now();
    const dt = Math.min(started - this.last, 100);
    this.last = started;
    this.clock += dt;
    this.emit();
    this.paint();
    this.watch(performance.now() - started);
  };

  /** Falls back when the work of 60 images exceeds the budget at the 75th percentile: never the other way round. */
  private watch(cost: number): void {
    this.work.push(cost);
    if (this.work.length < LEVELS_AT) return;
    const sorted = [...this.work].sort((a, b) => a - b);
    this.work.length = 0;
    if (sorted[Math.floor(sorted.length * 0.75)]! <= (this.phone ? BUDGET_MS.phone : BUDGET_MS.desktop)) return;
    if (this.level >= 3) return;
    this.level = (this.level + 1) as Level;
    this.canvas.dataset.level = String(this.level);
    if (this.level === 2) {
      this.rings = [];
      this.rebuild(Math.round(this.visibleCount * 0.5));
    }
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    this.reconcile();
  }

  /** The title near the middle of the window that sends the wave (visible at 40 % at least), from the cached positions: no layout read. */
  private findOrigin(): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null;
    let bestDistance = Infinity;
    for (const origin of this.origins.values()) {
      if (origin.ratio < WAVE.visible) continue;
      const x = origin.x - window.scrollX;
      const y = origin.y - window.scrollY;
      const distance = Math.abs(y - this.height / 2);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { x, y };
      }
    }
    return best;
  }

  /** A ring every 6 s (the first 0.5 s after the origin arrives), two alive at most. */
  private emit(): void {
    if (this.level >= 2) return;
    const reach = ringReach(this.width);
    this.rings = this.rings.filter((ring) => ringRadius(this.clock - ring.at) <= reach);
    if (this.clock - this.originCheckedAt >= ORIGIN_CHECK_MS) {
      this.originCheckedAt = this.clock;
      this.origin = this.findOrigin();
      if (!this.origin) this.armed = false;
      else if (!this.armed) {
        this.armed = true;
        this.nextEmit = this.clock + WAVE.firstMs;
      }
    }
    if (!this.armed || !this.origin || this.clock < this.nextEmit || this.rings.length >= this.maxRings) return;
    this.rings.push({ at: this.clock, x: this.origin.x, y: this.origin.y });
    this.nextEmit = this.clock + WAVE.everyMs;
  }

  private readForce(): void {
    const raw = this.canvas.dataset.pulseForce;
    const parts = raw ? raw.split(",").map(Number) : [];
    this.forced = parts.length >= 3 && parts.every(Number.isFinite) ? { x: parts[0]!, y: parts[1]!, r: parts[2]! } : null;
    this.paint();
  }

  /** One image: the three planes (a pattern fill each), then the rings. A frozen field (pause, reduced motion) does not breathe and has no ring. */
  private paint(): void {
    const ctx = this.ctx;
    if (this.patterns.length < DUST.planes.length) return;
    const moving = this.running && this.timer !== null;
    const seconds = this.reduced ? 0 : this.clock / 1000;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (let plane = 0; plane < DUST.planes.length; plane++) {
      const offset = driftOffset(plane, seconds);
      const pattern = this.patterns[plane]!;
      pattern.setTransform({ a: 1, b: 0, c: 0, d: 1, e: offset.x * this.dpr, f: offset.y * this.dpr });
      ctx.globalAlpha = DUST.planes[plane]!.alpha * (moving ? breathing(plane, seconds) : 1);
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    ctx.globalAlpha = 1;
    this.canvas.dataset.rings = String(moving ? this.rings.length : 0);
    if (moving) this.paintRings(seconds);
    if (this.forced) this.paintForced(seconds);
  }

  /** Visits every copy of every point of a plane at its screen position (the tile repeats). */
  private forEachPoint(plane: number, seconds: number, visit: (x: number, y: number) => void): void {
    const tile = this.tiles[plane]!;
    const offset = driftOffset(plane, seconds);
    const side = tile.side;
    for (let i = 0; i < tile.count; i++) {
      let bx = tile.x[i]! + offset.x;
      if (bx >= side) bx -= side;
      let by = tile.y[i]! + offset.y;
      if (by >= side) by -= side;
      for (let sy = by; sy < this.height; sy += side) for (let sx = bx; sx < this.width; sx += side) visit(sx, sy);
    }
  }

  private paintRings(seconds: number): void {
    const reach = ringReach(this.width);
    const alive = this.rings;
    if (alive.length === 0) return;
    const ctx = this.ctx;
    ctx.fillStyle = this.ink;
    for (let plane = 0; plane < DUST.planes.length; plane++) {
      const spec = DUST.planes[plane]!;
      const base = spec.alpha * breathing(plane, seconds);
      for (let l = 0; l < GAIN_LEVELS; l++) this.bins[plane * GAIN_LEVELS + l]!.count = 0;
      for (const ring of alive) {
        const radius = ringRadius(this.clock - ring.at);
        const near = radius - WAVE.sigma * 2.5;
        const far = radius + WAVE.sigma * 2.5;
        this.forEachPoint(plane, seconds, (x, y) => {
          const dx = x - ring.x;
          const dy = y - ring.y;
          const d2 = dx * dx + dy * dy;
          if ((near > 0 && d2 < near * near) || d2 > far * far) return;
          const gain = ringGain(Math.sqrt(d2), radius, reach);
          if (gain < 0.06) return;
          const bin = this.bins[plane * GAIN_LEVELS + Math.min(GAIN_LEVELS - 1, Math.floor(gain * GAIN_LEVELS))]!;
          if (bin.count < bin.x.length) {
            bin.x[bin.count] = x;
            bin.y[bin.count] = y;
            bin.count++;
          }
        });
      }
      for (let l = 0; l < GAIN_LEVELS; l++) {
        const bin = this.bins[plane * GAIN_LEVELS + l]!;
        if (bin.count === 0) continue;
        const gain = (l + 0.5) / GAIN_LEVELS;
        this.fillBin(bin, spec.size + WAVE.grow * gain, base, ringAlpha(base, gain));
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Draws a bin on top of the base points so that the sum reaches `target` (opacity of the point, base included). */
  private fillBin(bin: { x: Float32Array; y: Float32Array; count: number }, size: number, base: number, target: number): void {
    const ctx = this.ctx;
    const overlay = Math.max(0, (target - base) / (1 - base));
    ctx.globalAlpha = overlay;
    ctx.beginPath();
    const px = size * this.dpr;
    const half = size / 2;
    for (let k = 0; k < bin.count; k++) ctx.rect((bin.x[k]! - half) * this.dpr, (bin.y[k]! - half) * this.dpr, px, px);
    ctx.fill();
  }

  /** Worst case for the contrast tests: every point of the disc is at the maximum of a wave. */
  private paintForced(seconds: number): void {
    const forced = this.forced;
    if (!forced) return;
    const ctx = this.ctx;
    ctx.fillStyle = this.ink;
    for (let plane = 0; plane < DUST.planes.length; plane++) {
      const spec = DUST.planes[plane]!;
      const bin = this.bins[plane * GAIN_LEVELS]!;
      bin.count = 0;
      this.forEachPoint(plane, seconds, (x, y) => {
        if (Math.hypot(x - forced.x, y - forced.y) > forced.r || bin.count >= bin.x.length) return;
        bin.x[bin.count] = x;
        bin.y[bin.count] = y;
        bin.count++;
      });
      this.fillBin(bin, spec.size + WAVE.grow, spec.alpha, DUST.maxAlpha);
    }
    ctx.globalAlpha = 1;
  }
}
