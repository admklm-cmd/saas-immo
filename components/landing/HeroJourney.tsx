"use client";

import { useEffect, useRef, useState } from "react";

import { LANDING_TEXTS } from "@/components/landing-texts";
import { SimulationBadge } from "@/components/ui/SimulationBadge";
import { cn } from "@/components/ui/cn";

import { finalFrame, journeySequence, stepState, type JourneyFrame, type JourneyStepState } from "./journey-timeline";

const TEXTS = LANDING_TEXTS.journey;
const STEPS = TEXTS.steps;
const KINDS = STEPS.map((step) => step.kind);
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
/** Share of the illustration that must be on screen before it plays. */
const VISIBLE_SHARE = 0.5;

type Playback = "ready" | "playing" | "played";

/** Written state of a step: the words carry the meaning, never the colour alone. */
function stateLabel(state: JourneyStepState, human: boolean, isLast: boolean): string {
  if (state === "waiting") return TEXTS.states.waiting;
  if (state === "active") return TEXTS.states.active;
  if (state === "awaiting") return TEXTS.states.awaiting;
  if (!human) return TEXTS.states.done;
  return isLast ? TEXTS.states.confirmed : TEXTS.states.validated;
}

/**
 * Hero illustration: a FICTITIOUS prospect goes through the five agents,
 * stops in front of the human validation, and ends on a mandate confirmed by a
 * human. Labelled « Exemple fictif — simulation » with the Simulation badge;
 * it reads no real data and claims no activity.
 *
 * Played ONCE (docs/design-system.md §2.11.5): when it is first at least half
 * on screen, 4.7 s, then it stays on the final state. The server HTML is that
 * final state (every step done): readable without JavaScript, kept under
 * reduced motion, and reached at once when the tab is hidden mid-way.
 */
export function HeroJourney() {
  const figureRef = useRef<HTMLElement>(null);
  const [frame, setFrame] = useState<JourneyFrame>(() => finalFrame(KINDS));
  const [playback, setPlayback] = useState<Playback>("ready");

  useEffect(() => {
    const figure = figureRef.current;
    const reduced = window.matchMedia?.(REDUCED_MOTION);
    if (!figure || reduced?.matches || !("IntersectionObserver" in window)) return;

    const frames = journeySequence(KINDS);
    let timer: number | undefined;
    let started = false;
    let finished = false;

    const finish = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = undefined;
      if (finished) return;
      finished = true;
      setFrame(finalFrame(KINDS));
      setPlayback("played");
    };
    const play = (index: number) => {
      const current = frames[index];
      if (!current) {
        finish();
        return;
      }
      setFrame(current);
      timer = window.setTimeout(() => play(index + 1), current.duration);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (started || !entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= VISIBLE_SHARE)) return;
        started = true;
        observer.disconnect();
        if (document.visibilityState === "hidden") {
          finish();
          return;
        }
        setPlayback("playing");
        play(0);
      },
      { threshold: VISIBLE_SHARE },
    );
    observer.observe(figure);

    // Hidden tab or motion turned off mid-way: jump to the final state, never replay.
    const interrupt = () => {
      if (timer !== undefined && (document.visibilityState === "hidden" || reduced?.matches)) finish();
    };
    document.addEventListener("visibilitychange", interrupt);
    reduced?.addEventListener?.("change", interrupt);
    return () => {
      observer.disconnect();
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", interrupt);
      reduced?.removeEventListener?.("change", interrupt);
    };
  }, []);

  return (
    <figure
      ref={figureRef}
      aria-labelledby="hero-journey-title"
      data-testid="hero-journey"
      data-playback={playback}
      className="rounded-xl border border-line bg-surface/90 p-5 shadow-raised backdrop-blur-sm sm:p-6"
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-3">
        <span id="hero-journey-title" className="text-sm font-semibold text-ink">
          {TEXTS.title}
        </span>
        <span className="flex items-center gap-2" data-testid="hero-journey-label">
          <SimulationBadge />
          <span className="text-xs font-medium text-ink-muted">{TEXTS.badge}</span>
        </span>
      </figcaption>

      <p className="mt-4 rounded-md border border-dashed border-line-strong px-3 py-2 text-xs text-ink-muted">
        {TEXTS.prospect}
      </p>

      <ol className="mt-3 grid gap-1.5">
        {STEPS.map((step, index) => {
          const state = stepState(index, frame);
          const human = step.kind === "human";
          return (
            <li
              key={step.actor}
              data-state={state}
              data-kind={step.kind}
              className={cn(
                "grid grid-cols-[1.75rem_1fr_auto] items-center gap-3 rounded-md border px-3 py-2",
                "transition-[border-color,background-color,opacity] duration-(--duration-base) ease-standard",
                state === "waiting" && "border-transparent opacity-60",
                state === "active" && "border-accent bg-accent-soft",
                state === "awaiting" && "border-accent bg-accent-soft",
                state === "done" && "border-line",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-7 items-center justify-center rounded-full border text-overline font-semibold",
                  human ? "border-accent text-accent-strong" : "border-line-strong text-ink",
                  state === "done" && !human && "border-ink bg-ink text-ink-inverse",
                  state === "done" && human && "bg-accent text-ink-inverse",
                )}
              >
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-ink">
                  {step.actor} <span className="font-normal text-ink-subtle">· {step.role}</span>
                </span>
                <span className="block truncate text-xs text-ink-muted">{step.action}</span>
              </span>
              <span
                className={cn(
                  "text-overline font-semibold whitespace-nowrap",
                  state === "awaiting" ? "text-accent-strong" : state === "waiting" ? "text-ink-subtle" : "text-ink",
                )}
              >
                {stateLabel(state, human, index === STEPS.length - 1)}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="mt-4 text-xs text-ink-subtle">{TEXTS.note}</p>
    </figure>
  );
}
