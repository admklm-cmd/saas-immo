import type { ComponentType } from "react";

import type { AgentStepKey } from "./agent-steps";
import { EmmaScene } from "./EmmaScene";
import { HugoScene } from "./HugoScene";
import { LeaScene } from "./LeaScene";
import { LouisScene } from "./LouisScene";
import { MandateScene } from "./MandateScene";
import { ReviewScene } from "./ReviewScene";
import { SarahScene } from "./SarahScene";

const SCENES: Readonly<Record<AgentStepKey, ComponentType>> = {
  lea: LeaScene,
  hugo: HugoScene,
  emma: EmmaScene,
  review: ReviewScene,
  louis: LouisScene,
  sarah: SarahScene,
  mandate: MandateScene,
};

/** The illustrated scene of one step (fictitious example, simulation). */
export function StepScene({ stepKey }: { stepKey: AgentStepKey }) {
  const Scene = SCENES[stepKey];
  return <Scene />;
}
