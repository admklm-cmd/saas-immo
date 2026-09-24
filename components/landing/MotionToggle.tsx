"use client";

import { useSyncExternalStore } from "react";

import { LANDING_TEXTS } from "@/components/landing-texts";
import { cn } from "@/components/ui/cn";

import { isLandingPaused, onLandingMotion, setLandingPaused } from "./landing-motion";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function prefersReducedMotion(): boolean {
  return window.matchMedia?.(REDUCED_MOTION).matches ?? false;
}

function subscribeReducedMotion(listener: () => void): () => void {
  const query = window.matchMedia?.(REDUCED_MOTION);
  query?.addEventListener?.("change", listener);
  return () => query?.removeEventListener?.("change", listener);
}

/**
 * Pause of the landing's looping illustrations (WCAG 2.2.2 « Pause, Stop,
 * Hide »): the hero demonstration and the living background. Hidden when
 * nothing moves (no JavaScript, reduced motion): there is nothing to pause.
 */
export function MotionToggle({ className }: { className?: string }) {
  const paused = useSyncExternalStore(onLandingMotion, isLandingPaused, () => false);
  // Server snapshot `true`: nothing is rendered before the browser says motion is welcome.
  const reduced = useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, () => true);

  if (reduced) return null;

  return (
    <button
      type="button"
      aria-pressed={paused}
      onClick={() => setLandingPaused(!paused)}
      data-testid="landing-motion-toggle"
      className={cn(
        "ui-focus inline-flex items-center gap-2 rounded-full border border-line bg-surface/90 px-3 py-1.5",
        "text-xs font-medium text-ink-muted backdrop-blur-sm transition-colors duration-150 hover:text-ink",
        className,
      )}
    >
      <span aria-hidden="true" className="flex h-2.5 w-2.5 items-center justify-center gap-[2px]">
        {paused ? (
          <span className="size-0 border-y-[5px] border-l-[8px] border-y-transparent border-l-current" />
        ) : (
          <>
            <span className="h-full w-[3px] rounded-full bg-current" />
            <span className="h-full w-[3px] rounded-full bg-current" />
          </>
        )}
      </span>
      {paused ? LANDING_TEXTS.motion.resume : LANDING_TEXTS.motion.pause}
    </button>
  );
}
