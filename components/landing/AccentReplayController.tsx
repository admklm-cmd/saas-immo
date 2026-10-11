"use client";

import { useEffect } from "react";

import { REPLAY_MEDIA, REPLAY_SAFETY_MS, TITLE_WORD, canReplay, isHoverPointer, isTap } from "./accent-replay";
import { onReplay } from "./replay/replay-bus";

/** The tech title (« décide », §2.11.8.2) owns its replay (TechAccent): never touched here. */
const TITLE = "[data-accent-replayable]:not([data-accent-effect='tech'])";

/** Passive listeners: a replay never blocks the scroll (§2.11.8.8 L4-C). */
const PASSIVE: AddEventListenerOptions = { passive: true };

type PendingTap = { pointerId: number; title: Element; x: number; y: number; start: number };

/**
 * Replay of the accented-word effect of the landing titles
 * (docs/design-system.md §2.11.2 D, §2.11.8.8 L4-C; hero and problem here,
 * the tech title by its island). One per page, mounted inside
 * `[data-landing]`: delegated listeners on that root, no React state, renders
 * nothing. It only sets attributes; the CSS (`EditorialTitleReplay.module.css`)
 * does the motion:
 * - hover (mouse, pen, fine hovering pointer): the pointer enters ANY word of
 *   the title (`[data-title-word]`) coming from outside the title; the title
 *   is re-armed when the pointer leaves it. Word to word: nothing;
 * - touch: a brief tap on a word (≤ 10 px, ≤ 600 ms, no `pointercancel`);
 *   passive listeners, never `preventDefault`: the page always scrolls;
 * - `data-accent-played`: set at the first replay (switches the entry
 *   animations off), removed by « Rejouer les animations » (L4-D);
 * - `data-accent-replay="running"`: during a replay;
 * - `data-accent-replays`: number of replays since the load (tests).
 * Attached while motion is welcome (live media query); each path checks its
 * own pointer type.
 *
 * « Rejouer les animations »: every landing title loses `data-accent-played`;
 * the titles revealed on load (hero) restart their CSS entry animations
 * (`cancel()` then `play()`); the others follow their `Reveal`.
 */
export function AccentReplayController() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-landing]");
    if (!root || typeof window.matchMedia !== "function") return;
    const pointer = window.matchMedia(REPLAY_MEDIA.pointer);
    const motion = window.matchMedia(REPLAY_MEDIA.motion);

    const lastEnd = new WeakMap<Element, number>();
    const safety = new Map<Element, number>();
    /** Titles the hover pointer has entered and not left yet (disarmed). */
    const disarmed = new WeakSet<Element>();
    let tap: PendingTap | null = null;

    const finish = (title: Element) => {
      const timer = safety.get(title);
      if (timer !== undefined) window.clearTimeout(timer);
      safety.delete(title);
      if (title.getAttribute("data-accent-replay") !== "running") return;
      title.removeAttribute("data-accent-replay");
      lastEnd.set(title, performance.now());
    };

    const tryReplay = (title: Element, pointerType: string) => {
      const running = title.getAttribute("data-accent-replay") === "running";
      const allowed = canReplay({
        pointerType,
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

    const titleOfWord = (target: EventTarget | null): Element | null => {
      const word = (target as Element | null)?.closest?.(TITLE_WORD);
      const title = word?.closest(TITLE) ?? null;
      return title && root.contains(title) ? title : null;
    };

    const onPointerOver = (event: PointerEvent) => {
      if (!isHoverPointer(event.pointerType) || !pointer.matches) return;
      const title = titleOfWord(event.target);
      if (!title || disarmed.has(title)) return;
      // Entered from outside: one attempt, then the title waits for the pointer to leave.
      disarmed.add(title);
      tryReplay(title, event.pointerType);
    };

    const onPointerOut = (event: PointerEvent) => {
      const title = (event.target as Element | null)?.closest?.(TITLE);
      if (!title) return;
      const to = event.relatedTarget;
      if (to instanceof Node && title.contains(to)) return;
      disarmed.delete(title);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "touch") return;
      const title = titleOfWord(event.target);
      tap = title ? { pointerId: event.pointerId, title, x: event.clientX, y: event.clientY, start: performance.now() } : null;
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!tap || event.pointerId !== tap.pointerId) return;
      const { title, x, y, start } = tap;
      tap = null;
      const sample = { dx: event.clientX - x, dy: event.clientY - y, duration: performance.now() - start, cancelled: false };
      if (isTap(sample)) tryReplay(title, "touch");
    };

    const onPointerCancel = (event: PointerEvent) => {
      if (tap && event.pointerId === tap.pointerId) tap = null;
    };

    // The replay ends with the element that finishes last (words, or the hero
    // mark): when no animation is running any more in the title.
    const onAnimationEnd = (event: AnimationEvent) => {
      const title = (event.target as Element | null)?.closest?.(TITLE);
      if (!title || title.getAttribute("data-accent-replay") !== "running") return;
      if (title.getAnimations({ subtree: true }).some((animation) => animation.playState === "running")) return;
      finish(title);
    };

    const listeners: [string, EventListener][] = [
      ["pointerover", onPointerOver as EventListener],
      ["pointerout", onPointerOut as EventListener],
      ["pointerdown", onPointerDown as EventListener],
      ["pointerup", onPointerUp as EventListener],
      ["pointercancel", onPointerCancel as EventListener],
      ["animationend", onAnimationEnd as EventListener],
    ];

    let attached = false;
    const sync = () => {
      const wanted = motion.matches;
      if (wanted === attached) return;
      attached = wanted;
      for (const [type, listener] of listeners) {
        if (wanted) root.addEventListener(type, listener, PASSIVE);
        else root.removeEventListener(type, listener, PASSIVE);
      }
      if (!wanted) {
        tap = null;
        // A replay in flight still ends (never frozen half-blurred).
        for (const title of [...safety.keys()]) finish(title);
      }
    };

    // « Rejouer les animations » (§2.11.8.8 L4-D): back to the entry state.
    const offReplay = onReplay(() => {
      if (!motion.matches) return;
      tap = null;
      for (const title of root.querySelectorAll("[data-title-reveal]")) {
        if (title.matches(TITLE)) finish(title);
        title.removeAttribute("data-accent-played");
        title.removeAttribute("data-accent-replay");
        if (title.getAttribute("data-title-reveal") !== "load") continue;
        for (const animation of title.getAnimations({ subtree: true })) {
          animation.cancel();
          animation.play();
        }
      }
    });

    sync();
    motion.addEventListener("change", sync);
    return () => {
      offReplay();
      motion.removeEventListener("change", sync);
      for (const [type, listener] of listeners) root.removeEventListener(type, listener, PASSIVE);
      for (const timer of safety.values()) window.clearTimeout(timer);
      safety.clear();
    };
  }, []);

  return null;
}
