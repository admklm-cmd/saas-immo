import { createPrng } from "@/components/motion/engine/prng";

import { SEEDS } from "./hero-config";
import { emptyShape, type Shape } from "./shapes";

/**
 * The two hands of the final image, decoded from the data baked by `scripts/bake-hero-hands.mjs`
 * (docs/design-system.md §2.11.4 ter G). The engine only knows this shape of data: replacing the
 * source picture means re-running the script, never touching the engine.
 */
export type BakedHands = {
  readonly version: number;
  readonly count: number;
  readonly range: number;
  /** Height / width of the source picture. */
  readonly aspect: number;
  readonly tips: { readonly left: readonly number[]; readonly right: readonly number[] };
  readonly gap: number;
  /** Polylines (normalised, y down) the nanorobots follow. */
  readonly rails: readonly (readonly (readonly number[])[])[];
  /** Base64 of `count` records of 5 bytes: x (u16), y (u16), tone (u8). */
  readonly points: string;
};

export type Hands = {
  /** Unit = width of the source picture, origin = middle of the two index tips, y down. */
  readonly shape: Shape;
  /** Darkness of the source at each point, 0..1. */
  readonly tone: Float32Array;
  readonly tips: { readonly left: readonly [number, number]; readonly right: readonly [number, number] };
  readonly rails: readonly (readonly (readonly [number, number])[])[];
  readonly gap: number;
};

function bytesOf(base64: string): Uint8Array {
  const text = atob(base64);
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
  return bytes;
}

/**
 * Decodes the first `count` points (the baked order is shuffled, so any prefix is a fair sample);
 * fewer baked points than asked are reused with a sub-pixel offset.
 */
export function decodeHands(baked: BakedHands, count: number): Hands {
  const bytes = bytesOf(baked.points);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const random = createPrng(SEEDS.wave);
  const shape = emptyShape(count);
  const tone = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const record = i % baked.count;
    const jitter = i < baked.count ? 0 : (random() - 0.5) * 0.0015;
    shape.x[i] = (view.getUint16(record * 5, true) / 65535 - 0.5) * baked.range + jitter;
    shape.y[i] = (view.getUint16(record * 5 + 2, true) / 65535 - 0.5) * baked.range + jitter;
    shape.z[i] = (random() - 0.5) * 0.12;
    tone[i] = view.getUint8(record * 5 + 4) / 255;
  }
  const pair = (value: readonly number[]): [number, number] => [value[0]!, value[1]!];
  return {
    shape,
    tone,
    tips: { left: pair(baked.tips.left), right: pair(baked.tips.right) },
    rails: baked.rails.map((rail) => rail.map(pair)),
    gap: baked.gap,
  };
}

/** Loads the baked json on demand (its own chunk: the cloud, the sphere and the apple do not wait for it). */
export async function loadBakedHands(): Promise<BakedHands> {
  const loaded = await import("./hands.baked.json");
  return loaded.default as unknown as BakedHands;
}
