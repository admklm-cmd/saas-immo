import { createPrng } from "@/components/motion/engine/prng";

import { FOCAL, SEEDS, SPHERE } from "./hero-config";
import type { Placement } from "./layout";
import { buildSphere, shuffledIndices } from "./shapes";

/**
 * The big sphere of the opening (docs/design-system.md T.2, T.3): every point (identities, then skin) has its
 * place on it; a slow differential rotation around the vertical axis (the equator turns 30 % faster than the
 * poles), a fixed lean, a surface that breathes, a birth that swells it from 60 % of its radius. The
 * per-point trigonometry is done once here: a frame costs multiplications, a handful of sines of the time and one
 * cosine and sine per latitude band.
 */

/** The sphere is read at this time (ms of the sequence) to pair its points with the hands (a one-time assignment). */
export const SPHERE_PAIRING_MS = 3800;
/** Latitude bands of the differential rotation: one cosine and one sine per band and per frame, not per point. */
const BANDS = 48;
const COS_TILT = Math.cos(SPHERE.tilt);
const SIN_TILT = Math.sin(SPHERE.tilt);

/**
 * The one angle that turns the sphere (rad, T in s; docs/design-system.md U.4): 0.22 rad/s up to 2 s, the speed rises
 * smoothly to 0.45 rad/s by 5 s, then stays there. Strictly increasing: the sphere never stops turning.
 */
export function sphereAngle(t: number): number {
  const { spin, spinTo } = SPHERE;
  const u = Math.min(1, Math.max(0, (t - 2) / 3));
  return spin * t + (spinTo - spin) * (3 * (u ** 3 - u ** 4 / 2) + Math.max(0, t - 5));
}

/** Share of the differential rotation (the equator turning faster than the poles) left at `t` s: 1 until 3 s, 0 from 6 s. */
export function differentialShare(t: number): number {
  return 1 - Math.min(1, Math.max(0, (t - 3) / 3));
}

const easeOutCubic = (q: number) => 1 - (1 - Math.min(1, Math.max(0, q))) ** 3;

export class SphereField {
  private readonly cosLat: Float32Array;
  private readonly sinLat: Float32Array;
  private readonly cosLon: Float32Array;
  private readonly sinLon: Float32Array;
  private readonly s3: Float32Array;
  private readonly c3: Float32Array;
  private readonly s2: Float32Array;
  private readonly c2: Float32Array;
  private readonly s5: Float32Array;
  private readonly c5: Float32Array;
  private readonly band: Uint8Array;
  private readonly birth: Float32Array;
  private readonly bandCos = new Float32Array(BANDS);
  private readonly bandSin = new Float32Array(BANDS);
  private readonly bandLat = new Float32Array(BANDS);

  constructor(readonly total: number) {
    // Identities and skin are interleaved by a seeded shuffle of the lattice.
    const field = buildSphere(total);
    const order = shuffledIndices(total, SEEDS.sphere);
    this.cosLat = new Float32Array(total);
    this.sinLat = new Float32Array(total);
    this.cosLon = new Float32Array(total);
    this.sinLon = new Float32Array(total);
    this.s3 = new Float32Array(total);
    this.c3 = new Float32Array(total);
    this.s2 = new Float32Array(total);
    this.c2 = new Float32Array(total);
    this.s5 = new Float32Array(total);
    this.c5 = new Float32Array(total);
    this.band = new Uint8Array(total);
    this.birth = new Float32Array(total);
    const spread = createPrng(SEEDS.skin);
    for (let i = 0; i < total; i++) {
      const source = order[i]!;
      const fx = field.x[source]! / 0.5;
      const fy = field.y[source]! / 0.5;
      const fz = field.z[source]! / 0.5;
      const cosLat = Math.hypot(fx, fz);
      const sinLat = -fy;
      const lat = Math.atan2(sinLat, cosLat);
      const lon = Math.atan2(fz, fx);
      this.cosLat[i] = cosLat;
      this.sinLat[i] = sinLat;
      this.cosLon[i] = Math.cos(lon);
      this.sinLon[i] = Math.sin(lon);
      this.s3[i] = Math.sin(3 * lon);
      this.c3[i] = Math.cos(3 * lon);
      const phase2 = 2 * Math.PI * lat + 1.3;
      this.s2[i] = Math.sin(phase2);
      this.c2[i] = Math.cos(phase2);
      this.s5[i] = Math.sin(5 * lon - 3 * lat);
      this.c5[i] = Math.cos(5 * lon - 3 * lat);
      this.band[i] = Math.max(0, Math.min(BANDS - 1, Math.round(((lat + Math.PI / 2) / Math.PI) * (BANDS - 1))));
      this.birth[i] = spread() * SPHERE.birthSpread;
    }
    for (let b = 0; b < BANDS; b++) this.bandLat[b] = (b / (BANDS - 1)) * Math.PI - Math.PI / 2;
  }

