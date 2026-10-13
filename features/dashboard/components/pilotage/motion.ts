/** Shared by the islands of the boss's statistics page (docs/design-system.md §3.5.2.H). */

export const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

/** Browser only: call it from effects and handlers, never while rendering on the server. */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia(REDUCED_QUERY).matches;
}

/** A zone enters at this share of its height on screen (docs §3.5.2.H). */
export const REVEAL_SHARE = 0.35;
export const REVEAL_MS = 550;
export const REVEAL_RISE_PX = 12;
/** Fade-out of the old graphics when the period changes. */
export const SWAP_OUT_MS = 140;
