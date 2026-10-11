/**
 * Geometry and choreography of one exchange between two nanorobots
 * (docs/design-system.md §2.11.4 bis D). Pure: no DOM, no timer. The client
 * (`HeroNanoField`) turns the steps into one Anime.js timeline per exchange.
 *
 * Two actors A and B come towards their meeting point M, touch (edges in
 * contact), shake hands, step back while a 1 px wire stretches between them,
 * pass a cobalt bit along the wire, hold, then the wire fades and they go back
 * near their rest. Only `translateX`, `translateY`, `scale`, `scaleX` and
 * `opacity` move: no rebound, no rotation, no overshoot.
 *
 * Offsets are in CSS px from M, in the frame of the layer.
 */

import type { PairSeed, Point } from "./nano-population";

export const EXCHANGE_MS = 8_420;
/** The still composition parts in this time when motion starts (wire off, back to rest). */
export const RELEASE_MS = 2_040;
export const ANIMATED_PROPERTIES = ["translateX", "translateY", "scale", "scaleX", "opacity"] as const;
export type AnimatedProperty = (typeof ANIMATED_PROPERTIES)[number];

/** `large` ≥ 1024 px, `medium` 768–1023 px, `compact` < 768 px or a coarse pointer. */
export type NanoScreen = "large" | "medium" | "compact";

export const REST_DISTANCE: Readonly<Record<NanoScreen, readonly [number, number]>> = {
  large: [140, 200],
  medium: [120, 180],
  compact: [72, 110],
};
/** The rest distance may shrink to this before a pair is switched off. */
export const MIN_DISTANCE: Readonly<Record<NanoScreen, number>> = { large: 80, medium: 80, compact: 48 };
/** No point of a trajectory nearer than this to a text (`[data-network-quiet]`). */
export const QUIET_MARGIN_PX = 24;
export const CONTACT_GAP_PX = 8;
/** Gap between the edges while the wire is stretched. */
export const LINK_GAP_PX = 28;
export const RETURN_JITTER_PX = 10;
export const REST_OPACITY = 0.55;
export const ENGAGED_OPACITY = 0.95;

export function actorSize(screen: NanoScreen): number {
  return screen === "compact" ? 5 : 6;
}

export type Rect = { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number };

export type PairGeometry = {
  readonly id: number;
  /** M, px in the layer. */
  readonly anchor: Point;
  /** Angle used, degrees. */
  readonly angle: number;
  /** Unit vector from A to B. */
  readonly ux: number;
  readonly uy: number;
  /** Rest distance between the two centres, px. */
  readonly distance: number;
  /** Side of an actor, px. */
  readonly size: number;
  /** Takes part in the exchanges. */
  readonly active: boolean;
  /** Drawn (an inactive pair stays drawn at rest when its rest is clear of any text). */
  readonly shown: boolean;
};

export function distanceToRect(point: Point, rect: Rect): number {
  const dx = Math.max(rect.left - point.x, 0, point.x - rect.right);
  const dy = Math.max(rect.top - point.y, 0, point.y - rect.bottom);
  return Math.hypot(dx, dy);
}

/** Smallest distance between the edge of an actor travelling from `a` to `b` and the rectangles. */
export function trajectoryClearance(a: Point, b: Point, size: number, rects: readonly Rect[]): number {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const samples = Math.max(1, Math.ceil(length / 2));
  let clearance = Infinity;
  for (let index = 0; index <= samples; index += 1) {
    const t = index / samples;
    const point = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    // Half the diagonal of the square: the corner is the nearest part of the actor.
    for (const rect of rects) clearance = Math.min(clearance, distanceToRect(point, rect) - (size * Math.SQRT2) / 2);
  }
  return clearance;
}

function along(anchor: Point, ux: number, uy: number, signedDistance: number): Point {
  return { x: anchor.x + ux * signedDistance, y: anchor.y + uy * signedDistance };
}

/**
 * Places a pair: its rest distance from its seed, then the avoidance rule of
 * §2.11.4 bis D — the distance shrinks (4 px steps) down to the minimum while
 * the trajectory passes within 24 px of a text; then, on a phone only, the
 * angle flattens (half, then horizontal) before the pair is switched off.
 */
