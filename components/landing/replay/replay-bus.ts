/**
 * « Rejouer les animations » bus (docs/design-system.md §2.11.8.8 L4-D).
 *
 * One DOM event on `document`; every animated island of `/` subscribes and
 * goes back to its ARMED state (nothing else: scroll, focus and values typed
 * by the visitor never change). `[data-landing]` carries
 * `data-replay-generation` (0, then + 1 per replay) for the tests. Outside
 * `/` nobody emits the event, so the generic subscribers (`Reveal`) never fire.
 * The living background never subscribes (L4 n° 6).
 */

export const REPLAY_EVENT = "ascend:replay-animations";

export type ReplayDetail = { generation: number };

const ROOT = "[data-landing]";

/** Current generation (0 when the page has never been replayed or has no landing root). */
export function replayGeneration(doc: Document = document): number {
  const value = Number(doc.querySelector(ROOT)?.getAttribute("data-replay-generation") ?? 0);
  return Number.isFinite(value) ? value : 0;
}

/** Bumps the generation of the landing root and emits the event. Returns the new generation. */
export function requestReplay(doc: Document = document): number {
  const generation = replayGeneration(doc) + 1;
  doc.querySelector(ROOT)?.setAttribute("data-replay-generation", String(generation));
  doc.dispatchEvent(new CustomEvent<ReplayDetail>(REPLAY_EVENT, { detail: { generation } }));
  return generation;
}

/** Subscribes to the replays; returns the unsubscribe function. Safe on the server (no-op). */
export function onReplay(callback: (generation: number) => void, doc?: Document): () => void {
  const target = doc ?? (typeof document === "undefined" ? null : document);
  if (!target) return () => {};
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<ReplayDetail>).detail;
    callback(detail?.generation ?? replayGeneration(target));
  };
  target.addEventListener(REPLAY_EVENT, listener);
  return () => target.removeEventListener(REPLAY_EVENT, listener);
}
