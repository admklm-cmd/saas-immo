/**
 * Physics of the horizontal track of the agents section, kept pure so it can
 * be unit-tested without a browser (`track-physics.test.ts`).
 *
 * Model (kinetic scrolling): at release, the track keeps the velocity of the
 * pointer and decays exponentially with a time constant `tau`. The distance it
 * would travel is `velocity × tau`; that projected position is snapped to the
 * nearest stop, and the track then approaches the stop with the same
 * exponential curve, so the motion starts at the release velocity and settles
 * without a bump. Units: px and ms, positions in scroll coordinates
 * (`scrollLeft`: dragging the pointer to the left increases it).
 */

/** Below this movement a press is a click, never a drag (px). */
export const DRAG_THRESHOLD_PX = 6;
/** Samples older than this before the release do not count in the velocity (ms). */
export const VELOCITY_WINDOW_MS = 90;
/** Time constant of the momentum decay (ms). */
export const MOMENTUM_TAU_MS = 325;
/** Time constant of a programmatic move (arrows, keyboard, selection) (ms). */
export const GLIDE_TAU_MS = 140;
/** From this release speed a gesture is a flick: it always moves one stop at least (px/ms). */
export const FLICK_VELOCITY = 0.35;
/** Distance under which the track is considered at rest on its target (px). */
export const SETTLE_EPSILON_PX = 0.5;

export type PointerSample = { t: number; x: number };

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * A press becomes a drag once it moved `threshold` px horizontally, and more
 * horizontally than vertically (a vertical move is a page scroll, not a drag).
 */
export function isDragGesture(dx: number, dy: number, threshold = DRAG_THRESHOLD_PX): boolean {
  return Math.abs(dx) >= threshold && Math.abs(dx) > Math.abs(dy);
}

/**
 * Velocity at release (px/ms) from the recent samples of the position. A
 * pointer that stayed still before the release (`now` far after the last
 * sample) has no velocity: the track then only snaps.
 */
export function releaseVelocity(
  samples: readonly PointerSample[],
  now: number,
  windowMs = VELOCITY_WINDOW_MS,
): number {
  const last = samples[samples.length - 1];
  if (!last || now - last.t > windowMs) return 0;
  const recent = samples.filter((sample) => sample.t >= last.t - windowMs);
  const first = recent[0];
  if (!first || last.t <= first.t) return 0;
  return (last.x - first.x) / (last.t - first.t);
}

/** Where the momentum alone would carry the track. */
export function projectMomentum(position: number, velocity: number, tau = MOMENTUM_TAU_MS): number {
  return position + velocity * tau;
}

/**
 * Stops of the track: the start of each item (already offset by the scroll
 * padding), clamped to the scrollable range, sorted and without duplicates.
 * The end of the range is always a stop, so the last items are reachable.
 */
export function snapStops(starts: readonly number[], max: number): number[] {
  const stops = new Set<number>([0, Math.max(0, max)]);
  for (const start of starts) stops.add(clamp(Math.round(start), 0, Math.max(0, max)));
  return [...stops].sort((a, b) => a - b);
}

/** Index of the stop closest to `value` (`-1` when there is none). */
export function nearestStopIndex(stops: readonly number[], value: number): number {
  let best = -1;
  let distance = Number.POSITIVE_INFINITY;
  stops.forEach((stop, index) => {
    const gap = Math.abs(stop - value);
    if (gap < distance) {
      best = index;
      distance = gap;
    }
  });
  return best;
}

/**
 * Stop where a released track comes to rest: the one closest to the projected
 * position; a flick always moves at least one stop in its direction.
 */
export function snapTarget(stops: readonly number[], position: number, velocity: number, tau = MOMENTUM_TAU_MS): number {
  if (stops.length === 0) return position;
  const max = stops[stops.length - 1] ?? 0;
  const projected = clamp(projectMomentum(position, velocity, tau), 0, max);
  let index = nearestStopIndex(stops, projected);
  const from = nearestStopIndex(stops, position);
  if (Math.abs(velocity) >= FLICK_VELOCITY && index === from) {
    index = clamp(from + Math.sign(velocity), 0, stops.length - 1);
  }
  return stops[index] ?? position;
}

/**
 * One frame of the exponential approach towards `target`: after `dtMs`, the
 * remaining distance is multiplied by `exp(-dtMs / tau)`. Frame-rate
 * independent; the track reaches the target exactly once it is settled.
 */
export function approach(current: number, target: number, dtMs: number, tau: number): number {
  const next = target + (current - target) * Math.exp(-Math.max(0, dtMs) / tau);
  return isSettled(next, target) ? target : next;
}

export function isSettled(current: number, target: number, epsilon = SETTLE_EPSILON_PX): boolean {
  return Math.abs(current - target) <= epsilon;
}

/**
 * Scroll position that shows an item entirely, moving as little as possible
 * (`nearest`): unchanged when the item is already fully in view, `inset` px
 * kept clear on each side (the faded edges of the track).
 */
export function revealOffset(
  item: { start: number; end: number },
  view: { position: number; size: number },
  max: number,
  inset = 0,
): number {
  const left = view.position + inset;
  const right = view.position + view.size - inset;
  let next = view.position;
  if (item.end - item.start > right - left || item.start < left) next = item.start - inset;
  else if (item.end > right) next = item.end - view.size + inset;
  return clamp(next, 0, Math.max(0, max));
}
