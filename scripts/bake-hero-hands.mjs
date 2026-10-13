// Bakes the two hands of the hero landing (docs/design-system.md 2.11.4 ter, G and N).
//
//   node scripts/bake-hero-hands.mjs                 uses scripts/hero-hands.config.json
//   node scripts/bake-hero-hands.mjs --source path   same config, another source image
//   node scripts/bake-hero-hands.mjs --debug dir     also writes a debug preview in `dir`
//
// Reads a picture of the hands (dark on light), samples points by tonal density (+ a share on the
// edges), and writes versioned data:
//   components/landing/hero/particles/hands.baked.json   points + rails + contact point
//   public/images/hero/hands-poster.webp                 final frame, for the no-JavaScript case
// The browser never reads an image: the engine only knows the baked json.
// Dependency: `sharp`, shipped with Next (not added to package.json).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const arg = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const config = JSON.parse(await readFile(path.join(root, "scripts/hero-hands.config.json"), "utf8"));
const source = path.resolve(root, arg("--source") ?? config.source);

function prng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = s;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
const random = prng(20261012);
const smooth = (a, b, v) => {
  const q = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return q * q * (3 - 2 * q);
};

const meta = await sharp(source).metadata();
const W = meta.width;
const H = meta.height;
const { data } = await sharp(source).greyscale().blur(config.blur).raw().toBuffer({ resolveWithObject: true });

// 1. Keep mask (polygon) minus the erased discs, then the tonal map.
function inPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const tone = new Float32Array(W * H);
let toneMax = 0;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    let keep = inPolygon(x, y, config.keep);
    for (const disc of config.erase) if (Math.hypot(x - disc.center[0], y - disc.center[1]) < disc.radius) keep = false;
    const raw = keep ? Math.max(0, (config.background - data[y * W + x] / 255) / config.background) : 0;
    const dark = Math.max(0, raw - config.floor) / (1 - config.floor);
    tone[y * W + x] = dark;
    if (dark > toneMax) toneMax = dark;
  }
}
const edge = new Float32Array(W * H);
let edgeMax = 0;
for (let y = 1; y < H - 1; y++) {
  for (let x = 1; x < W - 1; x++) {
    const gx = tone[y * W + x + 1] - tone[y * W + x - 1];
    const gy = tone[(y + 1) * W + x] - tone[(y - 1) * W + x];
    const g = Math.hypot(gx, gy) * (tone[y * W + x] > 0.04 ? 1 : 0);
    edge[y * W + x] = g;
    if (g > edgeMax) edgeMax = g;
  }
}

// 2. Sampling: density = tone^1.3 (rejection), plus a share on the edges.
const bounds = config.keep.reduce(
  (b, [x, y]) => ({ x0: Math.min(b.x0, x), x1: Math.max(b.x1, x), y0: Math.min(b.y0, y), y1: Math.max(b.y1, y) }),
  { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9 },
);
const picked = [];
const edgeCount = Math.round(config.points * config.edgeShare);
function sample(count, weight, max) {
  let guard = 0;
  while (count > 0 && guard++ < 80_000_000) {
    const x = bounds.x0 + random() * (bounds.x1 - bounds.x0);
    const y = bounds.y0 + random() * (bounds.y1 - bounds.y0);
    const index = Math.min(H - 1, Math.floor(y)) * W + Math.min(W - 1, Math.floor(x));
    if (random() < weight(index) / max) {
      picked.push({ x, y, t: Math.min(1, tone[index] / toneMax) });
      count--;
    }
  }
}
sample(config.points - edgeCount, (i) => Math.pow(tone[i], config.power), Math.pow(toneMax, config.power));
sample(edgeCount, (i) => edge[i], edgeMax);
for (let i = picked.length - 1; i > 0; i--) {
  const j = Math.floor(random() * (i + 1));
  [picked[i], picked[j]] = [picked[j], picked[i]];
}

