/**
 * Adapted from React Bits — TechText (https://reactbits.dev)
 *
 * Pure model of the brand wordmark (`BRAND.shortName`) of the landing final panel
 * (docs/design-system.md §2.11.3): the one-time sweep timeline, the spring of
 * a dragged letter, the capped drag, the seeded specks and the outline reach.
 * No DOM, no clock: time is a parameter, so every value is testable.
 *
 * Re-interpreted, not imported (TechText relies on `motion`): ink + cobalt
 * only, no glow, swept once, never on a loop.
 */

/** Sweep: the frame lands on the first letter, glides letter to letter, fades. */
export const SWEEP_DELAY_MS = 2000;
export const SWEEP_IN_MS = 160;
export const SWEEP_GLIDE_MS = 160;
export const SWEEP_STOP_MS = 60;
export const SWEEP_OUT_MS = 200;
/** Share of the wordmark that must be on screen before the sweep is armed. */
export const SWEEP_VISIBLE_SHARE = 0.6;

/** Pointer: leave fade, specks stop after an idle pointer, tap display. */
export const LEAVE_MS = 200;
export const POINTER_IDLE_MS = 600;
export const TAP_MAX_MS = 300;
export const TAP_SHOW_MS = 1200;
/** Travel below which a press is a click (or a tap), not a drag, px. */
export const CLICK_SLOP_PX = 6;

/** Drag: capped at 0.6 em with a progressive brake. */
export const DRAG_LIMIT_EM = 0.6;
/** Spring of the released letter (mass 1). */
export const SPRING_K = 220;
export const SPRING_DAMPING = 22;
/** Below this distance and speed the letter is home, px and px/s. */
export const SPRING_REST_PX = 0.5;
export const SPRING_REST_SPEED = 8;

/** Outline reach around the pointer, in em of the wordmark, and its soft edge. */
export const REACH_EM = 0.75;
export const SOFTNESS = 0.35;

/** Specks: 15 on a large screen with a fine pointer, 8 otherwise. */
export const SPECKS_LARGE = 15;
export const SPECKS_COMPACT = 8;
export const SPECK_BLINK_MS = 360;
export const SPECK_BLINKS = 2;
export const SPECK_STAGGER_MS = 40;
/** Box of a letter widened by this, in em, where specks land. */
export const SPECK_SPREAD_EM = 0.25;
export const SPECK_SEED = 0x2457ff;

/** Selection frame drawn around the ink of the letter, px. */
export const FRAME_PAD_PX = 4;
export const HANDLE_PX = 5;

// ---------------------------------------------------------------------------
// Easing

/** CSS `cubic-bezier()` as a function of progress (Newton + bisection). */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const error = sampleX(t) - x;
      if (Math.abs(error) < 1e-6) return sampleY(t);
      const slope = slopeX(t);
      if (Math.abs(slope) < 1e-6) break;
      t -= error / slope;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 30; i++) {
      const value = sampleX(t);
      if (Math.abs(value - x) < 1e-6) break;
      if (value < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return sampleY(t);
  };
}

/** `--ease-emphasis`: fast, then settles for long (docs §2.5.1). */
export const easeEmphasis = cubicBezier(0.16, 1, 0.3, 1);

export function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

export function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

// ---------------------------------------------------------------------------
// Sweep (once)

export type SweepStop = { letter: number; at: number };

/** When the frame arrives on each letter, in order, ms after the sweep start. */
export function sweepStops(letters: number): SweepStop[] {
  const stops: SweepStop[] = [];
  for (let letter = 0; letter < letters; letter++) {
    stops.push({ letter, at: SWEEP_IN_MS + letter * (SWEEP_STOP_MS + SWEEP_GLIDE_MS) });
  }
  return stops;
}

/** Whole sweep, ms: in, one stop per letter, one glide between letters, out. */
export function sweepDuration(letters: number): number {
  if (letters <= 0) return 0;
  return SWEEP_IN_MS + letters * SWEEP_STOP_MS + (letters - 1) * SWEEP_GLIDE_MS + SWEEP_OUT_MS;
}

export type SweepFrame = {
  /** Position of the frame, as a fractional letter index. */
  position: number;
  /** Opacity of the frame and of the outline. */
  opacity: number;
  /** The letter the frame is on or heading to. */
  letter: number;
  done: boolean;
};

export function sweepAt(elapsed: number, letters: number): SweepFrame {
  const total = sweepDuration(letters);
  if (letters <= 0 || elapsed >= total) return { position: Math.max(letters - 1, 0), opacity: 0, letter: Math.max(letters - 1, 0), done: true };
  if (elapsed < SWEEP_IN_MS) return { position: 0, opacity: easeEmphasis(clamp01(elapsed / SWEEP_IN_MS)), letter: 0, done: false };
  const outStart = total - SWEEP_OUT_MS;
  if (elapsed >= outStart) {
    return { position: letters - 1, opacity: 1 - clamp01((elapsed - outStart) / SWEEP_OUT_MS), letter: letters - 1, done: false };
  }
  // A stop on letter i, then a glide to i + 1.
  const step = SWEEP_STOP_MS + SWEEP_GLIDE_MS;
  const local = elapsed - SWEEP_IN_MS;
  const index = Math.min(Math.floor(local / step), letters - 1);
  const within = local - index * step;
  if (within <= SWEEP_STOP_MS || index >= letters - 1) return { position: index, opacity: 1, letter: index, done: false };
  const progress = easeEmphasis(clamp01((within - SWEEP_STOP_MS) / SWEEP_GLIDE_MS));
  return { position: index + progress, opacity: 1, letter: index + 1, done: false };
}

