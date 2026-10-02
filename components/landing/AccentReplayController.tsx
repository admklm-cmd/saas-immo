"use client";

import { useEffect } from "react";

import { REPLAY_MEDIA, REPLAY_SAFETY_MS, canReplay } from "./accent-replay";

/** The tech title (« décide », §2.11.8.2) owns its replay (TechAccent): never touched here. */
const TITLE = "[data-accent-replayable]:not([data-accent-effect='tech'])";

/**
 * Hover replay of the accented-word effect of the landing titles
 * (docs/design-system.md §2.11.2 D; since §2.11.8.2, three titles have an
 * effect: hero and problem are replayed here, the tech title by its island). One per page, mounted inside
 * `[data-landing]`: one delegated listener on that root, no listener per title,
 * no React state, renders nothing. It only sets attributes; the CSS
 * (`EditorialTitleReplay.module.css`) does the motion:
 * - `data-accent-played`: set at the first replay, never removed (switches the
 *   entry animations off for good, so they are never replayed);
 * - `data-accent-replay="running"`: during a replay;
 * - `data-accent-replays`: number of replays since the load (tests).
 * Attached only while a fine hovering pointer is present AND motion is
 * welcome; both media queries are listened to live.
 */
export function AccentReplayController() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-landing]");
    if (!root || typeof window.matchMedia !== "function") return;
    const pointer = window.matchMedia(REPLAY_MEDIA.pointer);
    const motion = window.matchMedia(REPLAY_MEDIA.motion);

    const lastEnd = new WeakMap<Element, number>();
    const safety = new Map<Element, number>();

    const finish = (title: Element) => {
      const timer = safety.get(title);
      if (timer !== undefined) window.clearTimeout(timer);
      safety.delete(title);
      if (title.getAttribute("data-accent-replay") !== "running") return;
      title.removeAttribute("data-accent-replay");
      lastEnd.set(title, performance.now());
    };

    const onPointerOver = (event: PointerEvent) => {
      const title = (event.target as Element | null)?.closest?.(TITLE);
      if (!title || !root.contains(title)) return;
      // Moving inside the title (or between its words) is not an entry.
      const from = event.relatedTarget;
      if (from instanceof Node && title.contains(from)) return;
      const running = title.getAttribute("data-accent-replay") === "running";
      const allowed = canReplay({
        pointerType: event.pointerType,
        running,
        entryRunning: !running && title.getAnimations({ subtree: true }).some((animation) => animation.playState === "running"),
        revealHidden: Boolean(title.closest(".reveal[data-reveal='hidden']")),
        now: performance.now(),
        lastEnd: lastEnd.get(title) ?? null,
      });
      if (!allowed) return;
      title.setAttribute("data-accent-played", "");
      title.setAttribute("data-accent-replay", "running");
      title.setAttribute("data-accent-replays", String(Number(title.getAttribute("data-accent-replays") ?? 0) + 1));
      safety.set(title, window.setTimeout(() => finish(title), REPLAY_SAFETY_MS));
    };

    // The replay ends with the element that finishes last (words, or the hero
    // mark): when no animation is running any more in the title.
    const onAnimationEnd = (event: AnimationEvent) => {
      const title = (event.target as Element | null)?.closest?.(TITLE);
      if (!title || title.getAttribute("data-accent-replay") !== "running") return;
      if (title.getAnimations({ subtree: true }).some((animation) => animation.playState === "running")) return;
      finish(title);
    };

    let attached = false;
    const sync = () => {
      const wanted = pointer.matches && motion.matches;
      if (wanted === attached) return;
      attached = wanted;
      if (wanted) {
        root.addEventListener("pointerover", onPointerOver);
        root.addEventListener("animationend", onAnimationEnd);
      } else {
        root.removeEventListener("pointerover", onPointerOver);
        root.removeEventListener("animationend", onAnimationEnd);
        // A replay in flight still ends (never frozen half-blurred).
        for (const title of [...safety.keys()]) finish(title);
      }
    };

    sync();
    pointer.addEventListener("change", sync);
    motion.addEventListener("change", sync);
    return () => {
      pointer.removeEventListener("change", sync);
      motion.removeEventListener("change", sync);
      root.removeEventListener("pointerover", onPointerOver);
      root.removeEventListener("animationend", onAnimationEnd);
      for (const timer of safety.values()) window.clearTimeout(timer);
      safety.clear();
    };
  }, []);

  return null;
}