export function resolvePair(seed: PairSeed, anchor: Point, screen: NanoScreen, quiet: readonly Rect[]): PairGeometry {
  const [low, high] = REST_DISTANCE[screen];
  const size = actorSize(screen);
  const preferred = Math.round(low + (high - low) * seed.spread);
  const angles = screen === "compact" ? [seed.theta, seed.theta / 2, 0] : [seed.theta];
  for (const angle of angles) {
    const ux = Math.cos((angle * Math.PI) / 180);
    const uy = Math.sin((angle * Math.PI) / 180);
    for (let distance = preferred; distance >= MIN_DISTANCE[screen]; distance -= 4) {
      const a = along(anchor, ux, uy, -distance / 2);
      const b = along(anchor, ux, uy, distance / 2);
      if (trajectoryClearance(a, b, size, quiet) >= QUIET_MARGIN_PX) {
        return { id: seed.id, anchor, angle, ux, uy, distance, size, active: true, shown: true };
      }
    }
  }
  const ux = Math.cos((seed.theta * Math.PI) / 180);
  const uy = Math.sin((seed.theta * Math.PI) / 180);
  const restA = along(anchor, ux, uy, -preferred / 2);
  const restB = along(anchor, ux, uy, preferred / 2);
  const clear = (point: Point) => quiet.every((rect) => distanceToRect(point, rect) > size);
  return { id: seed.id, anchor, angle: seed.theta, ux, uy, distance: preferred, size, active: false, shown: clear(restA) && clear(restB) };
}

export type Role = "a" | "b";

/** Offset from M of an actor whose centre is `gap` px from M along the pair. */
export function offsetAt(geometry: PairGeometry, role: Role, gap: number): Point {
  const sign = role === "a" ? -1 : 1;
  return { x: geometry.ux * gap * sign, y: geometry.uy * gap * sign };
}

export const restOffset = (geometry: PairGeometry, role: Role) => offsetAt(geometry, role, geometry.distance / 2);
export const linkOffset = (geometry: PairGeometry, role: Role) => offsetAt(geometry, role, geometry.size / 2 + LINK_GAP_PX / 2);
/** Length of the wire: from the centre of A to the centre of B, in the linked pose. */
export const linkLength = (geometry: PairGeometry) => geometry.size + LINK_GAP_PX;

export type NanoTarget = "a" | "b" | "link" | "bit" | "portA" | "portB";
export type NanoEase = "inOutSine" | "outQuad" | "outSine" | "linear";
export type NanoStep = {
  readonly target: NanoTarget;
  /** ms from the start of the exchange. */
  readonly at: number;
  /** 0: set at once. */
  readonly duration: number;
  readonly ease: NanoEase;
  readonly props: Partial<Record<AnimatedProperty, readonly [number, number]>>;
};
export type NanoPhase = "approach" | "contact" | "link" | "transfer" | "hold" | "release" | "idle";
export type Choreography = {
  readonly steps: readonly NanoStep[];
  readonly phases: readonly { readonly at: number; readonly phase: NanoPhase }[];
  readonly duration: number;
};

const move = (target: Role, at: number, duration: number, ease: NanoEase, from: Point, to: Point, opacity?: readonly [number, number]): NanoStep => ({
  target,
  at,
  duration,
  ease,
  props: { translateX: [from.x, to.x], translateY: [from.y, to.y], ...(opacity ? { opacity } : {}) },
});

/**
 * The timeline of one exchange (8 420 ms). `start` is where each actor is
 * now (its rest, give or take the jitter of its previous return); `back` is
 * where it goes at the end (its rest ± 10 px, never twice the same).
 */