// ---------------------------------------------------------------------------
// Drag and spring

/** Drag offset with a progressive brake: its length never reaches 0.6 em. */
export function capDrag(dx: number, dy: number, em: number): { x: number; y: number } {
  const length = Math.hypot(dx, dy);
  if (length === 0 || em <= 0) return { x: 0, y: 0 };
  const limit = DRAG_LIMIT_EM * em;
  const braked = limit * Math.tanh(length / limit);
  const scale = braked / length;
  return { x: dx * scale, y: dy * scale };
}

export type Spring = { x: number; y: number; vx: number; vy: number };

/** One step of the release spring (semi-implicit Euler, sub-stepped at ≤ 4 ms). */
export function stepSpring(spring: Spring, dtMs: number): Spring {
  let { x, y, vx, vy } = spring;
  let remaining = Math.max(dtMs, 0) / 1000;
  while (remaining > 0) {
    const dt = Math.min(remaining, 0.004);
    vx += (-SPRING_K * x - SPRING_DAMPING * vx) * dt;
    vy += (-SPRING_K * y - SPRING_DAMPING * vy) * dt;
    x += vx * dt;
    y += vy * dt;
    remaining -= dt;
  }
  return { x, y, vx, vy };
}

export function springAtRest(spring: Spring): boolean {
  return Math.hypot(spring.x, spring.y) < SPRING_REST_PX && Math.hypot(spring.vx, spring.vy) < SPRING_REST_SPEED;
}

/** Release from `x0` px (at rest): time to stay within 0.5 px and the overshoot. */
export function simulateSpring(x0: number, frameMs = 1000 / 60): { settleMs: number; overshoot: number } {
  let spring: Spring = { x: x0, y: 0, vx: 0, vy: 0 };
  let elapsed = 0;
  let settleMs = 0;
  let overshoot = 0;
  for (let i = 0; i < 600; i++) {
    spring = stepSpring(spring, frameMs);
    elapsed += frameMs;
    if (Math.sign(spring.x) !== Math.sign(x0) && spring.x !== 0) overshoot = Math.max(overshoot, Math.abs(spring.x));
    if (Math.abs(spring.x) >= SPRING_REST_PX) settleMs = elapsed;
  }
  return { settleMs, overshoot };
}

// ---------------------------------------------------------------------------
// Specks (seeded, never Math.random)

/** mulberry32: a small seeded generator, decorative use only. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Speck = {
  /** Position in the widened letter box, 0–1 on each axis. */
  u: number;
  v: number;
  /** Side, px CSS (2–4). */
  size: number;
  /** Half cobalt (opacity 0.9), half ink (opacity 0.5). */
  tone: "accent" | "ink";
  alpha: number;
};

export function speckCount(large: boolean): number {
  return large ? SPECKS_LARGE : SPECKS_COMPACT;
}

/** The specks of one letter: same seed and letter → same specks. */
export function createSpecks(count: number, letter: number, seed = SPECK_SEED): Speck[] {
  const random = seededRandom(seed + letter * 7919);
  const specks: Speck[] = [];
  for (let i = 0; i < count; i++) {
    const accent = i % 2 === 0;
    specks.push({
      u: random(),
      v: random(),
      size: 2 + Math.round(random() * 2),
      tone: accent ? "accent" : "ink",
      alpha: accent ? 0.9 : 0.5,
    });
  }
  return specks;
}

/** A speck blinks twice (0 → 1 → 0 in 360 ms), staggered by 40 ms; then 0. */
export function speckAlpha(elapsedMs: number, index: number): number {
  const local = elapsedMs - index * SPECK_STAGGER_MS;
  if (local <= 0 || local >= SPECK_BLINK_MS * SPECK_BLINKS) return 0;
  const phase = (local % SPECK_BLINK_MS) / SPECK_BLINK_MS;
  return Math.sin(Math.PI * phase);
}

export function specksDuration(count: number): number {
  return count <= 0 ? 0 : SPECK_BLINK_MS * SPECK_BLINKS + (count - 1) * SPECK_STAGGER_MS;
}

// ---------------------------------------------------------------------------
// Outline reach and letters

/** 1 = dashed outline, 0 = plain ink; soft over the outer 35 % of the reach. */
export function outlineAmount(distance: number, reach: number, softness = SOFTNESS): number {
  if (reach <= 0) return 0;
  return 1 - smoothstep(reach * (1 - softness), reach, distance);
}

export type LetterBox = { x: number; y: number; width: number; height: number };

/** Index of the letter whose box centre is the closest to the point. */
export function nearestLetter(px: number, py: number, boxes: readonly LetterBox[]): number {
  let best = -1;
  let bestDistance = Infinity;
  boxes.forEach((box, index) => {
    const distance = Math.hypot(px - (box.x + box.width / 2), py - (box.y + box.height / 2));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  return best;
}

/** Index of the letter under the point, or -1. */
export function letterAt(px: number, py: number, boxes: readonly LetterBox[]): number {
  return boxes.findIndex((box) => px >= box.x && px <= box.x + box.width && py >= box.y && py <= box.y + box.height);
}

/** « A  118 × 152 »: the letter, then the size of its ink in CSS px. */
export function letterLabel(letter: string, width: number, height: number): string {
  return `${letter}  ${Math.round(width)} × ${Math.round(height)}`;
}

/** Interpolates two boxes (the frame gliding from letter to letter). */
export function mixBox(a: LetterBox, b: LetterBox, t: number): LetterBox {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    width: a.width + (b.width - a.width) * t,
    height: a.height + (b.height - a.height) * t,
  };
}
