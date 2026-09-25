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
 *
 * The mesh (problem and agents scenes) is drawn first, behind everything: grey
 * hairlines, never the accent colour, each opacity capped by `MESH.linkCap`
 * (a scene with a mesh profile, agents, gives each hairline its own opacity
 * and width, draws every vertex and sends route impulses: see mesh-style.ts).
 * Its cobalt impulses move; nothing at rest is cobalt. No shadow, no blur, no
 * gradient: flat strokes and fills only. Other scenes have no mesh at all,
 * so none of these calls happen there.
 */

import { GATE_STOP, GOAL_STOP } from "./scenes";
import type { Frame, NodeDraw, PulseDraw } from "./types";

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
const LIFT = {
  node: 0.9,
  /** Outline opacity of the stages. */
  nodeAlpha: 0.2,
  /** Cobalt disc of an active stage (its pulsation). */
  halo: 0.6,
  mote: 0.35,
  signal: 0.3,
  strongLink: 1.2,
  strongWidth: 0.6,
  label: 0.5,
};

/** Mesh: grey hairlines (near / far plane), vertex dots, cobalt impulses. */
const MESH = {
  link: 0.079,
  /** Phones: fewer prospects, hence a sparser mesh; each hairline slightly firmer. */
  compactLink: 2,
  /** Upper opacity of a single mesh link, whatever the intensity. */
  linkCap: 0.08,
  farLink: 0.55,
  width: 0.8,
  farWidth: 0.55,
  point: 0.22,
  farPoint: 0.6,
  pointRadius: 1,
  farPointRadius: 0.7,
  pulse: 0.75,
  pulseRadius: 1.8,
  pulseRadiusCompact: 1.4,
};

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

  if (frame.meshLinks.length > 0 || frame.meshPoints.length > 0) drawMesh(ctx, frame, palette, level, options.compact);

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

  // Impulses of the mesh: small cobalt dots with a short tail, no glow.
  for (const pulse of frame.pulses) {
    if (pulse.trail) {
      drawRoutePulse(ctx, pulse, palette, level);
      continue;
    }
    if (pulse.alpha <= 0.01) continue;
    const alpha = MESH.pulse * pulse.alpha * level;
    ctx.strokeStyle = rgba(palette.accent, alpha * 0.4);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(pulse.tx, pulse.ty);
    ctx.lineTo(pulse.x, pulse.y);
    ctx.stroke();
    ctx.fillStyle = rgba(palette.accent, alpha);
    ctx.beginPath();
    ctx.arc(pulse.x, pulse.y, options.compact ? MESH.pulseRadiusCompact : MESH.pulseRadius, 0, Math.PI * 2);
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

function drawMesh(ctx: CanvasRenderingContext2D, frame: Frame, palette: Palette, level: number, compact: boolean) {
  const base = MESH.link * level * (compact ? MESH.compactLink : 1);
  for (const link of frame.meshLinks) {
    // A mesh profile (agents) gives its own final opacity and width.
    const alpha =
      link.width !== undefined
        ? link.alpha * level
        : Math.min(MESH.linkCap, base * link.alpha * (link.far ? MESH.farLink : 1));
    if (alpha <= 0.002) continue;
    ctx.strokeStyle = rgba(palette.line, alpha);
    ctx.lineWidth = link.width ?? (link.far ? MESH.farWidth : MESH.width);
    ctx.beginPath();
    if (link.parts) {
      // Pieces left around the labels, still one stroke per link.
      for (const [from, to] of link.parts) {
        ctx.moveTo(link.x1 + (link.x2 - link.x1) * from, link.y1 + (link.y2 - link.y1) * from);
        ctx.lineTo(link.x1 + (link.x2 - link.x1) * to, link.y1 + (link.y2 - link.y1) * to);
      }
    } else {
      ctx.moveTo(link.x1, link.y1);
      ctx.lineTo(link.x2, link.y2);
    }
    ctx.stroke();
  }
  // Mesh profile: every vertex, a small grey dot; a hub, an outlined circle.
  for (const point of frame.meshPoints) {
    const look = point.look;
    if (!look || look.alpha * level <= 0.005) continue;
    const alpha = look.alpha * level;
    ctx.beginPath();
    ctx.arc(point.x, point.y, look.r, 0, Math.PI * 2);
    if (look.hub) {
      ctx.fillStyle = rgba(palette.paper, Math.min(1, alpha * 2));
      ctx.fill();
      ctx.strokeStyle = rgba(palette.ink, alpha);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = rgba(palette.ink, alpha);
      ctx.beginPath();
      ctx.arc(point.x, point.y, 1.1, 0, Math.PI * 2);
    } else {
      ctx.fillStyle = rgba(palette.ink, alpha);
    }
    ctx.fill();
  }
  // Vertices left by a prospect that went towards the entry.
  for (const point of frame.meshPoints) {
    const alpha = MESH.point * point.alpha * frame.mesh * level * (point.far ? MESH.farPoint : 1);
    if (alpha <= 0.005) continue;
    ctx.fillStyle = rgba(palette.ink, alpha);
    ctx.beginPath();
    ctx.arc(point.x, point.y, point.far ? MESH.farPointRadius : MESH.pointRadius, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Impulse of a mesh profile: the vertex it reached (brief cobalt disc), a tail
 * in segments of decreasing opacity and width along its route, then the dot.
 * Flat fills and strokes only: no shadow, no blur, no gradient.
 */
function drawRoutePulse(ctx: CanvasRenderingContext2D, pulse: PulseDraw, palette: Palette, level: number) {
  const flash = pulse.flash;
  if (flash && flash.alpha * level > 0.01) {
    ctx.fillStyle = rgba(palette.accent, flash.alpha * level);
    ctx.beginPath();
    ctx.arc(flash.x, flash.y, flash.r, 0, Math.PI * 2);
    ctx.fill();
  }
  if (pulse.alpha <= 0.01 || !pulse.trail) return;
  const alpha = pulse.alpha * level;
  const trail = pulse.trail;
  const pieces = trail.length / 2 - 1;
  const width = pulse.trailWidth ?? 1.4;
  for (let piece = 0; piece < pieces; piece++) {
    const x1 = trail[piece * 2] ?? 0;
    const y1 = trail[piece * 2 + 1] ?? 0;
    const x2 = trail[piece * 2 + 2] ?? x1;
    const y2 = trail[piece * 2 + 3] ?? y1;
    if (Math.hypot(x2 - x1, y2 - y1) < 0.3) continue;
    ctx.strokeStyle = rgba(palette.accent, alpha * 0.62 * (1 - piece / pieces));
    ctx.lineWidth = width * (1 - (0.5 * piece) / pieces);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.fillStyle = rgba(palette.accent, alpha);
  ctx.beginPath();
  ctx.arc(pulse.x, pulse.y, pulse.r ?? MESH.pulseRadius, 0, Math.PI * 2);
  ctx.fill();
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
  const alpha = ALPHA.node * node.alpha * level * presence * (1 + lift * LIFT.nodeAlpha);
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
    ctx.fillStyle = rgba(palette.accent, 0.12 * active * presence * (1 + lift * LIFT.halo));
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
