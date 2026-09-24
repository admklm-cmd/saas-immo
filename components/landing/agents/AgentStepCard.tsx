import type { KeyboardEvent, Ref } from "react";

import { LANDING_TEXTS } from "@/components/landing-texts";
import { cn } from "@/components/ui/cn";
import { AgentAppIcon } from "@/features/agents-ia/components/icons/AgentAppIcon";

import { STEP_GLYPHS, STEP_PANEL_ID, stepTabId, stepVariant, VARIANT_ICON_KIND, type AgentStep } from "./agent-steps";
import styles from "./agents.module.css";

const TEXTS = LANDING_TEXTS.agents.carousel;

export type AgentStepCardProps = {
  step: AgentStep;
  selected: boolean;
  /** Part of the flow already travelled: the line into / out of this module is lit. */
  flowInLit: boolean;
  flowOutLit: boolean;
  first: boolean;
  last: boolean;
  onSelect: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  ref?: Ref<HTMLButtonElement>;
};

/**
 * One module of the OS row — a tab of the WAI-ARIA tabs pattern (roving
 * tabindex). No border: a plate appears under the open module, its icon lifts
 * with a thin cobalt ring and plays its motion, and its mission appears.
 *
 * The three natures are drawn differently (`stepVariant`): an AI agent is an
 * app tile; the human validation is a checkpoint (circle with a double
 * contour, the flow stops in front of it, « Contrôle humain »); the mandate is
 * the outcome (filled circle, « Aboutissement », no flow after it).
 */
export function AgentStepCard({
  step,
  selected,
  flowInLit,
  flowOutLit,
  first,
  last,
  onSelect,
  onKeyDown,
  ref,
}: AgentStepCardProps) {
  const variant = stepVariant(step);
  const kindLabel =
    variant === "agent" ? null : variant === "checkpoint" ? TEXTS.kinds.checkpoint : TEXTS.kinds.outcome;

  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      id={stepTabId(step.key)}
      aria-selected={selected}
      aria-controls={STEP_PANEL_ID}
      tabIndex={selected ? 0 : -1}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      data-testid="agent-step-card"
      data-step={step.key}
      data-kind={step.kind}
      data-variant={variant}
      data-snap=""
      className={styles.module}
    >
      <span className={styles.iconRow} aria-hidden="true">
        {first ? null : <span className={styles.flowIn} data-lit={flowInLit || undefined} />}
        <span data-step-icon="">
          <AgentAppIcon
            glyph={STEP_GLYPHS[step.key]}
            kind={VARIANT_ICON_KIND[variant]}
            size="lg"
            surface="dark"
            state={selected ? "active" : "idle"}
            testId="step-app-icon"
          />
        </span>
        {last ? null : <span className={styles.flowOut} data-lit={flowOutLit || undefined} />}
      </span>

      {/* Read first by assistive technology: what kind of step this is. */}
      {variant === "agent" ? <span className="sr-only">{TEXTS.kinds.agent} </span> : null}
      <span className={styles.name}>{step.name}</span>
      {/* A human step says what it is (« Contrôle humain », « Aboutissement »);
          the panel names who decides. */}
      <span className={styles.role} data-emphasis={kindLabel ? "" : undefined}>
        {kindLabel ?? step.role}
      </span>
      {/* The panel says it again in full: the preview is not read twice. */}
      <span className={cn(styles.mission)} aria-hidden="true">
        {step.action}
      </span>
    </button>
  );
}