  private place: Placement = { cx: 0, cy: 0, sx: 1, sy: 1 };
  private ms = 0;
  private swelling = false;
  private breath: number = SPHERE.breath;
  private C1 = 1;
  private S1 = 0;
  private C2 = 1;
  private S2 = 0;
  private C3 = 1;
  private S3 = 0;

  /**
   * Sets the time of the next `at` calls: the trigonometry shared by all the points (a handful of sines of the
   * time and one cosine and sine per latitude band). `swell` false disables the birth (the pairing reads the sphere whole).
   * The time is not bounded: the sphere turns for as long as it holds a point.
   */
  prepare(ms: number, place: Placement, swell = true): void {
    const t = Math.max(ms, 0) / 1000;
    this.place = place;
    this.ms = ms;
    const angle = sphereAngle(t);
    const differential = SPHERE.differential * differentialShare(t);
    for (let b = 0; b < BANDS; b++) {
      const yaw = angle * (1 + differential * Math.cos(2 * this.bandLat[b]!));
      this.bandCos[b] = Math.cos(yaw);
      this.bandSin[b] = Math.sin(yaw);
    }
    this.C1 = Math.cos(0.55 * t);
    this.S1 = Math.sin(0.55 * t);
    this.C2 = Math.cos(0.4 * t);
    this.S2 = Math.sin(0.4 * t);
    this.C3 = Math.cos(0.3 * t);
    this.S3 = Math.sin(0.3 * t);
    this.swelling = swell && ms < SPHERE.birthMs + SPHERE.birthSpread;
    // The surface breathes while the sphere is whole; its amplitude fades to 0 as the sphere empties (U.4).
    this.breath = SPHERE.breath * Math.max(0, 1 - Math.max(0, ms - SPHERE.breathFadeFromMs) / (SPHERE.breathFadeToMs - SPHERE.breathFadeFromMs));
  }

  /** Point `i` on the sphere at the time of `prepare`: written into `x[i]`, `y[i]`, `z[i]` (CSS px, z in sphere units). */
  at(i: number, x: Float32Array, y: Float32Array, z: Float32Array): void {
    const n = (this.s3[i]! * this.C1 + this.c3[i]! * this.S1 + this.s2[i]! * this.C2 - this.c2[i]! * this.S2 + this.s5[i]! * this.C3 + this.c5[i]! * this.S3) / 3;
    let radius = 0.5 * (1 + this.breath * n);
    if (this.swelling) radius *= SPHERE.birthFrom + (1 - SPHERE.birthFrom) * easeOutCubic((this.ms - this.birth[i]!) / SPHERE.birthMs);
    const b = this.band[i]!;
    const cy = this.bandCos[b]!;
    const sy = this.bandSin[b]!;
    const cosLonY = this.cosLon[i]! * cy - this.sinLon[i]! * sy;
    const sinLonY = this.sinLon[i]! * cy + this.cosLon[i]! * sy;
    const px = radius * this.cosLat[i]! * cosLonY;
    const pz = radius * this.cosLat[i]! * sinLonY;
    const py = -radius * this.sinLat[i]!;
    const y2 = py * COS_TILT - pz * SIN_TILT;
    const z2 = py * SIN_TILT + pz * COS_TILT;
    const s = FOCAL / (FOCAL - z2);
    x[i] = this.place.cx + px * this.place.sx * s;
    y[i] = this.place.cy + y2 * this.place.sy * s;
    z[i] = z2;
  }

  /** The sphere at a sequence time: points `from` to `to` (exclusive) are written into `x`, `y`, `z`. */
  frame(ms: number, place: Placement, x: Float32Array, y: Float32Array, z: Float32Array, from: number, to: number, swell = true): void {
    this.prepare(ms, place, swell);
    for (let i = from; i < to; i++) this.at(i, x, y, z);
  }
}
