export const PARTICLE_PRESETS = ["veil", "sphere", "current", "agents", "terrain", "grid"] as const;
export type ParticlePreset = (typeof PARTICLE_PRESETS)[number];
export type Particle = { u: number; v: number; w: number; group: number };
export type Point = { x: number; y: number; z: number; alpha: number };
const TAU = Math.PI * 2;
const PEAK_X = [-.55, .15, .57, -.18];
const PEAK_Z = [-.35, .2, -.25, .6];
export const smoothstep = (q: number) => { const x = Math.max(0, Math.min(1, q)); return x * x * (3 - 2 * x); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export function createParticles(count: number): Particle[] {
  let seed = 81291;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  return Array.from({ length: count }, (_, i) => ({ u: random(), v: random(), w: random(), group: i % 4 }));
}

export function presetForPath(path: string): ParticlePreset {
  if (path.startsWith("/agents-ia/a-valider")) return "terrain";
  if (path.startsWith("/agents-ia")) return "agents";
  if (path.startsWith("/contacts")) return "sphere";
  if (path.startsWith("/pipeline")) return "current";
  if (path.startsWith("/parametres")) return "grid";
  return "veil";
}

// Normalized coordinates; the renderer supplies generous margins and perspective.
// Mutating a caller-owned point avoids allocation inside requestAnimationFrame.
export function particlePosition(p: Particle, preset: ParticlePreset, t: number, out: Point): void {
  const a = p.u * TAU;
  const latitude = Math.acos(2 * p.v - 1);
  const r = .65 * (1 + Math.sin(t * .8) * .035);
  const theta = a + t * .25;
  const sx = r * Math.sin(latitude) * Math.cos(theta);
  const sy = r * Math.cos(latitude);
  const sz = Math.sin(latitude) * Math.sin(theta);
  let x = sx, y = sy, z = sz, alpha = .25 + (sz + 1) * .16;
  if (preset === "veil") {
    const u = (p.u - .5) * 5.8, v = (p.v - .5) * 2;
    const q = u * 1.2 + t * .5;
    x = u * .32 + Math.sin(v * 2 + q) * .09;
    y = v * .27 + Math.sin(q) * .23 + Math.cos(u * 2 - v + t * .24) * .12;
    z = Math.cos(q + v); alpha = .14 + (z + 1) * .15;
  } else if (preset === "current") {
    x = ((p.u * 2 + t * (.12 + p.w * .12)) % 2) - 1;
    y = (p.v - .5) * .7 + Math.sin(x * 3 - t * .7) * .2 + Math.sin(x * 5 + t * .3) * .08;
    z = p.w; alpha = (.16 + p.w * .35) * smoothstep((1 - Math.abs(x)) / .2);
  } else if (preset === "agents") {
    const cycle = t % 14;
    const split = smoothstep((cycle - 2) / 3) * (1 - smoothstep((cycle - 11) / 3));
    const centerX = p.group % 2 === 0 ? -.58 : .58;
    const centerY = p.group < 2 ? -.38 : .38;
    const b = p.v * TAU;
    let gx: number, gy: number;
    if (p.group === 0) {
      const lobes = 1 + .22 * Math.sin(3 * a + t) * Math.sin(latitude);
      gx = .27 * lobes * Math.sin(latitude) * Math.cos(theta);
      gy = .26 * lobes * Math.cos(latitude);
    } else if (p.group === 1) {
      const tube = .21 + .075 * Math.cos(b + t * .6);
      gx = tube * Math.cos(a + t * .45);
      gy = tube * Math.sin(a + t * .45) * .58 + .07 * Math.sin(b);
    } else if (p.group === 2) {
      const twist = a + p.v * 8 + t * .65;
      gx = (.1 + .05 * Math.sin(b + t)) * Math.cos(twist);
      gy = (p.v - .5) * .51 + .035 * Math.sin(twist);
    } else {
      const radius = Math.sqrt(p.v) * (.22 + .06 * Math.cos(5 * a + t * .3));
      gx = radius * Math.cos(a); gy = radius * Math.sin(a) + .045 * Math.sin(a * 3 + t);
    }
    x = mix(sx, centerX + gx, split); y = mix(sy, centerY + gy, split);
  } else if (preset === "terrain") {
    const cycle = t % 18;
    const morph = smoothstep((cycle - 3) / 4) * (1 - smoothstep((cycle - 14) / 4));
    const radius = .24 + Math.sqrt(p.v) * .66;
    const angle = a + t * (.16 + .1 / radius);
    const vx = radius * Math.cos(angle), vy = radius * Math.sin(angle) * .47;
    const u = (p.u - .5) * 2, v = (p.v - .5) * 2;
    let height = 0;
    for (let k = 0; k < 4; k++) {
      const cx = PEAK_X[k];
      const cz = PEAK_Z[k];
      if (cx === undefined || cz === undefined) continue;
      height += (.32 + .11 * Math.sin(t * .55 + k)) * Math.exp(-((u - cx) ** 2 + (v - cz) ** 2) / .12);
    }
    height += .025 * Math.sin(u * 12 + v * 6 - t * 1.2);
    x = mix(vx, u * .79 + v * .14, morph);
    y = mix(vy, v * .32 - height + .15, morph);
    z = mix(Math.sin(angle), -v, morph); alpha = .19 + (z + 1) * .17;
  } else if (preset === "grid") {
    const col = Math.floor(p.u * 64), row = Math.floor(p.v * 28);
    x = (col / 63 - .5) * 1.8 + Math.cos(row * .19 - t * .35) * .008;
    y = (row / 27 - .5) * 1.05 + Math.sin(col * .18 + row * .16 - t * .55) * .015;
    alpha = .24; z = 0;
  }
  out.x = x; out.y = y; out.z = z; out.alpha = alpha;
}
