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
 * - Replay (§2.11.2 D conditions, §2.11.8.8 L4-C): the sweep replays when a
 *   mouse or a pen enters any word of the title from outside it, or on a
 *   brief tap on a word (sweep only: never follow nor drag under a finger).
 *   `AccentReplayController` ignores this title; this island owns its replay.
 * - « Rejouer les animations » (L4-D): back to the armed state, the arrival
 *   sweep plays again when the section Reveal enters again.
 * - Fine pointer near the word: follow (dashed outline, frame, label); a
 *   letter can be dragged (mouse, pen) and springs back.
 * - Touch: passive listeners only; the page always scrolls. Keyboard:
 *   nothing (the global replay button replays everything).
 */

import { useEffect, useRef, useSyncExternalStore } from "react";

import { REPLAY_MEDIA, TITLE_WORD, canReplay, isHoverPointer, isTap } from "@/components/landing/accent-replay";
import { onReplay } from "@/components/landing/replay/replay-bus";

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
    /** The hover pointer entered the title and has not left it yet (§2.11.8.8 L4-C). */
    let disarmed = false;
    let tap: { pointerId: number; x: number; y: number; start: number } | null = null;

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
    /** Arms the arrival when the Reveal enters (after having been hidden, when `sawHidden` is false). */
    const followReveal = (sawHidden: boolean) => {
      revealObserver?.disconnect();
      let hiddenSeen = sawHidden;
      revealObserver = new MutationObserver(() => {
        const state = revealState();
        if (state === "hidden") hiddenSeen = true;
        if (state !== "entering" || !hiddenSeen) return;
        revealObserver?.disconnect();
        revealObserver = null;
        arm();
      });
      revealObserver.observe(reveal!, { attributes: true, attributeFilter: ["data-reveal"] });
    };
    if (!reveal || revealState() === "entering") arm();
    else if (revealState() === "hidden") followReveal(true);
    else arrivalDone = true; // Never hidden: no entry to follow, nothing to sweep.

    const finePointer = window.matchMedia?.(REPLAY_MEDIA.pointer);
    const replay = (pointerType: string) => {
      const allowed = canReplay({
        pointerType,
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
    const onOver = (event: PointerEvent) => {
      if (!isHoverPointer(event.pointerType) || !finePointer?.matches) return;
      // Any word of the title, entered from outside the title (re-armed on leave).
      if (disarmed || !(event.target as Element | null)?.closest?.(TITLE_WORD)) return;
      disarmed = true;
      replay(event.pointerType);
    };
    const onOut = (event: PointerEvent) => {
      const to = event.relatedTarget;
      if (to instanceof Node && title.contains(to)) return;
      disarmed = false;
    };
    const onMove = (event: PointerEvent) => engine.pointerMove(event);
    const onLeave = (event: PointerEvent) => engine.pointerLeave(event);
    const onDown = (event: PointerEvent) => {
      if (event.pointerType === "touch") {
        // A brief tap on a word replays the sweep only: never follow nor drag under a finger.
        tap = (event.target as Element | null)?.closest?.(TITLE_WORD)
          ? { pointerId: event.pointerId, x: event.clientX, y: event.clientY, start: performance.now() }
          : null;
        return;
      }
      engine.pointerDown(event);
    };
    const onUp = (event: PointerEvent) => {
      if (event.pointerType === "touch") {
        if (!tap || tap.pointerId !== event.pointerId) return;
        const sample = { dx: event.clientX - tap.x, dy: event.clientY - tap.y, duration: performance.now() - tap.start, cancelled: false };
        tap = null;
        if (isTap(sample)) replay("touch");
        return;
      }
      engine.pointerUp(event);
    };
    const onCancel = (event: PointerEvent) => {
      if (event.pointerType === "touch") {
        tap = null;
        return;
      }
      engine.pointerUp(event);
    };
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

    // « Rejouer les animations » (§2.11.8.8 L4-D): back to the armed state;
    // the arrival sweep plays again when the Reveal enters again.
    const offReplay = onReplay(() => {
      if (arrivalTimer !== undefined) window.clearTimeout(arrivalTimer);
      arrivalTimer = undefined;
      engine.reset();
      replayRunning = false;
      tap = null;
      title.removeAttribute("data-accent-replay");
      arrivalDone = false;
      if (reveal) followReveal(false);
      else arm();
    });

    const passive: AddEventListenerOptions = { passive: true };
    title.addEventListener("pointerover", onOver, passive);
    title.addEventListener("pointerout", onOut, passive);
    title.addEventListener("pointermove", onMove, passive);
    title.addEventListener("pointerleave", onLeave, passive);
    title.addEventListener("pointerdown", onDown, passive);
    title.addEventListener("pointerup", onUp, passive);
    title.addEventListener("pointercancel", onCancel, passive);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      offReplay();
      revealObserver?.disconnect();
      if (arrivalTimer !== undefined) window.clearTimeout(arrivalTimer);
      title.removeEventListener("pointerover", onOver, passive);
      title.removeEventListener("pointerout", onOut, passive);
      title.removeEventListener("pointermove", onMove, passive);
      title.removeEventListener("pointerleave", onLeave, passive);
      title.removeEventListener("pointerdown", onDown, passive);
      title.removeEventListener("pointerup", onUp, passive);
      title.removeEventListener("pointercancel", onCancel, passive);
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
