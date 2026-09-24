import type { CSSProperties } from "react";

import { formatDurationMs } from "@/components/format";
import { APP_TEXTS, RUN_OUTCOME_LABELS } from "@/components/texts";
import type { AgentRunStatus } from "@/lib/agents/messages";

import { PHASE_ICONS } from "./phase-icons";
import { buildReplaySchedule, replaySpeedFactor, totalDurationMs, type ReplayStep } from "./replay";
import styles from "./AgentRunProcessPreview.module.css";

const TEXTS = APP_TEXTS.runProcess;
const REPLAY = APP_TEXTS.replay;

export type AgentRunProcessPreviewProps = {
  steps: readonly ReplayStep[];
  /** Outcome of the whole run, as journaled by the server. */
  runStatus: AgentRunStatus;
};

/**
 * Compact process of one execution, rendered on the server under a run listed
 * on « Agents IA » (inside a folded `<details>`).
 *
 * Honesty rules, the same as the full replay (docs/design-system.md §3.1):
 *   * the nodes are the steps really recorded, in order — nothing is added;
 *   * when the disclosure opens, CSS replays them with the MEASURED durations
 *     (`buildReplaySchedule`), slowed down by the announced factor only;
 *   * a run still « en cours » is shown as recorded so far, with no motion, no
 *     progress and no step assumed after the last one;
 *   * reduced motion: no animation, the final state at once.
 * Every piece of information is written (phase, status for screen readers,
 * duration, stop reason): the motion only emphasises it.
 */
export function AgentRunProcessPreview({ steps, runStatus }: AgentRunProcessPreviewProps) {
  if (steps.length === 0) {
    return (
      <p className="text-sm text-ink-muted" data-testid="run-process-preview" data-run-status={runStatus}>
        {REPLAY.empty}
      </p>
    );
  }

  const inProgress = runStatus === "running";
  const measuredMs = totalDurationMs(steps);
  const factor = replaySpeedFactor(measuredMs);
  const ticks = buildReplaySchedule(steps, factor);
  const stop = [...steps].reverse().find((step) => step.status === "blocked" || step.status === "failed");

  return (
    <div
      className={styles.preview}
      data-testid="run-process-preview"
      data-run-status={runStatus}
      data-replay={inProgress ? "off" : "on"}
    >
      <p className={styles.meta}>
        <span>{TEXTS.stepsCount(steps.length)}</span>
        <span aria-hidden="true">·</span>
        <span>
          {REPLAY.totalMeasured} : <span className="tabular-nums text-ink">{formatDurationMs(measuredMs)}</span>
        </span>
        {inProgress ? null : (
          <>
            <span aria-hidden="true">·</span>
            <span title={factor > 1 ? REPLAY.speedFactorHint : undefined}>
              {factor > 1 ? REPLAY.speedFactor(factor) : REPLAY.realSpeed}
            </span>
          </>
        )}
      </p>

      <div className={styles.scroller}>
        <ol
          className={styles.track}
          aria-label={TEXTS.listLabel}
          style={{ "--step-count": steps.length } as CSSProperties}
        >
          {steps.map((step, index) => {
            const Icon = PHASE_ICONS[step.phase];
            const tick = ticks[index];
            const timing = {
              "--at": `${tick?.startAt ?? 0}ms`,
              "--dur": `${Math.max(0, (tick?.endAt ?? 0) - (tick?.startAt ?? 0))}ms`,
            } as CSSProperties;

            return (
              <li
                key={step.key}
                className={styles.node}
                data-status={step.status}
                data-testid="run-process-node"
                style={timing}
              >
                {index < steps.length - 1 ? (
                  <span className={styles.segment} aria-hidden="true">
                    <span className={styles.fill} />
                    <span className={styles.signalTravel}>
                      <span className={styles.signal} />
                    </span>
                  </span>
                ) : null}
                <span className={styles.core} aria-hidden="true">
                  <span className={styles.orb} />
                  <Icon className={styles.icon} width={15} height={15} />
                </span>
                <span className={styles.label}>
                  <span className="sr-only">
                    {TEXTS.stepSr(index + 1, steps.length, step.phaseLabel, step.statusLabel)}
                  </span>
                  <span aria-hidden="true">{step.phaseLabel}</span>
                </span>
                <span className={styles.duration}>{formatDurationMs(step.durationMs)}</span>
              </li>
            );
          })}
        </ol>
      </div>

      <p className={styles.outcome} data-testid="run-process-outcome">
        {inProgress ? (
          REPLAY.inProgressNote
        ) : stop ? (
          <>
            <span className="font-semibold text-ink">{TEXTS.stoppedAt(stop.phaseLabel)}</span>
            {" — "}
            <span className="font-medium text-ink">
              {stop.status === "blocked" ? APP_TEXTS.guardRail.reason : RUN_OUTCOME_LABELS.failed} :{" "}
            </span>
            {stop.label}
          </>
        ) : (
          TEXTS.completed
        )}
      </p>
    </div>
  );
}
