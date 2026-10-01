/**
 * Cost of the frames of an active window of the network background
 * (`data-frame-ms`, `data-frame-ms-p95`; docs/design-system.md §2.11.4). The
 * time measured is the drawing work done by the script (path recording,
 * strokes, copies); the rasterisation then runs in the browser's pipeline.
 */

export type FrameCost = {
  /** Mean cost of a frame over the last active window, ms. */
  mean: number;
  p95: number;
  /** p95 of the frames that repainted the network (camera moving). */
  p95Full: number | null;
  /** p95 of the frames that only copied the cache (sequence, camera still). */
  p95Cached: number | null;
  count: number;
};

const WINDOW = 240;
/** During a long window, publish every 60 frames. */
const PUBLISH_EVERY = 60;

export class FrameCostWindow {
  private readonly costs = new Float32Array(WINDOW);
  private readonly full = new Uint8Array(WINDOW);
  private count = 0;

  constructor(private readonly publish?: (cost: FrameCost) => void) {}

  /** A new active window (the loop starts). */
  reset(): void {
    this.count = 0;
  }

  record(milliseconds: number, repainted: boolean): void {
    const slot = this.count % WINDOW;
    this.costs[slot] = milliseconds;
    this.full[slot] = repainted ? 1 : 0;
    this.count += 1;
    if (this.count % PUBLISH_EVERY === 0) this.flush();
  }

  /** Publishes the window (end of the loop, or every 60 frames). Allocates: never called per frame. */
  flush(): void {
    if (!this.publish || this.count === 0) return;
    const count = Math.min(this.count, WINDOW);
    const all: number[] = [];
    const full: number[] = [];
    const cached: number[] = [];
    for (let i = 0; i < count; i++) {
      const value = this.costs[i]!;
      all.push(value);
      (this.full[i] ? full : cached).push(value);
    }
    const mean = all.reduce((sum, value) => sum + value, 0) / all.length;
    this.publish({
      mean,
      p95: percentile(all, 0.95),
      p95Full: full.length ? percentile(full, 0.95) : null,
      p95Cached: cached.length ? percentile(cached, 0.95) : null,
      count,
    });
  }
}

/** Nearest-rank percentile (sorts its argument). */
export function percentile(values: number[], share: number): number {
  if (values.length === 0) return 0;
  values.sort((a, b) => a - b);
  return values[Math.min(values.length - 1, Math.max(0, Math.ceil(share * values.length) - 1))]!;
}
