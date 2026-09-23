import { smootherstep, TAU } from "./math";
import { POINT_STRIDE } from "../shapes/types";

export const DEFAULT_TRANSITION_MS = 850;
/** Peak of the intermediate dispersion, in normalised zone units. */
const DISPERSION = 0.035;

/**
 * Transition between two presets (spec §5). Starts from the positions that are
 * currently displayed, disperses them slightly along a deterministic direction
 * per particle, and converges with a soft ease to the live target of the new
 * preset. A new request while running simply restarts from what is displayed,
 * towards the latest destination. No allocation after construction.
 */
export class Morph {
  private readonly from: Float32Array;
  private start = 0;
  private duration = DEFAULT_TRANSITION_MS;
  private dispersion = DISPERSION;
  active = false;

  constructor(capacity: number) {
    this.from = new Float32Array(capacity * POINT_STRIDE);
  }

  /** `dispersion` (normalised) is the peak scatter; 0 for a plain glide (count or region changes). */
  begin(displayed: Float32Array, count: number, now: number, durationMs = DEFAULT_TRANSITION_MS, dispersion = DISPERSION): void {
    const length = count * POINT_STRIDE;
    for (let i = 0; i < length; i++) this.from[i] = displayed[i] ?? 0;
    this.start = now;
    this.duration = Math.max(1, durationMs);
    this.dispersion = dispersion;
    this.active = true;
  }

  /**
   * Newcomers [start, end) fade in where they belong instead of flying in:
   * their starting point becomes their target position, fully transparent.
   */
  fadeInAt(target: Float32Array, start: number, end: number): void {
    for (let i = start; i < end; i++) {
      const o = i * POINT_STRIDE;
      this.from[o] = target[o] ?? 0;
      this.from[o + 1] = target[o + 1] ?? 0;
      this.from[o + 2] = 0;
    }
  }

  /** Progress in [0, 1] at `now`. */
  progress(now: number): number {
    const p = (now - this.start) / this.duration;
    return p < 0 ? 0 : p > 1 ? 1 : p;
  }

  /**
   * Writes the blended positions into `out` (normalised zone coordinates) and
   * returns whether the transition is still running. The margins (normalised)
   * keep dispersed points inside the zone.
   */
  blend(target: Float32Array, seeds: Float32Array, count: number, now: number, marginX: number, marginY: number, out: Float32Array): boolean {
    const p = this.progress(now);
    const eased = smootherstep(p);
    const spread = Math.sin(p * Math.PI) * this.dispersion;
    for (let i = 0; i < count; i++) {
      const o = i * POINT_STRIDE;
      const s = i * 4;
      const direction = (seeds[s + 3] ?? 0) * TAU;
      const amount = spread * (0.45 + 0.55 * (seeds[s + 2] ?? 0));
      const fromX = this.from[o] ?? 0;
      const fromY = this.from[o + 1] ?? 0;
      const fromAlpha = this.from[o + 2] ?? 0;
      let x = fromX + ((target[o] ?? 0) - fromX) * eased + Math.cos(direction) * amount;
      let y = fromY + ((target[o + 1] ?? 0) - fromY) * eased + Math.sin(direction) * amount;
      x = x < marginX ? marginX : x > 1 - marginX ? 1 - marginX : x;
      y = y < marginY ? marginY : y > 1 - marginY ? 1 - marginY : y;
      out[o] = x;
      out[o + 1] = y;
      out[o + 2] = fromAlpha + ((target[o + 2] ?? 0) - fromAlpha) * eased;
    }
    if (p >= 1) this.active = false;
    return this.active;
  }
}
