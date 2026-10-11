import { MIN_ALPHA, POINT_STRIDE, type ShapeDefinition, type ShapeFn } from "./types";

/** Columns / rows ratio of the calm grid. */
const GRID_ASPECT = 2.6;
const SPACING = 10;
/** Grid extent is normalised so the bounds do not depend on the particle count. */
const HALF_WIDTH = 100;
const HALF_HEIGHT = HALF_WIDTH / GRID_ASPECT;

/**
 * Settings — calm grid (spec §4-F), in units of one grid spacing (10):
 * wave = sin(column*.18 + row*.16 - t*.55) ; x = gridX + cos(row*.19 - t*.35)*1.5 ;
 * y = gridY + wave*2.8. Regular points, no lines. Particles beyond the last full
 * row are kept (identity) but fully transparent.
 */
export const gridShape: ShapeFn = (index, count, t, _seeds, out) => {
  const cols = Math.max(2, Math.round(Math.sqrt(count * GRID_ASPECT)));
  const rows = Math.max(2, Math.floor(count / cols));
  const o = index * POINT_STRIDE;
  const hidden = index >= cols * rows;
  const i = hidden ? index - cols * rows : index;
  const column = i % cols;
  const row = Math.floor(i / cols) % rows;
  const scaleX = (2 * HALF_WIDTH) / ((cols - 1) * SPACING);
  const scaleY = (2 * HALF_HEIGHT) / ((rows - 1) * SPACING);
  const wave = Math.sin(column * 0.18 + row * 0.16 - t * 0.55);
  out[o] = (column * SPACING + Math.cos(row * 0.19 - t * 0.35) * 1.5) * scaleX - HALF_WIDTH;
  out[o + 1] = (row * SPACING + wave * 2.8) * scaleY - HALF_HEIGHT;
  out[o + 2] = hidden ? 0 : MIN_ALPHA + 0.06 + ((wave + 1) / 2) * 0.16;
};

export const grid: ShapeDefinition = {
  shape: gridShape,
  // Offsets are at most 1.5 and 2.8 spacings once scaled: < 3.2 units for any
  // count >= 200 (rows >= 8), far less at real densities (>= 2 600).
  bounds: { minX: -HALF_WIDTH - 3.2, maxX: HALF_WIDTH + 3.2, minY: -HALF_HEIGHT - 3.2, maxY: HALF_HEIGHT + 3.2 },
  cycle: null,
  staticTime: 1.5,
  maxStretch: 1.8,
};
