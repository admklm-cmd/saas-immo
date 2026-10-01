"use client";

/**
 * Adapted from React Bits — TechText (https://reactbits.dev)
 *
 * The short brand name (`BRAND.shortName`), very large, signing the landing final panel
 * (docs/design-system.md §2.11.3). Re-interpreted without `motion`: ink and
 * cobalt only, no glow, a sweep played ONCE, then only the pointer wakes it.
 *
 * - Server HTML, no JavaScript, reduced motion: the word in plain ink, no
 *   canvas, no listener.
 * - At rest: the HTML letters, the canvas empty, no animation frame.
 * - Touch: never blocks the scroll (`touch-action: pan-y pinch-zoom`, no
 *   `preventDefault`); a short tap shows the frame on a letter for 1.2 s.
 *
 * `aria-hidden`: decorative. The full name (`BRAND.name`) is already read
 * in the header logo and in the footer; a `role="img"` would announce it a
 * third time in the middle of the call to action, with nothing new.
 */

import { useEffect, useRef, useSyncExternalStore } from "react";

import { cn } from "@/components/ui/cn";

import { SWEEP_DELAY_MS, SWEEP_VISIBLE_SHARE } from "./tech-wordmark";
import { WordmarkEngine } from "./wordmark-engine";
import styles from "./TechWordmark.module.css";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeMotion(onChange: () => void): () => void {
  const query = window.matchMedia?.(REDUCED_MOTION);
  query?.addEventListener?.("change", onChange);
  return () => query?.removeEventListener?.("change", onChange);
}

/** Motion welcome on this device (false on the server: HTML first). */
function useMotionWelcome(): boolean {
  return useSyncExternalStore(
    subscribeMotion,
    () => !window.matchMedia?.(REDUCED_MOTION).matches,
    () => false,
  );
}

export function TechWordmark({ text, className }: { text: string; className?: string }) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const motion = useMotionWelcome();

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!motion || !root || !canvas) return;

    const engine = new WordmarkEngine(root, canvas);
    let sweepTimer: number | undefined;
    let cancelled = false;

    // The sweep: once, 2 s after the word is first 60 % on screen.
    const observer =
      "IntersectionObserver" in window
        ? new IntersectionObserver(
            (entries) => {
              if (!entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= SWEEP_VISIBLE_SHARE)) return;
              observer?.disconnect();
              void document.fonts.ready.then(() => {
                if (cancelled) return;
                sweepTimer = window.setTimeout(() => {
                  sweepTimer = undefined;
                  if (document.visibilityState === "visible") engine.startSweep();
                }, SWEEP_DELAY_MS);
              });
            },
            { threshold: SWEEP_VISIBLE_SHARE },
          )
        : null;
    observer?.observe(root);

    const onMove = (event: PointerEvent) => engine.pointerMove(event);
    const onLeave = (event: PointerEvent) => engine.pointerLeave(event);
    const onDown = (event: PointerEvent) => engine.pointerDown(event);
    const onUp = (event: PointerEvent) => engine.pointerUp(event);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") engine.release();
    };
    const onVisibility = () => {
      if (document.visibilityState !== "hidden") return;
      // Hidden tab: stop, back to rest; a pending sweep is dropped, never replayed.
      if (sweepTimer !== undefined) window.clearTimeout(sweepTimer);
      sweepTimer = undefined;
      engine.reset();
    };
    const onResize = () => engine.remeasure();

    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave);
    root.addEventListener("pointerdown", onDown);
    root.addEventListener("pointerup", onUp);
    root.addEventListener("pointercancel", onUp);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      observer?.disconnect();
      if (sweepTimer !== undefined) window.clearTimeout(sweepTimer);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      root.removeEventListener("pointerdown", onDown);
      root.removeEventListener("pointerup", onUp);
      root.removeEventListener("pointercancel", onUp);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      engine.reset();
    };
  }, [motion]);

  return (
    <span
      ref={rootRef}
      aria-hidden="true"
      data-testid="tech-wordmark"
      data-wordmark-state="idle"
      className={cn(styles.wordmark, className)}
    >
      {Array.from(text).map((char, index) => (
        <span key={`${index}-${char}`} className={styles.letter} data-letter={index}>
          {char}
        </span>
      ))}
      {motion ? <canvas ref={canvasRef} className={styles.canvas} data-testid="tech-wordmark-canvas" /> : null}
    </span>
  );
}
