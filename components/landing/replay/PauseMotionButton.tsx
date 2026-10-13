"use client";

import { useContext, useSyncExternalStore } from "react";

import { LANDING_TEXTS } from "@/components/landing-texts";

import { HeroMotionContext } from "../hero/hero-motion-context";
import styles from "./replay.module.css";

const TEXTS = LANDING_TEXTS.replay;
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeMotion(onChange: () => void): () => void {
  const query = window.matchMedia?.(REDUCED_MOTION);
  query?.addEventListener?.("change", onChange);
  return () => query?.removeEventListener?.("change", onChange);
}

/** Motion welcome AND hydrated: false in the server HTML and under reduced motion (nothing moves: no pause to offer). */
function useMotionAvailable(): boolean {
  return useSyncExternalStore(
    subscribeMotion,
    () => (typeof window.matchMedia === "function" ? !window.matchMedia(REDUCED_MOTION).matches : false),
    () => false,
  );
}

/**
 * Fixed « Pause » button (docs/design-system.md T.7), next to « Rejouer les animations »: the pause of
 * the whole landing motion (the hero and the particle field of the page) stays reachable after the
 * scroll, like the one of the terminal, which is the entry point asked for. The two share one state
 * (`HeroMotionProvider`). The label turns into « Reprendre » while paused.
 */
export function PauseMotionButton() {
  const available = useMotionAvailable();
  const { stopped, setStopped } = useContext(HeroMotionContext);
  if (!available) return null;
  return (
    <button
      type="button"
      className={`${styles.button} ${styles.pause}`}
      onClick={() => setStopped(!stopped)}
      data-testid="landing-pause"
      data-state={stopped ? "paused" : "playing"}
      aria-label={stopped ? TEXTS.resumeName : TEXTS.pauseName}
    >
      <span aria-hidden="true">
        {stopped ? TEXTS.resume : TEXTS.pause}
      </span>
    </button>
  );
}
