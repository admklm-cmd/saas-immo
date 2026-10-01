/**
 * Small canvas tools of the network painter (docs/design-system.md §2.11.4):
 * palette, surfaces, the key of the picture at rest, discs. Split from
 * renderer.ts.
 */

import type { QuietZones } from "./quiet";

export type Rgb = readonly [number, number, number];

export type Palette = {
  ink: Rgb;
  accent: Rgb;
  /** Reflection on the head of an impulse (#dae8ff in the reference). */
  highlight: Rgb;
  /** Clear centre of a lit core (#bfd5ff in the reference). */
  core: Rgb;
};

export const DEFAULT_PALETTE: Palette = {
  ink: [24, 24, 27],
  accent: [36, 87, 255],
  highlight: [218, 232, 255],
  core: [191, 213, 255],
};

export type Surface = {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
};

export type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** What a picture of the network at rest depends on. */
export type RestInput = { yaw: number; pitch: number; quietBodies: boolean; zones: QuietZones };

/** What a picture of the network at rest depends on: pose, quiet zones (bodies). */
export type RestKey = { valid: boolean; yaw: number; pitch: number; quietBodies: boolean; count: number; rects: Float32Array };

export function createRestKey(): RestKey {
  return { valid: false, yaw: NaN, pitch: NaN, quietBodies: false, count: 0, rects: new Float32Array(160) };
}

export function matchesRest(key: RestKey, input: RestInput): boolean {
  if (!key.valid || input.yaw !== key.yaw || input.pitch !== key.pitch || input.quietBodies !== key.quietBodies) return false;
  if (!input.quietBodies) return true;
  const zones = input.zones;
  if (zones.count !== key.count) return false;
  for (let i = 0; i < zones.count * 4; i++) if (Math.abs(zones.rects[i]! - key.rects[i]!) > 0.5) return false;
  return true;
}

export function rememberRest(key: RestKey, input: RestInput): void {
  key.valid = true;
  key.yaw = input.yaw;
  key.pitch = input.pitch;
  key.quietBodies = input.quietBodies;
  key.count = input.zones.count;
  for (let i = 0; i < input.zones.count * 4 && i < key.rects.length; i++) key.rects[i] = input.zones.rects[i]!;
}

export function dot(context: Context2D, x: number, y: number, radius: number, alpha: number): void {
  if (alpha <= 0 || radius <= 0) return;
  context.globalAlpha = alpha > 1 ? 1 : alpha;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
}

export function clampRange(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function rgb(color: Rgb): string {
  return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
}

/** jsdom and old browsers may not implement the 2D context: stay silent. */
export function surfaceOf(canvas: HTMLCanvasElement): Surface | null {
  try {
    const context = canvas.getContext("2d");
    return context ? { canvas, context } : null;
  } catch {
    return null;
  }
}

export function createCacheSurface(): Surface | null {
  try {
    if (typeof OffscreenCanvas !== "undefined") {
      const canvas = new OffscreenCanvas(1, 1);
      const context = canvas.getContext("2d");
      if (context) return { canvas, context };
    }
    if (typeof document !== "undefined") return surfaceOf(document.createElement("canvas"));
  } catch {
    return null;
  }
  return null;
}

/** Reads a CSS colour token (`#rrggbb` or `rgb(…)`), or the fallback. */
export function parseColor(value: string | undefined | null, fallback: Rgb): Rgb {
  const text = (value ?? "").trim();
  const hex = /^#([0-9a-f]{6})$/i.exec(text);
  if (hex) {
    const number = Number.parseInt(hex[1]!, 16);
    return [(number >> 16) & 255, (number >> 8) & 255, number & 255];
  }
  const functional = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(text);
  if (functional) return [Number(functional[1]), Number(functional[2]), Number(functional[3])];
  return fallback;
}
