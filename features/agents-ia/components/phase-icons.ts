import type { ComponentType } from "react";

import { iconComponent } from "@/components/icons/Icon";
import type { AgentRunPhase } from "@/lib/agents/steps";

type IconComponent = ComponentType<{
  className?: string;
  width?: number | string;
  height?: number | string;
}>;

/**
 * One icon of the family per recorded phase. Shared by the full process track
 * of the replay and by the compact preview listed on « Agents IA », so a phase
 * reads the same everywhere.
 */
export const PHASE_ICONS: Readonly<Record<AgentRunPhase, IconComponent>> = {
  guardrails: iconComponent("lock"),
  context_loaded: iconComponent("document"),
  prompt_built: iconComponent("code"),
  ai_call: iconComponent("aiAgent"),
  output_validated: iconComponent("checkCircle"),
  decision: iconComponent("priority"),
  persisted: iconComponent("archive"),
};
