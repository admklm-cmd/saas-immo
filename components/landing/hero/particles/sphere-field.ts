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

/** The sphere phase ends here (ms of the sequence): its last image is the start of the transition to the hand. */
export const SPHERE_END_MS = 3800;
/** Latitude bands of the differential rotation: one cosine and one sine per band and per frame, not per point. */
const BANDS = 48;

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

  /**
   * The sphere at a sequence time: points `from` to `to` (exclusive) are written into `x`, `y`, `z` (CSS px, z in
   * sphere units). `swell` false disables the birth (the pairing reads the sphere at its end, whole).
   */
  frame(ms: number, place: Placement, x: Float32Array, y: Float32Array, z: Float32Array, from: number, to: number, swell = true): void {
    const t = Math.min(Math.max(ms, 0), SPHERE_END_MS) / 1000;
    for (let b = 0; b < BANDS; b++) {
      const yaw = SPHERE.spin * t * (1 + SPHERE.differential * Math.cos(2 * this.bandLat[b]!));
      this.bandCos[b] = Math.cos(yaw);
      this.bandSin[b] = Math.sin(yaw);
    }
    const C1 = Math.cos(0.55 * t);
    const S1 = Math.sin(0.55 * t);
    const C2 = Math.cos(0.4 * t);
    const S2 = Math.sin(0.4 * t);
    const C3 = Math.cos(0.3 * t);
    const S3 = Math.sin(0.3 * t);
    const cosT = Math.cos(SPHERE.tilt);
    const sinT = Math.sin(SPHERE.tilt);
    const swelling = swell && ms < SPHERE.birthMs + SPHERE.birthSpread;
    for (let i = from; i < to; i++) {
      const n = (this.s3[i]! * C1 + this.c3[i]! * S1 + this.s2[i]! * C2 - this.c2[i]! * S2 + this.s5[i]! * C3 + this.c5[i]! * S3) / 3;
      let radius = 0.5 * (1 + SPHERE.breath * n);
      if (swelling) radius *= SPHERE.birthFrom + (1 - SPHERE.birthFrom) * easeOutCubic((ms - this.birth[i]!) / SPHERE.birthMs);
      const b = this.band[i]!;
      const cy = this.bandCos[b]!;
      const sy = this.bandSin[b]!;
      const cosLonY = this.cosLon[i]! * cy - this.sinLon[i]! * sy;
      const sinLonY = this.sinLon[i]! * cy + this.cosLon[i]! * sy;
      const px = radius * this.cosLat[i]! * cosLonY;
      const pz = radius * this.cosLat[i]! * sinLonY;
      const py = -radius * this.sinLat[i]!;
      const y2 = py * cosT - pz * sinT;
      const z2 = py * sinT + pz * cosT;
      const s = FOCAL / (FOCAL - z2);
      x[i] = place.cx + px * place.sx * s;
      y[i] = place.cy + y2 * place.sy * s;
      z[i] = z2;
    }
  }
}
