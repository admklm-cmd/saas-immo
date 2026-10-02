/**
 * Canvas 2D painter of the neural network background
 * (docs/design-system.md §2.11.4), after the user's reference.
 *
 * - Fibers are stroked in GROUPS (opacity to 1/20, width to 1/4 px): one
 *   `stroke()` per group instead of three per fiber — same colour, so the
 *   order of the groups does not change the result.
 * - Camera moving: the network at rest is repainted straight into the
 *   visible canvas. Camera still during a sequence: it is painted once into
 *   an off-screen cache, and each frame = copy of the cache + impulses + lit
 *   cores. Cobalt exists only there: at rest the canvas holds no cobalt pixel.
 * - Side edges softened: the rest opacity of a fiber (by its projected middle)
 *   and of a body (by its centre) × f(u), before the 1/20 quantisation (no
 *   extra group). See composition.ts.
 * - No shadow blur, no CSS filter, no drop shadow. The only gradient is the
 *   discreet halo of a lit core, at the reference values (ceilings).
 *
 * Buffers are allocated when the network changes, never per frame.
 */

import { nearness, projectInto, type Projector } from "./camera";
import { EDGE_FADE, edgeFadeAt, fiberRestAlpha } from "./composition";
import { samplePath, SHAPE_POINTS, type Network } from "./network";
import { bodyFactor, signalFactor, type QuietZones } from "./quiet";
import {
  clampRange,
  createCacheSurface,
  createRestKey,
  DEFAULT_PALETTE,
  dot,
  matchesRest,
  rememberRest,
  rgb,
  surfaceOf,
  type Context2D,
  type Palette,
  type Surface,
} from "./paint-kit";
import type { SignalField } from "./signals";

/** Opacity levels of the fiber groups (1/20). */
const ALPHA_LEVELS = 20;
/** Width levels of the fiber groups (1/4 px, up to 4 px). */
const WIDTH_LEVELS = 16;
const GROUPS = (ALPHA_LEVELS + 1) * WIDTH_LEVELS;
/** Spacing of the 4 trail points behind a head (world units). */
const TRAIL_STEP = 0.0025;
const FADE_IN = 0.009;

export type PaintInput = {
  network: Network;
  projector: Projector;
  /** Pose identity (cache key): any change repaints the network at rest. */
  yaw: number;
  pitch: number;
  zones: QuietZones;
  /** Quiet zones apply to the bodies (not under reduced motion: the canvas never repaints on scroll there). */
  quietBodies: boolean;
  field: SignalField | null;
  time: number;
};

export type PaintStats = {
  /** The network at rest was repainted (camera moved, size or zones changed). */
  repainted: boolean;
  strokes: number;
  pulses: number;
  lit: number;
};

export class NetworkPainter {
  private readonly main: Surface | null;
  private readonly cache: Surface | null;
  private readonly palette: Palette;
  private readonly inkStyle: string;
  private readonly accentStyle: string;
  private readonly highlightStyle: string;
  private readonly coreStyle: string;
  private readonly accentClear: string;
  /** 0.19 / 0.5 of the accent: second stop of the core halo. */
  private readonly accentHalo: string;
  private width = 0;
  private height = 0;
  private dpr = 1;

  private network: Network | null = null;
  private nodeScreen = new Float32Array(0);
  private pointScreen = new Float32Array(0);
  private partFirst = new Uint32Array(0);
  private partLast = new Uint32Array(0);
  private partKey = new Uint16Array(0);
  private partOrder = new Uint32Array(0);
  private readonly groupCount = new Uint32Array(GROUPS + 1);
  private bodyOrder = new Uint16Array(0);
  private readonly sample = new Float64Array(3);
  private readonly projected = new Float64Array(4);

  /** Rest state held by the cache, and rest state of the last visible frame. */
  private readonly cacheKey = createRestKey();
  private readonly mainKey = createRestKey();

  /** Opacity lost at the side edges (composition.ts, § 2.11.4 lever 4; fallback 0.15). */
  private readonly edgeFade: number;

  constructor(canvas: HTMLCanvasElement | null, palette: Palette = DEFAULT_PALETTE, edgeFade = EDGE_FADE) {
    this.palette = palette;
    this.edgeFade = edgeFade;
    this.main = canvas ? surfaceOf(canvas) : null;
    this.cache = this.main ? createCacheSurface() : null;
    this.inkStyle = rgb(palette.ink);
    this.accentStyle = rgb(palette.accent);
    this.highlightStyle = rgb(palette.highlight);
    this.coreStyle = rgb(palette.core);
    this.accentClear = `rgba(${palette.accent[0]}, ${palette.accent[1]}, ${palette.accent[2]}, 0)`;
    this.accentHalo = `rgba(${palette.accent[0]}, ${palette.accent[1]}, ${palette.accent[2]}, 0.38)`;
  }

