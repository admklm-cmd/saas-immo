/**
 * Pure rules of the hover replay of a landing title (docs/design-system.md
 * §2.11.2 D). The DOM side lives in `AccentReplayController.tsx`.
 */

/** Minimum time between the end of a replay and the next one, on one title. */
export const REPLAY_COOLDOWN_MS = 800;

/** Safety net: the replay attribute is removed after this delay at the latest. */
export const REPLAY_SAFETY_MS = 1600;

/** Media queries that must BOTH match for the replay to exist at all. */
export const REPLAY_MEDIA = {
  pointer: "(hover: hover) and (pointer: fine)",
  motion: "(prefers-reduced-motion: no-preference)",
} as const;

export type ReplayRequest = {
  /** `PointerEvent.pointerType` of the event that entered the title. */
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

/** Only a mouse or a pen replays: a touch on a hybrid device does nothing. */
export function isReplayPointer(pointerType: string): boolean {
  return pointerType === "mouse" || pointerType === "pen";
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
