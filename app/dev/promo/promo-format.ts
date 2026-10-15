/**
 * Geometry of the two film formats (docs/motion/promo-2026-10.md §3.1 and §4). Every position of the
 * scene comes from here: the scene code never hard-codes a coordinate.
 */
export type PromoFormat = "16x9" | "9x16";

export type Vec = { x: number; y: number };

export type PromoLayout = {
  format: PromoFormat;
  width: number;
  height: number;
  vertical: boolean;
  /** Left / right margin and safe zones (px). */
  margin: number;
  safeTop: number;
  safeBottom: number;
  /** Identities of the cloud, and the share active before the hands. */
  count: number;
  active: number;
  /** Multiplier of the PLANES sizes, and cap of the size of the hands points (px). */
  pointScale: number;
  /** Extra size of the sparse clouds (scatter, sphere): the phone format has fewer points. */
  cloudBoost: number;
  handsPointMax: number;
  driftPx: number;
  titleSize: number;
  title1: Vec;
  title2: Vec;
  sphere: { center: Vec; diameter: number };
  rail: { start: Vec; end: Vec };
  station: { icon: number; font: number; labelGap: number };
  dossier: { width: number; height: number; rise: number; speedNote: number };
  bead: { diameter: number; trail: number; trailGap: number };
  terminal: { x: number; y: number; font: number; lineHeight: number; width: number; noteFont: number; noteGap: number; lift: number };
  main4: { x: number; y: number; width: number; size: number; lineHeight: number };
  mandateNote: { font: number };
  window: { x: number; y: number; w: number; h: number; radius: number };
  figures: { y: number; numberSize: number; labelSize: number; columns: number };
  chart: { x: number; w: number; baseline: number; height: number; labelSize: number; labelY: number };
  fictionNote: { font: number; y: number };
  title5: { x: number; y: number; size: number };
  hands: { origin: Vec; unit: number; rise: number };
  logo: { center: Vec; height: number };
  signature: { y: number; size: number; lineHeight: number };
  mention: { y: number; font: number };
  veil: { radius: number };
};

const LAYOUT_16X9: PromoLayout = {
  format: "16x9",
  width: 1920,
  height: 1080,
  vertical: false,
  margin: 120,
  safeTop: 80,
  safeBottom: 80,
  count: 12_000,
  active: 3200,
  pointScale: 1.35,
  cloudBoost: 1,
  handsPointMax: 2.8,
  driftPx: 8,
  titleSize: 88,
  title1: { x: 960, y: 0.46 * 1080 },
  title2: { x: 960, y: 0.82 * 1080 },
  sphere: { center: { x: 960, y: 0.43 * 1080 }, diameter: 0.46 * 1080 },
  rail: { start: { x: 160, y: 0.38 * 1080 }, end: { x: 1760, y: 0.38 * 1080 } },
  station: { icon: 72, font: 26, labelGap: 20 },
  dossier: { width: 30, height: 38, rise: 44, speedNote: 180 },
  bead: { diameter: 8, trail: 5, trailGap: 10 },
  terminal: { x: 160, y: 800, font: 24, lineHeight: 40, width: 1500, noteFont: 20, noteGap: 28, lift: 0 },
  main4: { x: 960, y: 112, width: 1240, size: 64, lineHeight: 80 },
  mandateNote: { font: 22 },
  window: { x: 330, y: 130, w: 1260, h: 660, radius: 16 },
  figures: { y: 176, numberSize: 48, labelSize: 24, columns: 3 },
  chart: { x: 400, w: 1120, baseline: 706, height: 250, labelSize: 24, labelY: 372 },
  fictionNote: { font: 22, y: 744 },
  title5: { x: 960, y: 900, size: 72 },
  hands: { origin: { x: 960, y: 436 }, unit: 1500, rise: 120 },
  logo: { center: { x: 960, y: 436 }, height: 160 },
  signature: { y: 0.66 * 1080, size: 56, lineHeight: 72 },
  mention: { y: 1080 - 24, font: 20 },
  veil: { radius: 640 },
};

const LAYOUT_9X16: PromoLayout = {
  format: "9x16",
  width: 1080,
  height: 1920,
  vertical: true,
  margin: 72,
  safeTop: 250,
  safeBottom: 340,
  count: 8400,
  active: 2400,
  pointScale: 1,
  cloudBoost: 1.3,
  handsPointMax: 3.4,
  driftPx: 6,
  titleSize: 76,
  title1: { x: 540, y: 0.4 * 1920 },
  title2: { x: 540, y: 0.24 * 1920 },
  sphere: { center: { x: 540, y: 0.55 * 1920 }, diameter: 0.62 * 1080 },
  rail: { start: { x: 150, y: 300 }, end: { x: 150, y: 1180 } },
  station: { icon: 84, font: 30, labelGap: 24 },
  dossier: { width: 28, height: 36, rise: 40, speedNote: 150 },
  bead: { diameter: 7, trail: 5, trailGap: 9 },
  terminal: { x: 72, y: 1270, font: 30, lineHeight: 50, width: 936, noteFont: 24, noteGap: 36, lift: 40 },
  main4: { x: 679, y: 300, width: 658, size: 64, lineHeight: 80 },
  mandateNote: { font: 28 },
  window: { x: 72, y: 430, w: 936, h: 780, radius: 16 },
  figures: { y: 474, numberSize: 56, labelSize: 26, columns: 3 },
  chart: { x: 130, w: 820, baseline: 1100, height: 330, labelSize: 28, labelY: 668 },
  fictionNote: { font: 26, y: 1150 },
  title5: { x: 540, y: 330, size: 64 },
  hands: { origin: { x: 540, y: 0.38 * 1920 }, unit: 2160, rise: 100 },
  logo: { center: { x: 540, y: 0.5 * 1920 }, height: 200 },
  signature: { y: 0.62 * 1920, size: 54, lineHeight: 68 },
  mention: { y: 1540, font: 26 },
  veil: { radius: 520 },
};

export function layoutOf(format: PromoFormat): PromoLayout {
  return format === "9x16" ? LAYOUT_9X16 : LAYOUT_16X9;
}

export function parseFormat(value: string | undefined): PromoFormat {
  return value === "9x16" ? "9x16" : "16x9";
}

/** Position of the station `k` (0..6, fractional allowed) along the rail. */
export function stationPoint(layout: PromoLayout, k: number, out: Vec = { x: 0, y: 0 }): Vec {
  const f = k / 6;
  out.x = layout.rail.start.x + (layout.rail.end.x - layout.rail.start.x) * f;
  out.y = layout.rail.start.y + (layout.rail.end.y - layout.rail.start.y) * f;
  return out;
}
