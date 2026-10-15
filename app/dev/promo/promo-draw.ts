import { pointOnRail, railLength } from "@/components/landing/hero/particles/rails";

import type { Vec } from "./promo-format";
import { stationPoint } from "./promo-format";
import { approach, sweepEdges, type PointBuffer } from "./promo-points";
import { handMove, HAND_BEAD_SPEED_PX, type PromoScene } from "./promo-scene";
import { dossierStation, easeInOut, easeOut, lerp, progress, STATION_ARRIVAL, T, WAIT_STATION } from "./promo-timeline";

/** Colours read from the design tokens at start (`app/globals.css`), as « r, g, b ». */
export type Palette = {
  pearl: readonly [number, number, number];
  ink: readonly [number, number, number];
  inverse: readonly [number, number, number];
  accent: readonly [number, number, number];
  surface: readonly [number, number, number];
};

export type PaintAssets = { logo: CanvasImageSource | null; logoAspect: number };

const rgb = (c: readonly [number, number, number]) => `rgb(${c[0]},${c[1]},${c[2]})`;
const rgba = (c: readonly [number, number, number], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const mixRgb = (a: readonly [number, number, number], b: readonly [number, number, number], e: number) =>
  `rgb(${Math.round(lerp(a[0], b[0], e))},${Math.round(lerp(a[1], b[1], e))},${Math.round(lerp(a[2], b[2], e))})`;

export function parseHex(value: string): [number, number, number] {
  const hex = value.trim().replace("#", "");
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

const TWO_PI = Math.PI * 2;
const fade = (t: number, from: number, to: number) => easeOut(progress(t, from, to));

/** Ink band of the background at `t`: 0..length along the sweep axis. */
export function inkExtent(t: number, length: number): number {
  const edges = sweepEdges(t, length);
  const extent = t < T.sweepBackFrom ? edges.forward - 150 : length - edges.back + 150;
  return Math.min(length, Math.max(0, extent));
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, diameter: number) {
  ctx.beginPath();
  ctx.arc(x, y, diameter / 2, 0, TWO_PI);
  ctx.fill();
}

/** Position on the rail (station position `s`) and the unit vectors along and across it. */
function railFrame(scene: PromoScene, s: number) {
  const { layout } = scene;
  const point = stationPoint(layout, s);
  const along: Vec = layout.vertical ? { x: 0, y: 1 } : { x: 1, y: 0 };
  const across: Vec = layout.vertical ? { x: -1, y: 0 } : { x: 0, y: -1 };
  return { point, along, across };
}

function paintBackground(ctx: CanvasRenderingContext2D, scene: PromoScene, t: number, palette: Palette) {
  const { layout } = scene;
  ctx.globalAlpha = 1;
  ctx.fillStyle = rgb(palette.pearl);
  ctx.fillRect(0, 0, layout.width, layout.height);
  const extent = inkExtent(t, layout.vertical ? layout.height : layout.width);
  if (extent > 0) {
    ctx.fillStyle = rgb(palette.ink);
    if (layout.vertical) ctx.fillRect(0, 0, layout.width, extent);
    else ctx.fillRect(0, 0, extent, layout.height);
  }
}

function paintWindow(ctx: CanvasRenderingContext2D, scene: PromoScene, t: number, palette: Palette) {
  const { layout } = scene;
  const win = layout.window;
  const chart = layout.chart;
  const appear = fade(t, 21_800, 22_300) * (1 - easeInOut(progress(t, 25_300, 25_800)));
  if (appear <= 0) return;
  ctx.globalAlpha = appear;
  ctx.fillStyle = rgb(palette.surface);
  ctx.beginPath();
  ctx.roundRect(win.x, win.y, win.w, win.h, win.radius);
  ctx.fill();
  // Fine guides of the chart.
  ctx.strokeStyle = rgba(palette.ink, 0.07);
  ctx.lineWidth = 1;
  for (let k = 0; k <= 3; k++) {
    const y = chart.baseline - (chart.height * k) / 3;
    ctx.beginPath();
    ctx.moveTo(chart.x, y + 0.5);
    ctx.lineTo(chart.x + chart.w, y + 0.5);
    ctx.stroke();
  }
  // The line the points draw, left to right (a hairline underneath them).
  const head = easeOut(progress(t, T.curveFrom, T.curveTo));
  if (head > 0) {
    const maxValue = scene.chart.curve(1) || 1;
    ctx.strokeStyle = rgba(palette.ink, 0.22);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const steps = 120;
    for (let k = 0; k <= steps; k++) {
      const u = (k / steps) * head;
      const x = chart.x + u * chart.w;
      const y = chart.baseline - (scene.chart.curve(u) / maxValue) * chart.height;
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function paintPoints(ctx: CanvasRenderingContext2D, scene: PromoScene, buf: PointBuffer, palette: Palette) {
  let lastStyle = "";
  for (let i = 0; i < scene.n; i++) {
    const alpha = buf.alpha[i]!;
    if (alpha < 0.01) continue;
    const inverse = buf.inverse[i]!;
    const style = inverse <= 0.002 ? "ink" : inverse >= 0.998 ? "inverse" : mixRgb(palette.ink, palette.inverse, inverse);
    if (style !== lastStyle) {
      ctx.fillStyle = style === "ink" ? rgb(palette.ink) : style === "inverse" ? rgb(palette.inverse) : style;
      lastStyle = style;
    }
    ctx.globalAlpha = alpha;
    const radius = buf.size[i]! / 2;
    ctx.beginPath();
    ctx.arc(buf.x[i]!, buf.y[i]!, radius, 0, TWO_PI);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function paintRailMarks(ctx: CanvasRenderingContext2D, scene: PromoScene, t: number, palette: Palette) {
  const { layout } = scene;
  const visible = fade(t, 9700, 10_000) * (1 - fade(t, 20_300, 20_500));
  if (visible <= 0) return;
  const bead = layout.bead;

  // Barrier of the human validation: a thin line, never a tile (distinct from the agents).
  const barrier = railFrame(scene, 3).point;
  const barrierFade = fade(t, 9500, 10_000) * (1 - fade(t, 20_300, 20_500));
  const open = easeInOut(progress(t, T.barrierOpenFrom, T.barrierOpenFrom + T.barrierOpenMs));
  const half = (layout.vertical ? 54 : 48) * Math.sqrt(layout.pointScale);
  const angle = (layout.vertical ? 0 : Math.PI / 2) + open * (Math.PI / 2);
  ctx.globalAlpha = barrierFade;
  ctx.strokeStyle = rgb(palette.inverse);
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  const bx = Math.cos(angle) * half;
  const by = Math.sin(angle) * half;
  ctx.beginPath();
  ctx.moveTo(barrier.x - bx, barrier.y - by);
  ctx.lineTo(barrier.x + bx, barrier.y + by);
  ctx.stroke();

  // Hollow tokens waiting in front of the barrier (three at most).
  const waitFade = fade(t, STATION_ARRIVAL.human, STATION_ARRIVAL.human + 400) * (1 - fade(t, T.barrierOpenFrom, T.barrierOpenFrom + 300));
  if (waitFade > 0) {
    const { point: waitPoint, along } = railFrame(scene, WAIT_STATION);
    ctx.strokeStyle = rgb(palette.inverse);
    ctx.lineWidth = 1.5;
    for (let k = 0; k < 3; k++) {
      ctx.globalAlpha = waitFade * 0.5 * visible;
      const distance = (30 + k * 24) * Math.sqrt(layout.pointScale);
      ctx.beginPath();
      ctx.arc(waitPoint.x - along.x * distance, waitPoint.y - along.y * distance, bead.diameter * 0.75, 0, TWO_PI);
      ctx.stroke();
    }
  }

  // The dossier: a small sheet carried by a cobalt bead with a fine trail.
  const bornFade = fade(t, T.dossierBornFrom, T.dossierBornFrom + 300) * visible;
  if (bornFade > 0) {
    ctx.fillStyle = rgb(palette.accent);
    for (let k = bead.trail; k >= 1; k--) {
      const lag = dossierStation(t - k * 38);
      const { point } = railFrame(scene, lag);
      ctx.globalAlpha = bornFade * lerp(0.45, 0.08, (k - 1) / Math.max(1, bead.trail - 1));
      circle(ctx, point.x, point.y, lerp(bead.diameter * 0.8, bead.diameter * 0.4, (k - 1) / Math.max(1, bead.trail - 1)));
    }
    const s = dossierStation(t);
    const { point, across } = railFrame(scene, s);
    ctx.globalAlpha = bornFade;
    circle(ctx, point.x, point.y, bead.diameter);
    const { width, height, rise } = layout.dossier;
    const sx = point.x + across.x * (rise * 0.6 + (layout.vertical ? width / 2 : 0)) - width / 2;
    const sy = point.y + across.y * (rise * 0.6 + (layout.vertical ? 0 : height / 2)) - height / 2;
    ctx.fillStyle = rgb(palette.inverse);
    ctx.beginPath();
    ctx.roundRect(sx, sy, width, height, 3);
    ctx.fill();
    ctx.fillStyle = rgb(palette.ink);
    ctx.globalAlpha = bornFade * 0.55;
    for (let k = 0; k < 3; k++) ctx.fillRect(sx + 4, sy + 7 + k * 6, width - 8 - (k === 2 ? 6 : 0), 1.6);
  }

  // The cobalt point of the human validation, with its single ring.
  const pointAt = T.humanPointAt;
  const pointFade = fade(t, pointAt, pointAt + 200) * (1 - fade(t, T.barrierOpenFrom + 200, T.barrierOpenFrom + 600)) * visible;
  if (pointFade > 0) {
    ctx.globalAlpha = pointFade;
    ctx.fillStyle = rgb(palette.accent);
    circle(ctx, barrier.x, barrier.y, 8 * Math.sqrt(layout.pointScale));
    const ring = progress(t, pointAt, pointAt + T.ringMs);
    if (ring > 0 && ring < 1) {
      ctx.globalAlpha = (1 - easeOut(ring)) * visible;
      ctx.strokeStyle = rgb(palette.accent);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(barrier.x, barrier.y, lerp(3, 14, easeOut(ring)) * Math.sqrt(layout.pointScale) * 1.2, 0, TWO_PI);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

function paintHandBeads(ctx: CanvasRenderingContext2D, scene: PromoScene, t: number, palette: Palette) {
  const { layout } = scene;
  const visible = fade(t, T.handsFormed, T.handsFormed + 300);
  if (visible <= 0 || scene.beads.length === 0) return;
  const elapsed = (Math.min(t, T.contactAt) - T.handsFormed) / 1000;
  const unit = layout.hands.unit;
  const origin = layout.hands.origin;
  const ap = approach(t);
  const tmp = { x: 0, y: 0 };
  ctx.fillStyle = rgb(palette.accent);
  for (const bead of scene.beads) {
    const rail = scene.armRails[bead.rail]!;
    const length = railLength(rail);
    if (length <= 0) continue;
    const head = bead.start + (HAND_BEAD_SPEED_PX / unit) * Math.max(0, elapsed);
    for (let k = layout.bead.trail; k >= 0; k--) {
      const s = (((head - (k * layout.bead.trailGap) / unit) % length) + length) % length;
      pointOnRail(rail, s, tmp);
      const move = handMove(scene.handsTips, tmp.x, tmp.y);
      const x = origin.x + (tmp.x + move.x * ap) * unit;
      const y = origin.y + (tmp.y + move.y * ap) * unit;
      const ratio = k / Math.max(1, layout.bead.trail);
      ctx.globalAlpha = visible * (k === 0 ? 1 : lerp(0.45, 0.08, ratio));
      circle(ctx, x, y, k === 0 ? layout.bead.diameter : lerp(layout.bead.diameter * 0.8, layout.bead.diameter * 0.4, ratio));
    }
  }
  ctx.globalAlpha = 1;
}

function paintSignature(ctx: CanvasRenderingContext2D, scene: PromoScene, t: number, palette: Palette, assets: PaintAssets) {
  const { layout } = scene;
  const origin = layout.hands.origin;
  const dotGrow = easeOut(progress(t, T.contactAt, T.contactAt + T.contactDotMs));
  if (dotGrow <= 0) return;
  const birth = easeOut(progress(t, T.logoFrom, T.logoFrom + T.logoMs));
  const logoCenter = layout.logo.center;
  const dotRest: Vec = { x: logoCenter.x, y: logoCenter.y + layout.logo.height / 2 + 30 };

  // The cobalt contact point: 4 px to 10 px, then it settles under the logo as an accent (8 px).
  const diameter = lerp(lerp(4, 10, dotGrow), 8, birth) * layout.pointScale;
  const dx = lerp(origin.x, dotRest.x, birth);
  const dy = lerp(origin.y, dotRest.y, birth);
  const logoCenterNow: Vec = { x: lerp(origin.x, logoCenter.x, birth), y: lerp(origin.y, logoCenter.y, birth) };

  if (birth > 0 && assets.logo) {
    const height = layout.logo.height * lerp(0.2, 1, birth);
    const width = height * assets.logoAspect;
    ctx.globalAlpha = birth;
    ctx.drawImage(assets.logo, logoCenterNow.x - width / 2, logoCenterNow.y - height / 2, width, height);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = rgb(palette.accent);
  circle(ctx, dx, dy, diameter);
}

/** Soft pearl veil under the DOM text layer so that the logo reads over the hands. */
function paintLogoVeil(ctx: CanvasRenderingContext2D, scene: PromoScene, t: number, palette: Palette) {
  const { layout } = scene;
  const birth = easeOut(progress(t, T.logoFrom, T.logoFrom + T.logoMs));
  if (birth <= 0) return;
  const logoCenter = layout.logo.center;
  const center: Vec = { x: lerp(layout.hands.origin.x, logoCenter.x, birth), y: lerp(layout.hands.origin.y, logoCenter.y, birth) };
  const radius = layout.logo.height * 1.05;
  const gradient = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, radius);
  gradient.addColorStop(0, rgba(palette.pearl, 0.92));
  gradient.addColorStop(0.62, rgba(palette.pearl, 0.8));
  gradient.addColorStop(1, rgba(palette.pearl, 0));
  ctx.globalAlpha = birth;
  ctx.fillStyle = gradient;
  ctx.fillRect(center.x - radius, center.y - radius, radius * 2, radius * 2);
  ctx.globalAlpha = 1;
}

/** Paints one complete frame of the film at `t` (ms). Pure with respect to the canvas it is given. */
export function paintFrame(
  ctx: CanvasRenderingContext2D,
  marks: CanvasRenderingContext2D,
  scene: PromoScene,
  buf: PointBuffer,
  t: number,
  palette: Palette,
  assets: PaintAssets,
): void {
  paintBackground(ctx, scene, t, palette);
  paintWindow(ctx, scene, t, palette);
  paintPoints(ctx, scene, buf, palette);
  paintLogoVeil(ctx, scene, t, palette);
  // The marks (dossier, barrier, beads, contact point, logo) sit above the DOM layer.
  marks.clearRect(0, 0, scene.layout.width, scene.layout.height);
  paintRailMarks(marks, scene, t, palette);
  paintHandBeads(marks, scene, t, palette);
  paintSignature(marks, scene, t, palette, assets);
}
