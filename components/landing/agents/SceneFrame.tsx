import type { ReactNode } from "react";

import { LANDING_TEXTS } from "@/components/landing-texts";
import { SimulationBadge } from "@/components/ui/SimulationBadge";

import type { AgentStepKey } from "./agent-steps";

const TEXTS = LANDING_TEXTS.agents.carousel;

export type SceneFrameProps = {
  stepKey: AgentStepKey;
  title: string;
  children: ReactNode;
};

/**
 * Frame of every scene: the Simulation badge and « Exemple fictif —
 * simulation » belong to the frame, so no scene can be shown without them.
 * The content enters once (`stagger`), and is still under reduced motion.
 */
export function SceneFrame({ stepKey, title, children }: SceneFrameProps) {
  const titleId = `agents-scene-title-${stepKey}`;
  return (
    <figure
      aria-labelledby={titleId}
      data-testid="agent-scene"
      data-step={stepKey}
      className="flex min-w-0 flex-col rounded-lg border border-line bg-surface-muted p-5 sm:p-6"
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-3">
        <span id={titleId} className="text-sm font-semibold text-ink">
          {title}
        </span>
        <span className="flex items-center gap-2" data-testid="agent-scene-label">
          <SimulationBadge />
          <span className="text-xs font-medium text-ink-muted">{TEXTS.sceneBadge}</span>
        </span>
      </figcaption>
      <div className="stagger mt-5 grid gap-3">{children}</div>
    </figure>
  );
}
