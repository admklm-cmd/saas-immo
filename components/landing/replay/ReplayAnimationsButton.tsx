"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { Icon } from "@/components/icons/Icon";
import { LANDING_TEXTS } from "@/components/landing-texts";

import { onReplay, requestReplay } from "./replay-bus";
import styles from "./replay.module.css";

const TEXTS = LANDING_TEXTS.replay;
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
/** After a click, the button ignores clicks for this long (ms). */
export const REPLAY_LOCK_MS = 1200;

function subscribeMotion(onChange: () => void): () => void {
  const query = window.matchMedia?.(REDUCED_MOTION);
  query?.addEventListener?.("change", onChange);
  return () => query?.removeEventListener?.("change", onChange);
}

/** Motion welcome AND hydrated: false in the server HTML and under reduced motion (the button is absent). */
function useReplayAvailable(): boolean {
  return useSyncExternalStore(
    subscribeMotion,
    () => (typeof window.matchMedia === "function" ? !window.matchMedia(REDUCED_MOTION).matches : false),
    () => false,
  );
}

/**
 * « Rejouer les animations » (docs/design-system.md §2.11.8.8 L4-D): a
 * discreet fixed button, bottom left, that replays every arrival of `/` as on
 * the first load — without reloading nor moving the page; the living
 * background is excluded. Emits the replay event (`replay-bus.ts`); each
 * island goes back to its armed state. Rendered after hydration only, and
 * never under reduced motion (nothing moves: the button would be noise).
 * Pill with its label ≥ 640 px, round icon button below (label `sr-only`).
 * Ignores clicks for 1 200 ms after one (`aria-disabled`), keeps the focus,
 * and announces « Animations relancées. » politely. Also replays the single
 * cycle of the « Simulation » badges of the page.
 */
export function ReplayAnimationsButton() {
  const available = useReplayAvailable();
  const [locked, setLocked] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const timer = useRef<number | undefined>(undefined);

  // The « Simulation » badges of the landing play one CSS cycle: replay it.
  useEffect(
    () =>
      onReplay(() => {
        for (const badge of document.querySelectorAll("[data-landing] :is(.simulation-badge, .simulation-dot)")) {
          for (const animation of badge.getAnimations()) {
            animation.cancel();
            animation.play();
          }
        }
      }),
    [],
  );

  const announceTimer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      window.clearTimeout(announceTimer.current);
    },
    [],
  );

  if (!available) return null;

  const onClick = () => {
    if (locked) return;
    setLocked(true);
    requestReplay();
    // Same text twice in a row: clear first so it is announced again.
    setAnnouncement("");
    window.clearTimeout(announceTimer.current);
    announceTimer.current = window.setTimeout(() => setAnnouncement(TEXTS.done), 50);
    timer.current = window.setTimeout(() => setLocked(false), REPLAY_LOCK_MS);
  };

  return (
    <>
      <button
        type="button"
        className={styles.button}
        onClick={onClick}
        aria-disabled={locked ? "true" : undefined}
        data-testid="landing-replay"
      >
        <Icon name="replay" px={14} className={styles.icon} />
        <span className={styles.label}>{TEXTS.label}</span>
      </button>
      <p className="sr-only" aria-live="polite" data-testid="landing-replay-status">
        {announcement}
      </p>
    </>
  );
}
