/**
 * Test helper (not a test file): a fake 2D context that records every call of
 * the living background renderer and measures the "ink" it lays down.
 *
 * Ink = Σ opacity × covered area, per stroke (line width × path length, dashes
 * counted by their filled share) and per fill (arcs, rectangles, polygons).
 * White-on-white fills (the paper colour) are ignored: they do not show. Text is
 * ignored too (labels and fragments are unchanged by the scene emphasis). It is
 * a coarse but stable proxy of how visible the network is, used to keep the
 * extra visibility of the problem and agents scenes within its agreed range.
 */

import { createHash } from "node:crypto";

import { drawFrame, type DrawOptions, type Palette } from "./renderer";
import type { Frame } from "./types";

export type Recording = {
  calls: string[];
  /** Total ink, grey and cobalt. */
  ink: number;
  /** Ink laid down with the accent colour only. */
  accentInk: number;
  /** Every stroke style used by a stroke() call. */
  strokes: string[];
};

type Rgba = { r: number; g: number; b: number; a: number };

function parse(style: unknown): Rgba | null {
  const match = typeof style === "string" ? style.match(/^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/) : null;
  if (!match) return null;
  return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]), a: Number(match[4]) };
}

export function recordDraw(frame: Frame, options: Partial<DrawOptions> & { palette?: Palette } = {}): Recording {
  const palette = options.palette;
  const paper = palette?.paper ?? [255, 255, 255];
  const accent = palette?.accent ?? [36, 87, 255];
  const recording: Recording = { calls: [], ink: 0, accentInk: 0, strokes: [] };
  const style: Record<string, unknown> = { lineWidth: 1, strokeStyle: "", fillStyle: "" };
  let dash: number[] = [];
  let length = 0;
  let area = 0;
  let polygon: [number, number][] = [];
  const polygons: [number, number][][] = [];
  let cursor: [number, number] = [0, 0];

  const isAccent = (color: Rgba) => color.r === accent[0] && color.g === accent[1] && color.b === accent[2];
  const isPaper = (color: Rgba) => color.r === paper[0] && color.g === paper[1] && color.b === paper[2];
  const closePolygon = () => {
    if (polygon.length > 2) polygons.push(polygon);
    polygon = [];
  };
  const shoelace = (points: [number, number][]) => {
    let sum = 0;
    for (let index = 0; index < points.length; index++) {
      const [x1, y1] = points[index] ?? [0, 0];
      const [x2, y2] = points[(index + 1) % points.length] ?? [0, 0];
      sum += x1 * y2 - x2 * y1;
    }
    return Math.abs(sum) / 2;
  };

  const methods: Record<string, (...args: never[]) => void> = {
    beginPath: () => {
      length = 0;
      area = 0;
      polygon = [];
      polygons.length = 0;
    },
    moveTo: (x: number, y: number) => {
      closePolygon();
      cursor = [x, y];
      polygon = [[x, y]];
    },
    lineTo: (x: number, y: number) => {
      length += Math.hypot(x - cursor[0], y - cursor[1]);
      cursor = [x, y];
      polygon.push([x, y]);
    },
    closePath: () => {
      const first = polygon[0];
      if (first) length += Math.hypot(first[0] - cursor[0], first[1] - cursor[1]);
      closePolygon();
    },
    arc: (_x: number, _y: number, r: number) => {
      length += 2 * Math.PI * r;
      area += Math.PI * r * r;
    },
    rect: (_x: number, _y: number, w: number, h: number) => {
      length += 2 * (Math.abs(w) + Math.abs(h));
      area += Math.abs(w * h);
    },
    roundRect: (_x: number, _y: number, w: number, h: number) => {
      length += 2 * (Math.abs(w) + Math.abs(h));
      area += Math.abs(w * h);
    },
    setLineDash: (segments: unknown) => {
      dash = Array.isArray(segments) ? (segments as number[]) : [];
    },
    stroke: () => {
      const color = parse(style.strokeStyle);
      recording.strokes.push(String(style.strokeStyle));
      if (!color || isPaper(color)) return;
      const share = dash.length === 2 ? (dash[0] ?? 0) / ((dash[0] ?? 0) + (dash[1] ?? 1)) : 1;
      const ink = color.a * Number(style.lineWidth) * length * share;
      recording.ink += ink;
      if (isAccent(color)) recording.accentInk += ink;
    },
    fill: () => {
      const color = parse(style.fillStyle);
      if (!color || isPaper(color)) return;
      const shapes = [...polygons, ...(polygon.length > 2 ? [polygon] : [])];
      const ink = color.a * (area + shapes.reduce((sum, shape) => sum + shoelace(shape), 0));
      recording.ink += ink;
      if (isAccent(color)) recording.accentInk += ink;
    },
  };

  const target: Record<string, unknown> = {
    measureText: (text: string) => ({ width: text.length * 6 }),
  };
  const context = new Proxy(target, {
    get(object, key: string) {
      if (key in object) return object[key];
      return (...args: unknown[]) => {
        recording.calls.push(`${key}(${JSON.stringify(args)})`);
        (methods[key] as ((...values: unknown[]) => void) | undefined)?.(...args);
      };
    },
    set(_object, key: string, value: unknown) {
      recording.calls.push(`${key}=${JSON.stringify(value)}`);
      style[key] = value;
      return true;
    },
  });

  drawFrame(context as unknown as CanvasRenderingContext2D, frame, {
    width: 1440,
    height: 900,
    dpr: 1,
    intensity: 0.72,
    compact: false,
    ...options,
  });
  return recording;
}

/** Short, stable fingerprint of a list of drawing calls. */
export function digest(calls: readonly string[]): string {
  return createHash("sha256").update(calls.join("\n")).digest("hex").slice(0, 16);
}