  /** False in environments without a 2D context (jsdom, very old browsers). */
  get available(): boolean {
    return this.main !== null && this.cache !== null;
  }

  resize(width: number, height: number, dpr: number): void {
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    for (const surface of [this.main, this.cache]) {
      if (!surface) continue;
      surface.canvas.width = Math.max(1, Math.round(width * dpr));
      surface.canvas.height = Math.max(1, Math.round(height * dpr));
    }
    this.cacheKey.valid = false;
    this.mainKey.valid = false;
  }

  setNetwork(network: Network): void {
    if (network === this.network) return;
    this.network = network;
    this.nodeScreen = new Float32Array(network.nodeCount * 4);
    this.pointScreen = new Float32Array(network.pointCount * 2);
    const parts = network.fiberCount * 3;
    this.partFirst = new Uint32Array(parts);
    this.partLast = new Uint32Array(parts);
    this.partKey = new Uint16Array(parts);
    this.partOrder = new Uint32Array(parts);
    this.bodyOrder = new Uint16Array(network.nodeCount);
    this.cacheKey.valid = false;
    this.mainKey.valid = false;
  }

  /** Paints one frame. Returns what was done (for the cost and test attributes). */
  paint(input: PaintInput): PaintStats {
    const stats: PaintStats = { repainted: false, strokes: 0, pulses: 0, lit: 0 };
    if (!this.main || !this.cache || this.width <= 0) return stats;
    this.setNetwork(input.network);
    this.projectNodes(input.projector);

    const context = this.main.context;
    if (!matchesRest(this.mainKey, input)) {
      // The camera moved (or the size, or the text blocks): the network is
      // repainted straight into the visible canvas. Copying a cache here would
      // force its rasterisation on every frame of a scroll.
      stats.strokes = this.paintRest(context, input);
      rememberRest(this.mainKey, input);
      this.cacheKey.valid = false;
      stats.repainted = true;
    } else {
      // Camera still (a sequence playing): copy of the network at rest, built once.
      if (!matchesRest(this.cacheKey, input)) {
        stats.strokes = this.paintRest(this.cache.context, input);
        rememberRest(this.cacheKey, input);
      }
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.globalAlpha = 1;
      context.clearRect(0, 0, this.main.canvas.width, this.main.canvas.height);
      context.drawImage(this.cache.canvas, 0, 0);
    }
    if (input.field) {
      context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      stats.pulses = this.paintPulses(context, input);
      stats.lit = this.paintLitCores(context, input);
      context.globalAlpha = 1;
    }
    return stats;
  }

  private projectNodes(projector: Projector): void {
    const network = this.network!;
    for (let n = 0; n < network.nodeCount; n++) {
      projectInto(projector, network.nodeX[n]!, network.nodeY[n]!, network.nodeZ[n]!, this.nodeScreen, n * 4);
    }
    // Bodies from the farthest to the nearest (insertion sort: 34 items, no allocation).
    const order = this.bodyOrder;
    for (let n = 0; n < network.nodeCount; n++) order[n] = n;
    for (let i = 1; i < network.nodeCount; i++) {
      const item = order[i]!;
      const depth = this.nodeScreen[item * 4 + 2]!;
      let j = i - 1;
      while (j >= 0 && this.nodeScreen[order[j]! * 4 + 2]! < depth) {
        order[j + 1] = order[j]!;
        j--;
      }
      order[j + 1] = item;
    }
  }

