"use client";

/**
 * Adapted from React Bits — TechText (https://reactbits.dev)
 * Copyright (c) 2026 David Haz — MIT + Commons Clause License Condition v1.0:
 * full notice in THIRD_PARTY_NOTICES.md (keep it; never sell or redistribute
 * this component on its own).
 *
 * The `tech` effect of an accented title word — « décide », control section
 * of the landing (docs/design-system.md §2.11.8.2). Mounted by
 * `EditorialTitle` inside `.title-accent`; the title itself stays a Server
 * Component and plain HTML text (its accessible name never changes: the
 * visual words are `aria-hidden`).
 *
 * - Server HTML, no JavaScript, reduced motion: the word in plain ink, one
 *   span per letter, no canvas, no listener.
 * - Arrival, once: 760 ms after the `Reveal` of the section enters, the cobalt
 *   frame sweeps the letters (≤ 1.6 s), then rest.
 * - Hover replay (mouse, pen, §2.11.2 D conditions): the sweep replays.
 *   `AccentReplayController` ignores this title; this island owns its replay.
 * - Fine pointer near the word: follow (dashed outline, frame, label); a
 *   letter can be dragged (mouse, pen) and springs back.
 * - Touch, coarse pointer, keyboard: nothing after the arrival; the page
 *   always scrolls.
 */

import { useEffect, useRef, useSyncExternalStore } from "react";

import { REPLAY_MEDIA, canReplay } from "@/components/landing/accent-replay";

import { SWEEP_DELAY_MS } from "./tech-accent";
import { TechAccentEngine, type SweepKind } from "./tech-accent-engine";
import styles from "./TechAccent.module.css";

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
    // No matchMedia (old engine, test DOM): treated as still.
    () => (typeof window.matchMedia === "function" ? !window.matchMedia(REDUCED_MOTION).matches : false),
    () => false,
  );
}

export function TechAccent({ word }: { word: string }) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const motion = useMotionWelcome();

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const title = root?.closest<HTMLElement>("h1, h2");
    if (!motion || !root || !canvas || !title) return;

    let arrivalDone = false;
    let replayRunning = false;
    let lastReplayEnd: number | null = null;
    let arrivalTimer: number | undefined;
    let cancelled = false;

    const onSweepEnd = (kind: SweepKind) => {
      if (kind === "arrival") arrivalDone = true;
      if (kind === "replay" && replayRunning) {
        replayRunning = false;
        lastReplayEnd = performance.now();
        title.removeAttribute("data-accent-replay");
      }
    };
    const engine = new TechAccentEngine(title, root, canvas, onSweepEnd);

    // Arrival: once, 760 ms after the Reveal of the section enters.
    const reveal = root.closest<HTMLElement>(".reveal");
    const arm = () => {
      const enteredAt = performance.now();
      void (document.fonts?.ready ?? Promise.resolve()).then(() => {
        if (cancelled) return;
        const wait = Math.max(0, SWEEP_DELAY_MS - (performance.now() - enteredAt));
        arrivalTimer = window.setTimeout(() => {
          arrivalTimer = undefined;
          if (document.visibilityState !== "visible" || !engine.startSweep("arrival")) arrivalDone = true;
        }, wait);
      });
    };
    let revealObserver: MutationObserver | null = null;
    const revealState = () => reveal?.getAttribute("data-reveal");
    if (!reveal || revealState() === "entering") arm();
    else if (revealState() === "hidden") {
      revealObserver = new MutationObserver(() => {
        if (revealState() !== "entering") return;
        revealObserver?.disconnect();
        revealObserver = null;
        arm();
      });
      revealObserver.observe(reveal, { attributes: true, attributeFilter: ["data-reveal"] });
    } else arrivalDone = true; // Never hidden: no entry to follow, nothing to sweep.

    const finePointer = window.matchMedia?.(REPLAY_MEDIA.pointer);
    const onOver = (event: PointerEvent) => {
      const from = event.relatedTarget;
      if (from instanceof Node && title.contains(from)) return;
      if (!finePointer?.matches) return;
      const allowed = canReplay({
        pointerType: event.pointerType,
        running: replayRunning,
        entryRunning: !arrivalDone || engine.current !== "idle",
        revealHidden: revealState() === "hidden",
        now: performance.now(),
        lastEnd: lastReplayEnd,
      });
      if (!allowed || !engine.startSweep("replay")) return;
      replayRunning = true;
      title.setAttribute("data-accent-replay", "running");
      title.setAttribute("data-accent-replays", String(Number(title.getAttribute("data-accent-replays") ?? 0) + 1));
    };
    const onMove = (event: PointerEvent) => engine.pointerMove(event);
    const onLeave = (event: PointerEvent) => engine.pointerLeave(event);
    const onDown = (event: PointerEvent) => engine.pointerDown(event);
    const onUp = (event: PointerEvent) => engine.pointerUp(event);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") engine.release();
    };
    const onVisibility = () => {
      if (document.visibilityState !== "hidden") return;
      // Hidden tab: stop, back to rest; a pending arrival is dropped, never replayed.
      if (arrivalTimer !== undefined) window.clearTimeout(arrivalTimer);
      arrivalTimer = undefined;
      arrivalDone = true;
      engine.reset();
    };
    const onResize = () => engine.remeasure();

    title.addEventListener("pointerover", onOver);
    title.addEventListener("pointermove", onMove);
    title.addEventListener("pointerleave", onLeave);
    title.addEventListener("pointerdown", onDown);
    title.addEventListener("pointerup", onUp);
    title.addEventListener("pointercancel", onUp);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      revealObserver?.disconnect();
      if (arrivalTimer !== undefined) window.clearTimeout(arrivalTimer);
      title.removeEventListener("pointerover", onOver);
      title.removeEventListener("pointermove", onMove);
      title.removeEventListener("pointerleave", onLeave);
      title.removeEventListener("pointerdown", onDown);
      title.removeEventListener("pointerup", onUp);
      title.removeEventListener("pointercancel", onUp);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      engine.reset();
    };
  }, [motion]);

  return (
    <span ref={rootRef} className={styles.word} data-tech-accent="">
      {Array.from(word).map((char, index) => (
        <span key={`${index}-${char}`} className={styles.letter} data-letter={index}>
          {char}
        </span>
      ))}
      {motion ? <canvas ref={canvasRef} className={styles.canvas} data-testid="tech-accent-canvas" /> : null}
    </span>
  );
}
