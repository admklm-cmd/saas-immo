/**
 * Canvas 2D painter of the living background. Stateless apart from a cache of
 * text widths: it paints whatever `buildFrame` produced.
 *
 * Opacities stay low (the page text always wins): grey links, grey prospects,
 * a single cobalt accent for signals, active stages and the human gate.
 *
 * `frame.presence` (1 = reference) raises the network a little in the scenes
 * that ask for it: every term below multiplies by `presence` or adds a share
 * of `presence - 1`, so a presence of 1 draws exactly the reference frame.
 */

import { GATE_STOP, GOAL_STOP } from "./scenes";
import type { Frame, NodeDraw } from "./types";

export type Rgb = readonly [number, number, number];

export type Palette = { ink: Rgb; line: Rgb; accent: Rgb; paper: Rgb };

export const DEFAULT_PALETTE: Palette = {
  ink: [24, 24, 27],
  line: [150, 150, 160],
  accent: [36, 87, 255],
  paper: [255, 255, 255],
};

export type DrawOptions = {
  width: number;
  height: number;
  dpr: number;
  /** Global opacity multiplier: low at rest, slightly higher while scrolling. */
  intensity: number;
  compact: boolean;
  palette?: Palette;
};

/** Share of the extra presence given to sizes (nodes, prospects, signals) and to the main links. */
const LIFT = { node: 0.9, mote: 0.35, signal: 0.3, strongLink: 1, strongWidth: 0.6, label: 0.5 };

/** Upper opacities, before `intensity` and each element's own presence. */
const ALPHA = {
  skeleton: 0.16,
  trail: 0.42,
  node: 0.42,
  label: 0.5,
  signal: 0.85,
  mote: 0.3,
  fragment: 0.8,
  mark: 0.6,
};

const FONT_STACK = 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
const widths = new Map<string, number>();

function rgba([r, g, b]: Rgb, alpha: number): string {
  return `rgba(${r},${g},${b},${alpha < 0 ? 0 : alpha > 1 ? 1 : alpha.toFixed(3)})`;
}