export function exchangeChoreography(geometry: PairGeometry, start: Record<Role, Point>, back: Record<Role, Point>): Choreography {
  const s = geometry.size;
  const near = (role: Role) => offsetAt(geometry, role, s / 2 + CONTACT_GAP_PX);
  const touch = (role: Role) => offsetAt(geometry, role, s / 2);
  const length = linkLength(geometry);
  const steps: NanoStep[] = [];
  for (const role of ["a", "b"] as const) {
    steps.push(move(role, 0, 2_800, "inOutSine", start[role], near(role), [REST_OPACITY, ENGAGED_OPACITY]));
    steps.push(move(role, 2_800, 360, "outQuad", near(role), touch(role)));
    steps.push({ target: role, at: 3_160, duration: 240, ease: "inOutSine", props: { scale: [1, 1.12] } });
    steps.push({ target: role, at: 3_400, duration: 240, ease: "inOutSine", props: { scale: [1.12, 1] } });
    steps.push(move(role, 3_640, 420, "outSine", touch(role), linkOffset(geometry, role)));
    steps.push(move(role, 5_620, 2_800, "inOutSine", linkOffset(geometry, role), back[role], [ENGAGED_OPACITY, REST_OPACITY]));
  }
  steps.push(
    { target: "portA", at: 3_400, duration: 160, ease: "inOutSine", props: { opacity: [0, 1] } },
    { target: "link", at: 3_640, duration: 420, ease: "outSine", props: { scaleX: [0, 1], opacity: [1, 1] } },
    { target: "portA", at: 4_060, duration: 120, ease: "linear", props: { opacity: [1, 0] } },
    { target: "bit", at: 4_060, duration: 0, ease: "linear", props: { opacity: [1, 1] } },
    { target: "bit", at: 4_060, duration: 720, ease: "inOutSine", props: { translateX: [0, length] } },
    { target: "bit", at: 4_780, duration: 80, ease: "linear", props: { opacity: [1, 0] } },
    { target: "portB", at: 4_780, duration: 160, ease: "inOutSine", props: { opacity: [0, 1] } },
    { target: "link", at: 5_380, duration: 240, ease: "linear", props: { opacity: [1, 0] } },
    { target: "portB", at: 6_820, duration: 600, ease: "inOutSine", props: { opacity: [1, 0] } },
    // Back to the idle state of the wire and the bit (both invisible by then).
    { target: "link", at: EXCHANGE_MS, duration: 0, ease: "linear", props: { scaleX: [0, 0] } },
    { target: "bit", at: EXCHANGE_MS, duration: 0, ease: "linear", props: { translateX: [0, 0] } },
  );
  return {
    steps,
    phases: [
      { at: 0, phase: "approach" },
      { at: 2_800, phase: "contact" },
      { at: 3_640, phase: "link" },
      { at: 4_060, phase: "transfer" },
      { at: 4_780, phase: "hold" },
      { at: 5_380, phase: "release" },
      { at: EXCHANGE_MS, phase: "idle" },
    ],
    duration: EXCHANGE_MS,
  };
}

/** From the still composition (linked, bit in the port of B) back to rest, once, when motion starts. */
export function releaseChoreography(geometry: PairGeometry): Choreography {
  const steps: NanoStep[] = [{ target: "link", at: 0, duration: 240, ease: "linear", props: { opacity: [1, 0] } }];
  for (const role of ["a", "b"] as const) {
    steps.push(move(role, 240, 1_800, "inOutSine", linkOffset(geometry, role), restOffset(geometry, role), [ENGAGED_OPACITY, REST_OPACITY]));
  }
  steps.push(
    { target: "portB", at: 240, duration: 600, ease: "inOutSine", props: { opacity: [1, 0] } },
    { target: "link", at: RELEASE_MS, duration: 0, ease: "linear", props: { scaleX: [0, 0] } },
  );
  return {
    steps,
    phases: [
      { at: 0, phase: "release" },
      { at: RELEASE_MS, phase: "idle" },
    ],
    duration: RELEASE_MS,
  };
}

/**
 * The return point: the rest ± 10 px, kept only if the way back to it (and
 * the next approach from it, the same segment) stays 24 px clear of the texts.
 */
export function returnPoint(geometry: PairGeometry, role: Role, random: () => number, quiet: readonly Rect[]): Point {
  const rest = restOffset(geometry, role);
  const jitter = { x: rest.x + (random() * 2 - 1) * RETURN_JITTER_PX, y: rest.y + (random() * 2 - 1) * RETURN_JITTER_PX };
  const absolute = { x: geometry.anchor.x + jitter.x, y: geometry.anchor.y + jitter.y };
  const clear = trajectoryClearance(absolute, geometry.anchor, geometry.size, quiet) >= QUIET_MARGIN_PX;
  return clear ? jitter : rest;
}
