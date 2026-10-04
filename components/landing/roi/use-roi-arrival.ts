"use client";

import { useCallback, useEffect, useLayoutEffect, useState, useSyncExternalStore, type RefObject } from "react";

import { onReplay } from "../replay/replay-bus";
import { ARRIVAL_DELAY_MS, ARRIVAL_THRESHOLD } from "./roi-model";

/**
 * `done`: final values shown (server HTML, no JavaScript, reduced motion, end
 * of the arrival). `armed`: motion welcome, the widget not seen yet — numbers
 * at their start, bars at 0. `playing`: the arrival runs (≤ 1.6 s).
 */
export type RoiState = "armed" | "playing" | "done";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeMotion(onChange: () => void): () => void {
  const query = window.matchMedia?.(REDUCED_MOTION);
  query?.addEventListener?.("change", onChange);
  return () => query?.removeEventListener?.("change", onChange);
}

/** Motion welcome on this device (false on the server and without matchMedia: the final state first). */
export function useMotionWelcome(): boolean {
  return useSyncExternalStore(
    subscribeMotion,
    () => (typeof window.matchMedia === "function" ? !window.matchMedia(REDUCED_MOTION).matches : false),
    () => false,
  );
}

/** Hydrated on the client (false in the server HTML: sliders disabled, the note shown). */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/**
 * Arrival of a ROI widget (docs/design-system.md §2.11.8.8 L4-B): armed once
 * hydrated with motion welcome, it plays 240 ms after its tile is ≥ 40 %
 * visible, once per load — and again after « Rejouer les animations »
 * (L4-D: back to `armed`, then the same threshold). Reduced motion or no
 * `IntersectionObserver`: `done` at once, nothing plays. The widget calls
 * `finish()` when its timeline ends.
 */
export function useRoiArrival(tileRef: RefObject<HTMLElement | null>): {
  state: RoiState;
  motion: boolean;
  finish: () => void;
} {
  const motion = useMotionWelcome();
  const [state, setState] = useState<RoiState>("done");
  const [generation, setGeneration] = useState(0);

  useEffect(() => onReplay(() => setGeneration((value) => value + 1)), []);

  useLayoutEffect(() => {
    // The whole tile (its `article`) must be ≥ 40 % visible, not only the island.
    const tile = tileRef.current?.closest("article") ?? tileRef.current;
    if (!motion || !tile || !("IntersectionObserver" in window)) {
      setState("done");
      return;
    }
    setState("armed");
    let timer: number | undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (!entry || !entry.isIntersecting || entry.intersectionRatio < ARRIVAL_THRESHOLD - 0.001) return;
        observer.disconnect();
        timer = window.setTimeout(() => setState("playing"), ARRIVAL_DELAY_MS);
      },
      { threshold: [0, ARRIVAL_THRESHOLD] },
    );
    observer.observe(tile);
    return () => {
      observer.disconnect();
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [motion, generation, tileRef]);

  const finish = useCallback(() => setState((current) => (current === "playing" ? "done" : current)), []);

  return { state, motion, finish };
}
