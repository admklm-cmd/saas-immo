import type { ShapeBounds } from "../shapes/types";

/** Maps shape units to normalised zone coordinates: nx = x * scaleX + offsetX, in [0, 1]. */
export type Fit = { scaleX: number; scaleY: number; offsetX: number; offsetY: number };

export function createFit(): Fit {
  return { scaleX: 0, scaleY: 0, offsetX: 0.5, offsetY: 0.5 };
}

/**
 * Fits the declared bounds of a shape inside a width x height zone (CSS px),
 * keeping `padding` px free on every side so no point is ever cut. One axis
 * may be stretched up to `maxStretch` times the other (fields adapt to the
 * zone, objects keep their proportions). Mutates `fit` (no allocation).
 */
export function computeFit(bounds: ShapeBounds, maxStretch: number, width: number, height: number, padding: number, fit: Fit): Fit {
  const availableWidth = Math.max(1, width - padding * 2);
  const availableHeight = Math.max(1, height - padding * 2);
  const rangeX = bounds.maxX - bounds.minX;
  const rangeY = bounds.maxY - bounds.minY;
  const containX = availableWidth / rangeX;
  const containY = availableHeight / rangeY;
  const uniform = Math.min(containX, containY);
  const pxX = Math.min(containX, uniform * maxStretch);
  const pxY = Math.min(containY, uniform * maxStretch);
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  fit.scaleX = pxX / safeWidth;
  fit.scaleY = pxY / safeHeight;
  fit.offsetX = 0.5 - ((bounds.minX + bounds.maxX) / 2) * fit.scaleX;
  fit.offsetY = 0.5 - ((bounds.minY + bounds.maxY) / 2) * fit.scaleY;
  return fit;
}

export const MAX_PARTICLES = 13_500;
const MIN_LARGE = 6_000;
const PREVIEW_COUNT = 2_600;
const MIN_MOBILE = 1_200;
const MAX_MOBILE = 4_000;
/** Particles per CSS px² in "auto" mode, between the preview and large-zone densities. */
const AUTO_DENSITY = 0.028;
/** Below this area (CSS px²), a zone is a small preview. */
const PREVIEW_AREA = 160_000;

/**
 * Particle count for a zone (spec §3): about 2 600 in a small preview,
 * 6 000 to 13 500 in a large zone, reduced on mobile.
 */
export function resolveParticleCount(density: number | "auto", width: number, height: number, mobile: boolean): number {
  let count: number;
  if (density === "auto") {
    const area = width * height;
    count = area < PREVIEW_AREA ? PREVIEW_COUNT : Math.max(MIN_LARGE, Math.round(area * AUTO_DENSITY));
  } else {
    count = Math.round(density);
  }
  count = Math.min(MAX_PARTICLES, Math.max(200, count));
  return mobile ? Math.max(Math.min(count, MIN_MOBILE), Math.min(MAX_MOBILE, Math.round(count * 0.6))) : count;
}

/** Full-page background budget (spec §9, confirmed on 23/09/2026). */
export const BACKGROUND_BUDGET = { wide: 6_000, medium: 4_000, mobile: 1_800 } as const;
export const MOBILE_MAX_WIDTH = 767;
const WIDE_MIN_WIDTH = 1_280;

/** Particles of the background canvas for a viewport width (CSS px). */
export function backgroundBudget(viewportWidth: number): number {
  if (viewportWidth >= WIDE_MIN_WIDTH) return BACKGROUND_BUDGET.wide;
  if (viewportWidth > MOBILE_MAX_WIDTH) return BACKGROUND_BUDGET.medium;
  return BACKGROUND_BUDGET.mobile;
}

/** Device pixel ratio cap: 2 (spec §6), 1.5 on mobile viewports (spec §9). */
export function capPixelRatio(devicePixelRatio: number, viewportWidth: number): number {
  const ratio = devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.min(ratio, viewportWidth <= MOBILE_MAX_WIDTH ? 1.5 : 2);
}

/** Adaptive density (spec §9): steps of -25 % while frames average more than 8 ms over 2 s. */
export const ADAPTIVE_FRAME_BUDGET_MS = 8;
export const ADAPTIVE_WINDOW_MS = 2_000;
export const ADAPTIVE_STEP = 0.75;
/** Never go below this share of the initial budget: the material must stay readable. */
export const ADAPTIVE_FLOOR_SHARE = 0.3;

export function nextAdaptiveCount(count: number, budget: number): number {
  return Math.max(Math.round(budget * ADAPTIVE_FLOOR_SHARE), Math.round(count * ADAPTIVE_STEP));
}

/** Part of the canvas where the shape lives, in normalised canvas coordinates. */
export type Region = { x: number; y: number; width: number; height: number };
export const FULL_REGION: Region = { x: 0, y: 0, width: 1, height: 1 };

/**
 * Fits the shape inside `region` of a width x height canvas (CSS px), keeping
 * `padding` px free around the region. Mutates `fit` (no allocation).
 */
export function computeRegionFit(bounds: ShapeBounds, maxStretch: number, width: number, height: number, padding: number, region: Region, fit: Fit): Fit {
  const regionWidth = Math.max(1, width * region.width);
  const regionHeight = Math.max(1, height * region.height);
  computeFit(bounds, maxStretch, regionWidth, regionHeight, padding, fit);
  fit.scaleX *= region.width;
  fit.scaleY *= region.height;
  fit.offsetX = region.x + fit.offsetX * region.width;
  fit.offsetY = region.y + fit.offsetY * region.height;
  return fit;
}
