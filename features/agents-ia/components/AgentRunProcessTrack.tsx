import type { CSSProperties, ComponentType } from "react";
import {
  ArchiveIcon,
  CheckCircledIcon,
  CodeIcon,
  FileTextIcon,
  LockClosedIcon,
  MagicWandIcon,
  TargetIcon,
} from "@radix-ui/react-icons";

import { APP_TEXTS } from "@/components/texts";
import type { AgentRunPhase } from "@/lib/agents/steps";

import type { ReplayStep } from "./replay";
import styles from "./AgentRunProcessTrack.module.css";

const TEXTS = APP_TEXTS.replay;

const PHASE_ICONS: Record<AgentRunPhase, ComponentType<{ className?: string; width?: number; height?: number }>> = {
  guardrails: LockClosedIcon,
  context_loaded: FileTextIcon,
  prompt_built: CodeIcon,
  ai_call: MagicWandIcon,
  output_validated: CheckCircledIcon,
  decision: TargetIcon,
  persisted: ArchiveIcon,
};

type ProcessState = "pending" | "active" | "done";

export type AgentRunProcessTrackProps = {
  steps: readonly ReplayStep[];
  activeIndex: number | null;
  doneCount: number;
  animating: boolean;
  replayDurationMs: number;
  speedFactor: number;
  replayCycle: number;
};

/**
 * Compact visual twin of the detailed replay list.
 *
 * It never creates business information or a decorative rhythm: nodes mirror
 * the journal and both moving indicators use the exact replay schedule.
 * The detailed, accessible list remains the source of readable information.
 */
export function AgentRunProcessTrack({
  steps,
  activeIndex,
  doneCount,
  animating,
  replayDurationMs,
  speedFactor,
  replayCycle,
}: AgentRunProcessTrackProps) {
  const lastIndex = Math.max(steps.length - 1, 0);
  const activeReplayDurationMs =
    activeIndex === null ? 0 : Math.max(0, (steps[activeIndex]?.durationMs ?? 0) * speedFactor);
  const signalIndex = animating
    ? activeIndex === null
      ? Math.min(doneCount, lastIndex)
      : Math.min(activeIndex + 1, lastIndex)
    : lastIndex;
  const signalRatio = lastIndex === 0 ? 0 : signalIndex / lastIndex;

  const systemStyle = {
    "--step-count": steps.length,
    "--signal-ratio": signalRatio,
    "--signal-duration": `${activeReplayDurationMs}ms`,
  } as CSSProperties;

  const progressStyle = {
    "--replay-duration": `${replayDurationMs}ms`,
  } as CSSProperties;

  return (
    <section className={styles.process} aria-label={TEXTS.flowTitle} data-testid="replay-process-track">
      <div className={styles.heading}>
        <div>
          <h3 className={styles.title}>{TEXTS.flowTitle}</h3>
          <p className={styles.subtitle}>{TEXTS.flowSubtitle}</p>
        </div>
        <span className={styles.state}>{animating ? TEXTS.playing : TEXTS.finished}</span>
      </div>

      <div className={styles.scroller}>
        <div className={styles.system} style={systemStyle} aria-hidden="true">
          <div className={styles.rail}>
            <span className={styles.signalTravel}>
              <span className={styles.signal} />
            </span>
          </div>

          {steps.map((step, index) => {
            const state: ProcessState = animating
              ? index === activeIndex
                ? "active"
                : index < doneCount
                  ? "done"
                  : "pending"
              : "done";
            const Icon = PHASE_ICONS[step.phase];

            return (
              <div
                key={step.key}
                className={styles.node}
                data-state={state}
                data-status={step.status}
                data-testid="replay-process-node"
              >
                <span className={styles.nodeCore}>
                  <span className={styles.nodeOrb} />
                  <Icon className={styles.nodeIcon} width={17} height={17} />
                </span>
                <span className={styles.nodeLabel}>{step.phaseLabel}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.activity}>
        <div className={styles.activityMeta}>
          <span>{animating ? TEXTS.activityRunning : TEXTS.activityComplete}</span>
          <span>{TEXTS.measuredProgress}</span>
        </div>
        <div
          className={styles.activityBar}
          role="progressbar"
          aria-label={TEXTS.measuredProgress}
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={animating ? doneCount : steps.length}
        >
          <span
            key={`${replayCycle}-${animating ? "running" : "complete"}`}
            className={animating && replayDurationMs > 0 ? styles.progressRunning : styles.progressComplete}
            style={progressStyle}
          />
        </div>
      </div>
    </section>
  );
}