export function parseColor(value: string | null | undefined, fallback: Rgb): Rgb {
  const hex = value?.trim().match(/^#([0-9a-f]{6})$/i)?.[1];
  if (!hex) return fallback;
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

export function drawFrame(ctx: CanvasRenderingContext2D, frame: Frame, options: DrawOptions) {
  const palette = options.palette ?? DEFAULT_PALETTE;
  const level = options.intensity;
  const presence = frame.presence;
  const lift = presence - 1;
  ctx.setTransform(options.dpr, 0, 0, options.dpr, 0, 0);
  ctx.clearRect(0, 0, options.width, options.height);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Ambient prospects.
  for (const mote of frame.motes) {
    if (mote.alpha <= 0.01) continue;
    ctx.fillStyle = rgba(palette.ink, ALPHA.mote * mote.alpha * level * presence);
    ctx.beginPath();
    ctx.arc(mote.x, mote.y, mote.r * (1 + lift * LIFT.mote), 0, Math.PI * 2);
    ctx.fill();
  }

  // Links: the structure first, then the trails that connect and fade.
  ctx.lineWidth = 1;
  for (const link of frame.links) {
    if (link.alpha <= 0.01) continue;
    ctx.setLineDash(link.dashed && !link.trail ? [3, 7] : []);
    const strong = link.strong ? lift : 0;
    ctx.strokeStyle = rgba(
      palette.line,
      (link.trail ? ALPHA.trail : ALPHA.skeleton) * link.alpha * level * presence * (1 + strong * LIFT.strongLink),
    );
    ctx.lineWidth = link.trail ? 1.25 : 1 + strong * LIFT.strongWidth;
    ctx.beginPath();
    ctx.moveTo(link.x1, link.y1);
    ctx.lineTo(link.x2, link.y2);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  for (const node of frame.nodes) drawNode(ctx, node, palette, level, presence, options);

  // Signals (fictitious files).
  for (const token of frame.tokens) {
    if (token.alpha <= 0.01) continue;
    const alpha = ALPHA.signal * token.alpha * level * presence;
    if (!token.still) {
      ctx.strokeStyle = rgba(palette.accent, alpha * 0.4);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(token.tx, token.ty);
      ctx.lineTo(token.x, token.y);
      ctx.stroke();
    }
    ctx.fillStyle = rgba(palette.accent, alpha);
    ctx.beginPath();
    ctx.arc(token.x, token.y, (options.compact ? 2 : 2.6) * (1 + lift * LIFT.signal), 0, Math.PI * 2);
    ctx.fill();
  }

  // Halted impulses and confirmations.
  for (const mark of frame.marks) {
    if (mark.alpha <= 0.01) continue;
    const alpha = ALPHA.mark * mark.alpha * level;
    ctx.save();
    ctx.translate(mark.x, mark.y);
    if (mark.kind === "halt") {
      ctx.rotate(mark.angle + Math.PI / 2);
      ctx.strokeStyle = rgba(palette.ink, alpha);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-5, 0);
      ctx.lineTo(5, 0);
      ctx.stroke();
    } else {
      ctx.strokeStyle = rgba(palette.accent, alpha);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-3.5, -9);
      ctx.lineTo(-1, -6.5);
      ctx.lineTo(3.5, -11.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (!options.compact) drawFragments(ctx, frame, palette, level, options);
}

function drawNode(
  ctx: CanvasRenderingContext2D,
  node: NodeDraw,
  palette: Palette,
  level: number,
  presence: number,
  options: DrawOptions,
) {
  if (node.alpha <= 0.01) return;
  const lift = presence - 1;
  const alpha = ALPHA.node * node.alpha * level * presence;
  const active = node.activity * node.alpha * level;
  const size = (options.compact ? 3.4 : 4.6) * (1 + lift * LIFT.node * node.variance);

  if (node.stop === 0) {
    ctx.fillStyle = rgba(palette.ink, alpha * 0.6);
    ctx.beginPath();
    ctx.arc(node.x, node.y, 1.6, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  // Halo of an active stage (cobalt), then the stage itself on paper.
  if (active > 0.02) {
    ctx.fillStyle = rgba(palette.accent, 0.12 * active * presence);
    ctx.beginPath();
    ctx.arc(node.x, node.y, size + 7 * node.activity, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = rgba(palette.paper, node.alpha);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  if (node.stop === GATE_STOP) {
    // The human gate: a diamond, always outlined in cobalt.
    ctx.moveTo(node.x, node.y - size - 1.5);
    ctx.lineTo(node.x + size + 1.5, node.y);
    ctx.lineTo(node.x, node.y + size + 1.5);
    ctx.lineTo(node.x - size - 1.5, node.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = rgba(palette.accent, Math.min(1, alpha * 1.4));
  } else if (node.stop === GOAL_STOP) {
    ctx.rect(node.x - size, node.y - size, size * 2, size * 2);
    ctx.fill();
    ctx.strokeStyle = rgba(palette.ink, alpha);
  } else {
    ctx.arc(node.x, node.y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = rgba(palette.ink, alpha);
  }
  ctx.stroke();

  if (active > 0.02) {
    ctx.fillStyle = rgba(node.stop === GOAL_STOP ? palette.ink : palette.accent, 0.9 * active);
    ctx.beginPath();
    ctx.arc(node.x, node.y, size * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  if (node.label) {
    ctx.font = `500 11px ${FONT_STACK}`;
    const width = measure(ctx, node.label);
    const leftSide = node.x + 10 + width > options.width - 8;
    ctx.textAlign = leftSide ? "right" : "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = rgba(
      palette.ink,
      ALPHA.label * node.alpha * level * (0.7 + 0.3 * node.activity) * (1 + lift * LIFT.label),
    );
    ctx.fillText(node.label, leftSide ? node.x - 10 : node.x + 10, node.y + 0.5);
  }
}

function drawFragments(ctx: CanvasRenderingContext2D, frame: Frame, palette: Palette, level: number, options: DrawOptions) {
  ctx.font = `500 10.5px ${FONT_STACK}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  for (const fragment of frame.fragments) {
    if (fragment.alpha <= 0.02) continue;
    const alpha = ALPHA.fragment * fragment.alpha * level;
    const width = measure(ctx, fragment.text) + 16;
    const height = 20;
    let x = fragment.x + 12;
    const y = Math.max(4, fragment.y - 30);
    if (x + width > options.width - 8) x = fragment.x - 12 - width;
    ctx.fillStyle = rgba(palette.paper, 0.92 * fragment.alpha);
    ctx.strokeStyle = rgba(palette.line, 0.55 * alpha);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = rgba(palette.ink, 0.72 * alpha);
    ctx.fillText(fragment.text, x + 8, y + height / 2 + 0.5);
  }
}

function measure(ctx: CanvasRenderingContext2D, text: string): number {
  const key = `${ctx.font}|${text}`;
  let width = widths.get(key);
  if (width === undefined) {
    width = ctx.measureText(text).width;
    widths.set(key, width);
  }
  return width;
}
