import type { ComponentType } from "react";

import { LANDING_TEXTS } from "@/components/landing-texts";
import { AGENT_ICONS, JOURNEY_ICONS } from "@/features/agents-ia/components/agent-icons";

type IconComponent = ComponentType<{ className?: string; width?: number | string; height?: number | string }>;

/** The seven steps of the landing carousel (Léa → … → mandat), from the texts. */
export const AGENT_STEPS = LANDING_TEXTS.agents.steps;

export type AgentStep = (typeof AGENT_STEPS)[number];
export type AgentStepKey = AgentStep["key"];

/**
 * Same linear symbols as the connected space (`agent-icons.ts`): the landing
 * and the product speak the same visual language.
 */
export const STEP_ICONS: Readonly<Record<AgentStepKey, IconComponent>> = {
  lea: AGENT_ICONS.lea,
  hugo: AGENT_ICONS.hugo,
  emma: AGENT_ICONS.emma,
  review: JOURNEY_ICONS.human,
  louis: AGENT_ICONS.louis,
  sarah: AGENT_ICONS.sarah,
  mandate: JOURNEY_ICONS.mandate,
};

/** Id of the tab of a step (the panel is labelled by the selected one). */
export function stepTabId(key: AgentStepKey): string {
  return `agents-tab-${key}`;
}

export const STEP_PANEL_ID = "agents-panel";

/** Index of the next selected step for a key of the tab list; `null` when the key does nothing. */
export function nextStepIndex(key: string, current: number, count: number): number | null {
  switch (key) {
    case "ArrowRight":
      return Math.min(current + 1, count - 1);
    case "ArrowLeft":
      return Math.max(current - 1, 0);
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}