// 3. Normalised frame: origin = middle of the two index tips, unit = source width, y down.
const cx = (config.tips.left[0] + config.tips.right[0]) / 2;
const cy = (config.tips.left[1] + config.tips.right[1]) / 2;
const { shift, from, to } = config.approach;
const approach = (nx) => nx - Math.sign(nx) * shift * (1 - smooth(from, to, Math.abs(nx)));
const frame = ([x, y]) => [approach((x - cx) / W), (y - cy) / W];
const RANGE = 1.2;
const quant = (v) => Math.round(Math.min(1, Math.max(0, v / RANGE + 0.5)) * 65535);

// 4. Rails: Catmull-Rom, resampled to 48 vertices.
function resample(polyline, count = 48) {
  const pts = polyline.map(frame);
  const out = [];
  const segs = pts.length - 1;
  for (let k = 0; k < count; k++) {
    const u = (k / (count - 1)) * segs;
    const i = Math.min(segs - 1, Math.floor(u));
    const f = u - i;
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c = (a, b, cc, d) => 0.5 * (2 * b + (-a + cc) * f + (2 * a - 5 * b + 4 * cc - d) * f * f + (-a + 3 * b - 3 * cc + d) * f * f * f);
    out.push([Number(c(p0[0], p1[0], p2[0], p3[0]).toFixed(4)), Number(c(p0[1], p1[1], p2[1], p3[1]).toFixed(4))]);
  }
  return out;
}

const buffer = Buffer.alloc(picked.length * 5);
picked.forEach((p, i) => {
  const [x, y] = frame([p.x, p.y]);
  buffer.writeUInt16LE(quant(x), i * 5);
  buffer.writeUInt16LE(quant(y), i * 5 + 2);
  buffer.writeUInt8(Math.round(p.t * 255), i * 5 + 4);
});
const tipLeft = frame(config.tips.left);
const tipRight = frame(config.tips.right);
const baked = {
  version: 1,
  source: path.relative(root, source).split(path.sep).join("/"),
  count: picked.length,
  range: RANGE,
  aspect: Number((H / W).toFixed(4)),
  tips: { left: tipLeft.map((v) => Number(v.toFixed(4))), right: tipRight.map((v) => Number(v.toFixed(4))) },
  gap: Number((tipRight[0] - tipLeft[0]).toFixed(4)),
  rails: config.rails.map((rail) => resample(rail)),
  points: buffer.toString("base64"),
};
const outDir = path.join(root, "components/landing/hero/particles");
await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, "hands.baked.json"), JSON.stringify(baked));

// 5. Poster (no JavaScript) and optional debug preview.
const PW = 1600;
const PH = Math.round(PW * 0.5);
const dots = picked
  .map((p) => {
    const [x, y] = frame([p.x, p.y]);
    const r = 1.2 + p.t * 0.5;
    return `<rect x="${(PW / 2 + x * PW * 0.96).toFixed(1)}" y="${(PH / 2 + y * PW * 0.96).toFixed(1)}" width="${r.toFixed(2)}" height="${r.toFixed(2)}" fill="#18181b" fill-opacity="${(0.35 + p.t * 0.5).toFixed(2)}"/>`;
  })
  .join("");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PW}" height="${PH}"><rect width="100%" height="100%" fill="#ffffff"/>${dots}</svg>`;
await mkdir(path.join(root, "public/images/hero"), { recursive: true });
await sharp(Buffer.from(svg)).webp({ quality: 70 }).toFile(path.join(root, "public/images/hero/hands-poster.webp"));
const debugDir = arg("--debug");
if (debugDir) {
  const lines = baked.rails
    .map((r) => `<polyline fill="none" stroke="#2457ff" stroke-width="2" points="${r.map(([x, y]) => `${(PW / 2 + x * PW * 0.96).toFixed(1)},${(PH / 2 + y * PW * 0.96).toFixed(1)}`).join(" ")}"/>`)
    .join("");
  await mkdir(debugDir, { recursive: true });
  await sharp(Buffer.from(svg.replace("</svg>", `${lines}<circle cx="${PW / 2}" cy="${PH / 2}" r="4" fill="#2457ff"/></svg>`)))
    .png()
    .toFile(path.join(debugDir, "hands-debug.png"));
}
console.log(`baked ${picked.length} points, gap ${baked.gap}, ${(buffer.length / 1024).toFixed(0)} kB raw`);
