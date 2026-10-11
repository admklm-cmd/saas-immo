import type { ReactNode } from "react";

import { LANDING_TEXTS } from "@/components/landing-texts";
import { SimulationBadge } from "@/components/ui/SimulationBadge";

import type { AgentStepKey } from "./agent-steps";
import styles from "./agents.module.css";

const TEXTS = LANDING_TEXTS.agents.carousel;

export type SceneFrameProps = {
  stepKey: AgentStepKey;
  title: string;
  children: ReactNode;
};

/**
 * Window of the opened application: the Simulation badge and « Exemple fictif
 * — simulation » belong to the frame, so no scene can be shown without them.
 * White card on the white page (one hairline, a very light shadow). Its opening is driven by the
 * stage (`data-opening`), never on the first render.
 */
export function SceneFrame({ stepKey, title, children }: SceneFrameProps) {
  const titleId = `agents-scene-title-${stepKey}`;
  return (
    <figure aria-labelledby={titleId} data-testid="agent-scene" data-step={stepKey} className={styles.window}>
      <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span id={titleId} className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-ink">
          {title}
        </span>
        <span className="flex items-center gap-2" data-testid="agent-scene-label">
          <SimulationBadge />
          <span className="text-xs font-medium text-ink-muted">{TEXTS.sceneBadge}</span>
        </span>
      </figcaption>
      <div className={styles.sceneBody}>{children}</div>
    </figure>
  );
}
