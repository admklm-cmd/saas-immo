/**
 * Pure rules of the replay of a landing title effect (docs/design-system.md
 * §2.11.2 D, §2.11.8.8 L4-C). The DOM side lives in
 * `AccentReplayController.tsx` (hero, problem) and `TechAccent.tsx` (control).
 *
 * Two paths, both only while motion is welcome:
 * - hover (mouse, pen, on a fine hovering pointer): the pointer enters a word
 *   of the title (`[data-title-word]`) coming from outside the title;
 * - touch: a brief tap on a word (`isTap`), with passive listeners — the page
 *   always scrolls, a scroll that starts on a word cancels the tap.
 */

/** Minimum time between the end of a replay and the next one, on one title. */
export const REPLAY_COOLDOWN_MS = 800;

/** Safety net: the replay attribute is removed after this delay at the latest. */
export const REPLAY_SAFETY_MS = 1600;

/** A tap moves by at most this distance between down and up. */
export const TAP_SLOP_PX = 10;

/** A tap lasts at most this long between down and up. */
export const TAP_MAX_MS = 600;

/** Selector of a visual word of a title (accented word included). */
export const TITLE_WORD = "[data-title-word]";

/**
 * `motion` must match for the replay to exist at all; `pointer` gates the
 * hover path only (the touch path works on any device).
 */
export const REPLAY_MEDIA = {
  pointer: "(hover: hover) and (pointer: fine)",
  motion: "(prefers-reduced-motion: no-preference)",
} as const;

export type ReplayRequest = {
  /** `PointerEvent.pointerType` of the event that entered or tapped the title. */
  pointerType: string;
  /** A replay is playing on this title. */
  running: boolean;
  /** The entry effect still has a running animation in the title. */
  entryRunning: boolean;
  /** An enclosing `Reveal` is still `hidden` (the entry has not started). */
  revealHidden: boolean;
  /** `performance.now()` at the event. */
  now: number;
  /** End of the previous replay of this title, `null` if none. */
  lastEnd: number | null;
};

/** A mouse or a pen (hover path) or a finger (tap path) replays. */
export function isReplayPointer(pointerType: string): boolean {
  return pointerType === "mouse" || pointerType === "pen" || pointerType === "touch";
}

/** True for the hover path (a touch never hovers). */
export function isHoverPointer(pointerType: string): boolean {
  return pointerType === "mouse" || pointerType === "pen";
}

export type TapSample = {
  /** Horizontal and vertical distance between `pointerdown` and `pointerup`, in CSS px. */
  dx: number;
  dy: number;
  /** Time between `pointerdown` and `pointerup`, in ms. */
  duration: number;
  /** A `pointercancel` arrived (the browser took the gesture for a scroll). */
  cancelled: boolean;
};

/** A brief tap: ≤ 10 px of travel, ≤ 600 ms, never cancelled (§2.11.8.8 L4-C). */
export function isTap(sample: TapSample): boolean {
  if (sample.cancelled) return false;
  if (!(sample.duration >= 0 && sample.duration <= TAP_MAX_MS)) return false;
  return Math.hypot(sample.dx, sample.dy) <= TAP_SLOP_PX;
}

/**
 * True when every condition of §2.11.2 D holds. When one is missing nothing
 * happens, and nothing is queued.
 */
export function canReplay(request: ReplayRequest): boolean {
  if (!isReplayPointer(request.pointerType)) return false;
  if (request.running || request.entryRunning || request.revealHidden) return false;
  return request.lastEnd === null || request.now - request.lastEnd >= REPLAY_COOLDOWN_MS;
}
