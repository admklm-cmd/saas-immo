import type { ReactNode } from "react";

import { cn } from "@/components/ui/cn";

import type { ProcessStep } from "../process-carousel";
import styles from "./frame.module.css";

/** `idle`: never played (final state shown); `playing`: once, now; `done`: played, final state. */
export type VisualState = "idle" | "playing" | "done";

export type VisualFrameProps = {
  step: ProcessStep;
  state: VisualState;
  /**
   * The armed first card, before it is seen: its animations are mounted at
   * their first frame and paused, so it plays from the start once in view.
   */
  paused?: boolean;
  className?: string;
  children: ReactNode;
};

/**
 * The animated window of a process card (docs/design-system.md §2.11.8.5): a
 * dark inset panel, a status pill on top (« …ing » while it plays, the result
 * after, crossfaded by CSS) and the drawing of the step. Decorative
 * (`aria-hidden`): the title and the paragraph of the card carry the meaning.
 * Every animation is CSS, filled backwards only, under `[data-run]`; the
 * default styles ARE the final state (server HTML, reduced motion).
 */
export function VisualFrame({ step, state, paused = false, className, children }: VisualFrameProps) {
  const run = state === "playing" || paused;
  return (
    <div
      className={cn(styles.visual, className)}
      aria-hidden="true"
      data-testid="process-visual"
      data-step={step.key}
      data-visual-state={state}
      data-run={run ? "" : undefined}
      data-paused={paused ? "" : undefined}
    >
      <span className={styles.status}>
        <span className={styles.statusPending}>{step.pending}</span>
        <span className={styles.statusDone}>{step.done}</span>
      </span>
      {children}
    </div>
  );
}