  /** Fibers (grouped strokes) and bodies at rest, into the cache. Returns the stroke count. */
  private paintRest(context: Context2D, input: PaintInput): number {
    const network = this.network!;
    const { projector } = input;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = 1;
    context.clearRect(0, 0, this.width * this.dpr + 1, this.height * this.dpr + 1);
    context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = this.inkStyle;
    context.fillStyle = this.inkStyle;

    // Project every point once.
    const points = network.points;
    const screen = this.pointScreen;
    const { cosYaw, sinYaw, cosPitch, sinPitch, size, centerX, centerY } = projector;
    for (let i = 0; i < network.pointCount; i++) {
      const x = points[i * 3]!;
      const y = points[i * 3 + 1]!;
      const z = points[i * 3 + 2]!;
      const rx = x * cosYaw + z * sinYaw;
      const rz = -x * sinYaw + z * cosYaw;
      const ry = y * cosPitch - rz * sinPitch;
      const depth = y * sinPitch + rz * cosPitch;
      const scale = (size * 4.5) / (4.5 + depth);
      screen[i * 2] = centerX + rx * scale;
      screen[i * 2 + 1] = centerY + ry * scale;
    }

    // Three tapered sections per fiber, each assigned to an (opacity, width) group.
    const counts = this.groupCount;
    counts.fill(0);
    let parts = 0;
    for (let f = 0; f < network.fiberCount; f++) {
      const near = nearness(this.nodeScreen[network.fiberOwner[f]! * 4 + 2]!);
      const start = network.fiberStart[f]!;
      const last = network.fiberSize[f]! - 1;
      const middle = start + Math.floor(last / 2);
      const alpha = fiberRestAlpha(near, network.fiberAlpha[f]!) * edgeFadeAt(screen[middle * 2]!, this.width, this.edgeFade);
      const alphaLevel = Math.max(1, Math.round(alpha * ALPHA_LEVELS));
      const width = network.fiberWidth[f]!;
      const endWidth = network.fiberEndWidth[f]!;
      const spread = 0.48 + near * 0.62;
      for (let part = 0; part < 3; part++) {
        const lineWidth = Math.max(0.18, (width * (1 - part / 3) + (endWidth * part) / 3) * spread);
        const widthLevel = Math.min(WIDTH_LEVELS - 1, Math.max(1, Math.round(lineWidth * 4)));
        const key = alphaLevel * WIDTH_LEVELS + widthLevel;
        this.partFirst[parts] = start + Math.floor((last * part) / 3);
        this.partLast[parts] = start + Math.floor((last * (part + 1)) / 3);
        this.partKey[parts] = key;
        counts[key + 1] = counts[key + 1]! + 1;
        parts++;
      }
    }
    for (let k = 0; k < GROUPS; k++) counts[k + 1] = counts[k + 1]! + counts[k]!;
    // counts[k] is now the first slot of group k; fill the order (stable).
    for (let p = 0; p < parts; p++) {
      const key = this.partKey[p]!;
      this.partOrder[counts[key]!] = p;
      counts[key] = counts[key]! + 1;
    }
    let strokes = 0;
    let slot = 0;
    for (let key = 0; key < GROUPS; key++) {
      const end = counts[key]!;
      if (end === slot) continue;
      context.beginPath();
      for (; slot < end; slot++) {
        const p = this.partOrder[slot]!;
        const first = this.partFirst[p]!;
        context.moveTo(screen[first * 2]!, screen[first * 2 + 1]!);
        for (let i = first + 1; i <= this.partLast[p]!; i++) context.lineTo(screen[i * 2]!, screen[i * 2 + 1]!);
      }
      context.globalAlpha = Math.floor(key / WIDTH_LEVELS) / ALPHA_LEVELS;
      context.lineWidth = (key % WIDTH_LEVELS) / 4;
      context.stroke();
      strokes++;
    }

    for (let i = 0; i < network.nodeCount; i++) {
      const node = this.bodyOrder[i]!;
      this.paintBody(context, input, node, 0);
    }
    context.globalAlpha = 1;
    return strokes;
  }

  /** Irregular outline smoothed through the midpoints, and its dark nucleus. */
  private paintBody(context: Context2D, input: PaintInput, node: number, energy: number): void {
    const network = this.network!;
    const sx = this.nodeScreen[node * 4]!;
    const sy = this.nodeScreen[node * 4 + 1]!;
    const near = nearness(this.nodeScreen[node * 4 + 2]!);
    const size = network.nodeR[node]! * input.projector.size * this.nodeScreen[node * 4 + 3]!;
    // Side edges softened (rest opacity × f(u) of the centre), quiet zones on top.
    const quiet = (input.quietBodies ? bodyFactor(input.zones, sx, sy) : 1) * edgeFadeAt(sx, this.width, this.edgeFade);
    const out = this.projected;
    const base = node * SHAPE_POINTS * 3;
    const shape = network.shape;
    context.beginPath();
    projectInto(input.projector, shape[base + 13 * 3]!, shape[base + 13 * 3 + 1]!, shape[base + 13 * 3 + 2]!, out, 0);
    const lastX = out[0]!;
    const lastY = out[1]!;
    projectInto(input.projector, shape[base]!, shape[base + 1]!, shape[base + 2]!, out, 0);
    const firstX = out[0]!;
    const firstY = out[1]!;
    context.moveTo((firstX + lastX) / 2, (firstY + lastY) / 2);
    let qx = firstX;
    let qy = firstY;
    for (let j = 0; j < SHAPE_POINTS; j++) {
      const k = (j + 1) % SHAPE_POINTS;
      projectInto(input.projector, shape[base + k * 3]!, shape[base + k * 3 + 1]!, shape[base + k * 3 + 2]!, out, 0);
      const rx = out[0]!;
      const ry = out[1]!;
      context.quadraticCurveTo(qx, qy, (qx + rx) / 2, (qy + ry) / 2);
      qx = rx;
      qy = ry;
    }
    context.closePath();
    context.fillStyle = this.inkStyle;
    context.globalAlpha = clampRange(0.12 + near * 0.86 + energy * 0.18, 0, 1) * quiet;
    context.fill();
    context.beginPath();
    context.arc(sx, sy, Math.max(0, size * 0.34), 0, Math.PI * 2);
    context.globalAlpha = (0.15 + near * 0.8) * quiet;
    context.fill();
  }

