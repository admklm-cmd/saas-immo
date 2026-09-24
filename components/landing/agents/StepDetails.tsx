import type { Ref } from "react";

import { LANDING_TEXTS } from "@/components/landing-texts";
import { AgentAppIcon } from "@/features/agents-ia/components/icons/AgentAppIcon";
import { Glyph } from "@/features/agents-ia/components/icons/Glyph";

import { STEP_GLYPHS, stepNumber, stepVariant, VARIANT_ICON_KIND, type AgentStep } from "./agent-steps";
import styles from "./agents.module.css";

const TEXTS = LANDING_TEXTS.agents.carousel;

export type StepDetailsProps = {
  step: AgentStep;
  /** 1-based position of the step, and the number of steps. */
  position: number;
  count: number;
  /** The tile of the header: the target of the « open the app » transition. */
  iconRef?: Ref<HTMLSpanElement>;
};

/** Header of the opened application: who the step is, what it does, where it stops. */
export function StepDetails({ step, position, count, iconRef }: StepDetailsProps) {
  const variant = stepVariant(step);

  return (
    <div className={styles.details}>
      <span ref={iconRef} className={styles.appIcon}>
        <AgentAppIcon glyph={STEP_GLYPHS[step.key]} kind={VARIANT_ICON_KIND[variant]} size="xl" surface="dark" />
      </span>
      <p className={styles.kicker}>
        {TEXTS.stepPrefix} {stepNumber(position)} / {stepNumber(count)} ·{" "}
        {variant === "agent" ? TEXTS.kinds.agent : variant === "checkpoint" ? TEXTS.kinds.checkpoint : TEXTS.kinds.outcome}
      </p>
      <h3 className={styles.title} data-testid="agent-step-title">
        {step.name}
      </h3>
      <p className={styles.subtitle}>{step.role}</p>

      <dl className={styles.facts}>
        <div>
          <dt className={styles.factLabel}>{TEXTS.missionLabel}</dt>
          <dd className={styles.statement}>{step.action}</dd>
        </div>
        <div>
          <dt className={styles.factLabel}>{TEXTS.boundaryLabel}</dt>
          <dd className={styles.boundary}>
            <Glyph name="lock" width={14} />
            {step.boundary}
          </dd>
        </div>
      </dl>
    </div>
  );
}
