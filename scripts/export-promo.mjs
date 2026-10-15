#!/usr/bin/env node
/**
 * Exports the Ascend Strategy promo video (docs/motion/promo-2026-10.md §6.5).
 *
 *   node scripts/export-promo.mjs [--format 16x9|9x16|both] [--fps 30|60] [--keep-frames] [--verify]
 *
 * Opens /dev/promo in Chromium at the exact size of the format, calls window.__promo.seek(ms) for every
 * frame, saves PNG files, then assembles them with FFmpeg (H.264, yuv420p, no audio).
 * Uses the server given by PROMO_BASE_URL, or starts `next dev` on a free port of its own.
 * Outputs (out/ is ignored by Git): out/promo/ascend-promo-<format>.mp4 and ...-<format>-poster.png.
 */
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "out", "promo");
const DURATION_MS = 33_000;
const SIZES = { "16x9": { width: 1920, height: 1080, maxMbit: 12 }, "9x16": { width: 1080, height: 1920, maxMbit: 10 } };
const VERIFY_TIMES = [0, 8000, 15_400, 29_700, 33_000];

function parseArgs(argv) {
  const args = { format: "both", fps: 30, keepFrames: false, verify: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--format") args.format = argv[++i];
    else if (argv[i] === "--fps") args.fps = Number(argv[++i]);
    else if (argv[i] === "--keep-frames") args.keepFrames = true;
    else if (argv[i] === "--verify") args.verify = true;
  }
  if (!["16x9", "9x16", "both"].includes(args.format)) throw new Error(`Unknown format: ${args.format}`);
  if (![30, 60].includes(args.fps)) throw new Error("fps must be 30 or 60");
  return args;
}

async function isUp(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
    return response.status < 500;
  } catch {
    return false;
  }
}

/** Uses PROMO_BASE_URL, or starts a dev server of its own and returns a stop function. */
async function ensureServer() {
  if (process.env.PROMO_BASE_URL) return { base: process.env.PROMO_BASE_URL.replace(/\/$/, ""), stop: () => {} };
  const port = Number(process.env.PROMO_PORT ?? 3210);
  const base = `http://127.0.0.1:${port}`;
  if (await isUp(base)) return { base, stop: () => {} };
  const child = spawn("npx", ["next", "dev", "-p", String(port), "--hostname", "127.0.0.1"], { cwd: ROOT, shell: true, stdio: "ignore" });
  for (let k = 0; k < 120; k++) {
    if (await isUp(base)) break;
    await new Promise((done) => setTimeout(done, 1000));
  }
  if (!(await isUp(base))) throw new Error("The dev server did not start");
  return {
    base,
    stop: () => {
      if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
      else child.kill("SIGTERM");
    },
  };
}

async function openPage(browser, base, format) {
  const { width, height } = SIZES[format];
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: "no-preference" });
  page.on("pageerror", (error) => console.error("page error:", error.message));
  await page.goto(`${base}/dev/promo?format=${format}&t=0`, { waitUntil: "load", timeout: 180_000 });
  await page.waitForFunction(() => Boolean(window.__promo), null, { timeout: 180_000 });
  await page.evaluate(() => window.__promo.ready);
  return page;
}

async function frameBuffer(page, format, ms) {
  await page.evaluate((value) => window.__promo.seek(value), ms);
  const { width, height } = SIZES[format];
  return page.screenshot({ type: "png", clip: { x: 0, y: 0, width, height } });
}

const sha = (buffer) => createHash("sha256").update(buffer).digest("hex");

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${command} failed (${result.status})`);
}

function bitrateMbit(file) {
  const result = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=bit_rate", "-of", "default=nw=1:nk=1", file], { encoding: "utf8" });
  return Number(result.stdout.trim()) / 1e6;
}

function assemble(format, fps, framesDir, file) {
  const base = ["-y", "-framerate", String(fps), "-i", join(framesDir, "frame-%05d.png"), "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-profile:v", "high", "-preset", "slow", "-movflags", "+faststart"];
  run("ffmpeg", [...base, "-crf", "16", file]);
  const measured = bitrateMbit(file);
  if (measured > SIZES[format].maxMbit) {
    console.log(`${format}: ${measured.toFixed(1)} Mbit/s above the ceiling, re-encoding with -crf 18`);
    run("ffmpeg", [...base, "-crf", "18", file]);
  }
  console.log(`${format}: ${bitrateMbit(file).toFixed(2)} Mbit/s`);
}

async function exportFormat(browser, base, format, args) {
  const fps = args.fps;
  const frames = Math.round((DURATION_MS * fps) / 1000);
  const framesDir = join(OUT, `frames-${format}`);
  rmSync(framesDir, { recursive: true, force: true });
  mkdirSync(framesDir, { recursive: true });
  const page = await openPage(browser, base, format);
  const started = Date.now();
  for (let i = 0; i < frames; i++) {
    const ms = Math.round((i * 1000) / fps);
    const png = await frameBuffer(page, format, ms);
    writeFileSync(join(framesDir, `frame-${String(i).padStart(5, "0")}.png`), png);
    if (i % 100 === 0) console.log(`${format}: frame ${i}/${frames}`);
  }
  console.log(`${format}: ${frames} frames in ${((Date.now() - started) / 1000).toFixed(0)} s`);
  const poster = await frameBuffer(page, format, DURATION_MS);
  writeFileSync(join(OUT, `ascend-promo-${format}-poster.png`), poster);
  await page.close();
  assemble(format, fps, framesDir, join(OUT, `ascend-promo-${format}.mp4`));
  if (!args.keepFrames) rmSync(framesDir, { recursive: true, force: true });
}

/** Two independent loads of the page must give identical pixels at five instants (docs §6.5 step 7). */
async function verify(browser, base, format) {
  const hashes = [];
  for (let run = 0; run < 2; run++) {
    const page = await openPage(browser, base, format);
    const row = [];
    for (const ms of VERIFY_TIMES) row.push(sha(await frameBuffer(page, format, ms)));
    await page.close();
    hashes.push(row);
  }
  VERIFY_TIMES.forEach((ms, k) => console.log(`${format} t=${ms}: ${hashes[0][k] === hashes[1][k] ? "identical" : "DIFFERENT"} ${hashes[0][k].slice(0, 16)}`));
  if (hashes[0].some((value, k) => value !== hashes[1][k])) process.exitCode = 1;
}

const args = parseArgs(process.argv.slice(2));
const formats = args.format === "both" ? ["16x9", "9x16"] : [args.format];
mkdirSync(OUT, { recursive: true });
const server = await ensureServer();
const browser = await chromium.launch();
try {
  for (const format of formats) {
    if (args.verify) await verify(browser, server.base, format);
    else await exportFormat(browser, server.base, format, args);
  }
} finally {
  await browser.close();
  server.stop();
}