  /** Impulses: trail, two discreet halos, head and its reflection (reference values, ceilings). */
  private paintPulses(context: Context2D, input: PaintInput): number {
    const field = input.field!;
    const network = this.network!;
    const time = input.time;
    const out = this.projected;
    let drawn = 0;
    for (const pulse of field.pulses) {
      if (time < pulse.start || time >= pulse.end) continue;
      const length = network.fiberLength[pulse.fiber]!;
      const front = (time - pulse.start) * pulse.speed;
      if (front < 0 || front > length + pulse.trail) continue;
      samplePath(network, pulse.fiber, pulse.reverse ? length - front : front, this.sample);
      projectInto(input.projector, this.sample[0]!, this.sample[1]!, this.sample[2]!, out, 0);
      const hx = out[0]!;
      const hy = out[1]!;
      const near = nearness(out[2]!);
      const scale = out[3]!;
      const fadeIn = Math.min(1, front / FADE_IN);
      const fadeOut = clampRange((length + pulse.trail - front) / pulse.trail, 0, 1);
      const opacity = (0.55 + near * 0.45) * pulse.strength * fadeIn * fadeOut;
      if (opacity <= 0) continue;
      const radius = (1.45 + near * 0.55) * scale;
      context.fillStyle = this.accentStyle;
      for (let j = 4; j >= 1; j--) {
        const behind = front - j * TRAIL_STEP;
        if (behind < 0 || behind > length) continue;
        samplePath(network, pulse.fiber, pulse.reverse ? length - behind : behind, this.sample);
        projectInto(input.projector, this.sample[0]!, this.sample[1]!, this.sample[2]!, out, 0);
        const quiet = signalFactor(input.zones, out[0]!, out[1]!);
        if (quiet <= 0) continue;
        dot(context, out[0]!, out[1]!, radius * (0.32 + (1 - j / 5) * 0.3), opacity * (1 - j / 5) * 0.27 * quiet);
      }
      const quiet = signalFactor(input.zones, hx, hy);
      if (quiet <= 0) continue;
      const strength = opacity * quiet;
      dot(context, hx, hy, radius * 3.5, strength * 0.035);
      dot(context, hx, hy, radius * 2.1, strength * 0.1);
      dot(context, hx, hy, radius, strength * 0.98);
      context.fillStyle = this.highlightStyle;
      dot(context, hx - radius * 0.12, hy - radius * 0.12, radius * 0.35, strength * 0.9);
      drawn++;
    }
    return drawn;
  }

  /** Lit cores, from the farthest: halo (radial gradient ≤ 0.5 at the centre), body, cobalt core, clear centre. */
  private paintLitCores(context: Context2D, input: PaintInput): number {
    const field = input.field!;
    const network = this.network!;
    let lit = 0;
    for (let i = 0; i < network.nodeCount; i++) {
      const node = this.bodyOrder[i]!;
      const energy = field.energy(node, input.time);
      if (energy <= 0.01) continue;
      lit++;
      const sx = this.nodeScreen[node * 4]!;
      const sy = this.nodeScreen[node * 4 + 1]!;
      const near = nearness(this.nodeScreen[node * 4 + 2]!);
      const size = network.nodeR[node]! * input.projector.size * this.nodeScreen[node * 4 + 3]!;
      const quiet = signalFactor(input.zones, sx, sy);
      if (quiet > 0) {
        const radius = size * 5 + 8;
        const glow = context.createRadialGradient(sx, sy, size * 0.4, sx, sy, radius);
        // Stops 0.5 / 0.19 / 0 of the reference, scaled by globalAlpha below.
        glow.addColorStop(0, this.accentStyle);
        glow.addColorStop(0.3, this.accentHalo);
        glow.addColorStop(1, this.accentClear);
        context.fillStyle = glow;
        context.globalAlpha = energy * 0.5 * (0.4 + near * 0.6) * quiet;
        context.beginPath();
        context.arc(sx, sy, radius, 0, Math.PI * 2);
        context.fill();
      }
      this.paintBody(context, input, node, energy);
      if (energy > 0.025 && quiet > 0) {
        context.fillStyle = this.accentStyle;
        dot(context, sx, sy, Math.max(1.2, size * 0.46), energy * 0.95 * quiet);
        context.fillStyle = this.coreStyle;
        dot(context, sx, sy, Math.max(0.5, size * 0.16), energy * 0.85 * quiet);
      }
    }
    return lit;
  }
}
