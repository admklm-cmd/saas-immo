"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent } from "react";

import { Icon } from "@/components/icons/Icon";
import { LANDING_TEXTS } from "@/components/landing-texts";
import { SimulationBadge } from "@/components/ui/SimulationBadge";

import {
  clampStep,
  isFirstStep,
  isLastStep,
  nextStepIndex,
  positionLabel,
  PROCESS_STEPS,
  progressLabel,
  progressRatio,
  stepAnnouncement,
  VISUAL_DURATIONS_MS,
} from "./process-carousel";
import { ProcessCard } from "./ProcessCard";
import styles from "./process.module.css";
import { onReplay } from "../replay/replay-bus";
import { useProcessTrack } from "./useProcessTrack";
import type { VisualState } from "./visuals/VisualFrame";

const TEXTS = LANDING_TEXTS.final.carousel;
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
/** The first card plays once the carousel is half visible. */
const SEEN_RATIO = 0.5;
/** Margin after the end of a drawing before it is marked `done` (ms). */
const DONE_MARGIN_MS = 60;

const INITIAL_STATES: readonly VisualState[] = PROCESS_STEPS.map(() => "idle");

function subscribeMotion(onChange: () => void): () => void {
  const query = window.matchMedia?.(REDUCED_MOTION);
  query?.addEventListener?.("change", onChange);
  return () => query?.removeEventListener?.("change", onChange);
}

/** Motion welcome on this device; false on the server and without matchMedia: the still final state. */
function useMotionWelcome(): boolean {
  return useSyncExternalStore(
    subscribeMotion,
    () => (typeof window.matchMedia === "function" ? !window.matchMedia(REDUCED_MOTION).matches : false),
    () => false,
  );
}

/**
 * The seven steps of a dossier, as a carousel of process cards (block C,
 * docs/design-system.md §2.11.8.5). The active card sits in the middle, its
 * neighbours dimmed; its drawing plays ONCE when it becomes active (the first
 * one when the carousel is half visible), and again only when the user brings
 * it back. Nothing ever moves on its own: no autoplay, no loop.
 *
 * Arrows (buttons, `aria-disabled` at the ends), mouse drag with inertia,
 * native touch scroll with snap, keyboard on the focusable track (← → Home
 * End), click on a neighbour. Progress bar and percentage computed. A polite
 * live region announces the step after a change made by the user, never on
 * load. Reduced motion: every drawing at its final state, no glide.
 */
