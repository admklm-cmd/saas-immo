"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { formatDurationMs } from "@/components/format";
import { APP_TEXTS } from "@/components/texts";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

import { AgentRunStepRow } from "./AgentRunStepRow";
import { AgentRunProcessTrack } from "./AgentRunProcessTrack";
import {
  buildReplaySchedule,
  replayLengthMs,
  replaySpeedFactor,
  totalDurationMs,
  type ReplayStep,
} from "./replay";

const TEXTS = APP_TEXTS.replay;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function motionQuery(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  return window.matchMedia(REDUCED_MOTION_QUERY);
}

function subscribeToMotionSetting(onChange: () => void): () => void {
  const query = motionQuery();
  query?.addEventListener("change", onChange);
  return () => query?.removeEventListener("change", onChange);
}

/**
 * Reads the OS setting as an external store rather than as state: no effect has
 * to write it, and a user who changes the setting is served immediately.
 */
function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeToMotionSetting,
    () => motionQuery()?.matches ?? false,
    () => false,
  );
}

export type AgentRunReplayProps = {
  steps: readonly ReplayStep[];
  /**
   * Plays the steps one by one on mount. Set to false to list them at once
   * (a past run the user only wants to read).
   */
  autoPlay?: boolean;
  testId?: string;
};

/**
 * Replays an execution step by step, at the pace it really took.
 *
 * What this component may NOT do (CLAUDE.md — nothing simulated is passed off
 * as real, and nothing real is dressed up): invent a delay, invent a progress
 * bar, round a duration to make it look better. Every delay scheduled below
 * comes from `durationMs`, measured server-side and recomputed by the database.
 *
 * What it may do, because both are announced on screen: apply a slowdown factor
 * when the whole run is too short to be read, and skip to the full list on
 * demand. `prefers-reduced-motion` is honoured by showing everything at once,
 * with no animation and no timer at all.
 */
export function AgentRunReplay({ steps, autoPlay = true, testId }: AgentRunReplayProps) {
  const measuredMs = totalDurationMs(steps);
  const factor = replaySpeedFactor(measuredMs);
  const reducedMotion = useReducedMotion();

  const [mode, setMode] = useState<"play" | "all">(autoPlay ? "play" : "all");
  const [doneCount, setDoneCount] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [announced, setAnnounced] = useState("");
  const [replayCycle, setReplayCycle] = useState(0);

  // Kept in a ref so a re-render of the parent never restarts a replay in
  // progress: the schedule is built once, from the steps of this run.
  const stepsRef = useRef(steps);
  useEffect(() => {
    stepsRef.current = steps;
  }, [steps]);

  const animating = mode === "play" && !reducedMotion && steps.length > 0;

  useEffect(() => {
    if (!animating) return;
    const current = stepsRef.current;

    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const tick of buildReplaySchedule(current, factor)) {
      timers.push(setTimeout(() => setActiveIndex(tick.index), tick.startAt));
      timers.push(
        setTimeout(() => {
          setDoneCount(tick.index + 1);
          setActiveIndex(null);
          const step = current[tick.index];
          if (step) {
            setAnnounced(
              TEXTS.stepAnnounce(tick.index + 1, current.length, step.phaseLabel, step.statusLabel),
            );
          }
        }, tick.endAt),
      );
    }
    // End of the replay: the list is complete, the controls go back to rest.
    timers.push(setTimeout(() => setMode("all"), replayLengthMs(current, factor)));

    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, [animating, factor]);

  const showEverything = useCallback(() => {
    setMode("all");
    setActiveIndex(null);
    setAnnounced(TEXTS.finished);
  }, []);

  const restart = useCallback(() => {
    setDoneCount(0);
    setActiveIndex(null);
    setAnnounced("");
    setReplayCycle((cycle) => cycle + 1);
    setMode("play");
  }, []);

  if (steps.length === 0) {
    return (
      <p data-testid={testId} className="text-sm text-ink-muted">
        {TEXTS.empty}
      </p>
    );
  }

  // Outside of an animation (finished, skipped, or reduced motion) the complete
  // list is shown: the information is never hidden behind the animation.
  const visible = animating
    ? steps
        .map((step, index) => ({ step, index }))
        .filter(({ index }) => index < doneCount || index === activeIndex)
    : steps.map((step, index) => ({ step, index }));

  return (
    <div data-testid={testId}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line pb-4">
        <Badge tone={factor > 1 ? "solid" : "outline"} title={factor > 1 ? TEXTS.speedFactorHint : undefined}>
          {factor > 1 ? TEXTS.speedFactor(factor) : TEXTS.realSpeed}
        </Badge>
        <span className="text-xs text-ink-muted">
          {TEXTS.totalMeasured} :{" "}
          <span className="tabular-nums text-ink">{formatDurationMs(measuredMs)}</span>
        </span>
        <div className="ml-auto flex items-center gap-2">
          {animating ? (
            <Button variant="secondary" size="sm" onClick={showEverything} data-testid="replay-show-all">
              {TEXTS.showAll}
            </Button>
          ) : reducedMotion ? null : (
            <Button variant="ghost" size="sm" onClick={restart} data-testid="replay-restart">
              {TEXTS.replayAgain}
            </Button>
          )}
        </div>
      </div>

      {factor > 1 ? <p className="pt-3 text-xs text-ink-subtle">{TEXTS.speedFactorHint}</p> : null}

      <AgentRunProcessTrack
        steps={steps}
        activeIndex={activeIndex}
        doneCount={doneCount}
        animating={animating}
        replayDurationMs={replayLengthMs(steps, factor)}
        speedFactor={factor}
        replayCycle={replayCycle}
      />

      <ol className="mt-4 flex flex-col" aria-busy={animating || undefined} data-testid="replay-steps">
        {visible.map(({ step, index }) => (
          <AgentRunStepRow
            key={step.key}
            step={step}
            position={index + 1}
            total={steps.length}
            state={index === activeIndex ? "active" : "done"}
            withRail={index < steps.length - 1}
          />
        ))}
      </ol>

      <p aria-live="polite" className="sr-only">
        {animating ? announced : TEXTS.finished}
      </p>

      <p className="mt-2 border-t border-line pt-4 text-xs text-ink-muted">{TEXTS.authorLegend}</p>
    </div>
  );
}