export function ProcessCarousel() {
  const [active, setActive] = useState(0);
  const [states, setStates] = useState<readonly VisualState[]>(INITIAL_STATES);
  const [plays, setPlays] = useState<readonly number[]>(() => PROCESS_STEPS.map(() => 0));
  const [announcement, setAnnouncement] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const timers = useRef<Map<number, number>>(new Map());
  const seen = useRef(false);
  const activeRef = useRef(0);
  const motion = useMotionWelcome();
  // Armed: motion allowed and the observer available — the first card waits on its first frame.
  const armed = motion && typeof IntersectionObserver !== "undefined";
  // « Rejouer les animations » (§2.11.8.8 L4-D): back to step 1 at once, drawings armed again.
  const [generation, setGeneration] = useState(0);

  const play = useCallback((index: number) => {
    if (window.matchMedia?.(REDUCED_MOTION).matches) return;
    const step = PROCESS_STEPS[index];
    if (!step) return;
    const previous = timers.current.get(index);
    if (previous !== undefined) window.clearTimeout(previous);
    setStates((current) => current.map((state, i) => (i === index ? "playing" : state)));
    setPlays((current) => current.map((count, i) => (i === index ? count + 1 : count)));
    timers.current.set(
      index,
      window.setTimeout(() => {
        timers.current.delete(index);
        setStates((current) => current.map((state, i) => (i === index ? "done" : state)));
      }, VISUAL_DURATIONS_MS[step.key] + DONE_MARGIN_MS),
    );
  }, []);

  /** A change made by the user: new active card, its drawing plays, the step is announced. */
  const activate = useCallback(
    (index: number) => {
      const next = clampStep(index);
      if (next === activeRef.current) return;
      activeRef.current = next;
      seen.current = true;
      setActive(next);
      setAnnouncement(stepAnnouncement(next));
      play(next);
    },
    [play],
  );

  const { centre, handlers } = useProcessTrack(trackRef, { active, onSettle: activate });

  // Motion allowed: the first card plays once the carousel is half visible.
  useEffect(() => {
    const root = rootRef.current;
    if (!armed || !root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= SEEN_RATIO)) return;
        observer.disconnect();
        if (seen.current) return;
        seen.current = true;
        play(activeRef.current);
      },
      { threshold: [SEEN_RATIO] },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, [armed, play, generation]);

  useEffect(
    () =>
      onReplay(() => {
        if (!armed) return;
        for (const timer of timers.current.values()) window.clearTimeout(timer);
        timers.current.clear();
        activeRef.current = 0;
        seen.current = false;
        setActive(0);
        setStates(INITIAL_STATES);
        setAnnouncement("");
        // A glide in flight stops (the track listens to « wheel » for that), then step 1 at once.
        trackRef.current?.dispatchEvent(new Event("wheel"));
        trackRef.current?.scrollTo({ left: 0, behavior: "instant" });
        setGeneration((value) => value + 1);
      }),
    [armed],
  );

  // Pending « done » timers die with the carousel.
  useEffect(() => {
    const live = timers.current;
    return () => {
      for (const timer of live.values()) window.clearTimeout(timer);
      live.clear();
    };
  }, []);

  function go(index: number) {
    const next = clampStep(index);
    activate(next);
    centre(next);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const next = nextStepIndex(event.key, active);
    if (next === null) return;
    event.preventDefault();
    go(next);
  }

  const atStart = isFirstStep(active);
  const atEnd = isLastStep(active);

  return (
    <div
      ref={rootRef}
      role="region"
      aria-roledescription="carrousel"
      aria-label={TEXTS.label}
      className={styles.carousel}
      data-testid="process-carousel"
      data-active-step={active}
      data-armed={armed ? "" : undefined}
    >
      <div className={styles.stage}>
        <div className={styles.grid} aria-hidden="true">
          <span className={styles.gridColumns} />
          <span className={styles.gridTop} />
        </div>
        <div className={styles.arrows}>
          <button
            type="button"
            className={`ui-focus ${styles.arrow}`}
            aria-label={TEXTS.previous}
            aria-disabled={atStart ? true : undefined}
            data-testid="process-previous"
            onClick={() => (atStart ? undefined : go(active - 1))}
          >
            <Icon name="arrowLeft" px={16} />
          </button>
          <button
            type="button"
            className={`ui-focus ${styles.arrow}`}
            aria-label={TEXTS.next}
            aria-disabled={atEnd ? true : undefined}
            data-testid="process-next"
            onClick={() => (atEnd ? undefined : go(active + 1))}
          >
            <Icon name="arrowRight" px={16} />
          </button>
        </div>
        <div className={styles.trackFrame}>
          {/* Focusable for the keyboard (← → Home End); its cards hold nothing focusable. */}
          <div
            ref={trackRef}
            className={styles.track}
            tabIndex={0}
            data-testid="process-track"
            data-at-start=""
            onKeyDown={onKeyDown}
            {...handlers}
          >
            {PROCESS_STEPS.map((step, index) => (
              <ProcessCard
                key={step.key}
                step={step}
                index={index}
                active={index === active}
                state={motion ? (states[index] ?? "idle") : "done"}
                playKey={plays[index] ?? 0}
                paused={armed && index === active && states[index] === "idle"}
                onSelect={go}
              />
            ))}
          </div>
        </div>
      </div>

      <p className={styles.caption}>
        <SimulationBadge surface="dark" />
        <span>{TEXTS.badge}</span>
      </p>

      <div className={styles.progress}>
        <span className={styles.bar} aria-hidden="true">
          <span className={styles.fill} style={{ "--progress": progressRatio(active) } as CSSProperties} />
        </span>
        <span className={styles.percent} aria-hidden="true" data-testid="process-percent">
          {progressLabel(active)}
        </span>
        <span className="sr-only">{positionLabel(active)}</span>
      </div>

      <p className="sr-only" aria-live="polite" data-testid="process-live">
        {announcement}
      </p>
    </div>
  );
}

