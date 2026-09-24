import { LANDING_TEXTS } from "@/components/landing-texts";
import { AGENT_GLYPHS, JOURNEY_GLYPHS } from "@/features/agents-ia/components/agent-icons";
import type { AppIconKind } from "@/features/agents-ia/components/icons/AgentAppIcon";
import type { GlyphName } from "@/features/agents-ia/components/icons/glyphs";

/** The seven steps of the landing carousel (Léa → … → mandat), from the texts. */
export const AGENT_STEPS = LANDING_TEXTS.agents.steps;

export type AgentStep = (typeof AGENT_STEPS)[number];
export type AgentStepKey = AgentStep["key"];

/**
 * Same glyphs as the connected space (`agent-icons.ts`): the landing and the
 * product speak the same visual language.
 */
export const STEP_GLYPHS: Readonly<Record<AgentStepKey, GlyphName>> = {
  lea: AGENT_GLYPHS.lea,
  hugo: AGENT_GLYPHS.hugo,
  emma: AGENT_GLYPHS.emma,
  review: JOURNEY_GLYPHS.human,
  louis: AGENT_GLYPHS.louis,
  sarah: AGENT_GLYPHS.sarah,
  mandate: JOURNEY_GLYPHS.mandate,
};

/**
 * Nature of a step, drawn differently (never the same decoration on the seven):
 *   * `agent`      — an AI module: app tile, name, mission;
 *   * `checkpoint` — a person decides between two modules: circle with a
 *                    double contour, the flow stops in front of it;
 *   * `outcome`    — the end of the journey, confirmed by a person: filled
 *                    circle with a double contour, no flow after it.
 */
export type StepVariant = "agent" | "checkpoint" | "outcome";

export function stepVariant(step: Pick<AgentStep, "key" | "kind">): StepVariant {
  if (step.kind === "agent") return "agent";
  return step.key === "mandate" ? "outcome" : "checkpoint";
}

/** Shape of the app icon of each variant (`AgentAppIcon`). */
export const VARIANT_ICON_KIND: Readonly<Record<StepVariant, AppIconKind>> = {
  agent: "agent",
  checkpoint: "human",
  outcome: "outcome",
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

/** « 04 », « 07 »: the position of a step, on two digits for a steady width. */
export function stepNumber(position: number): string {
  return String(position).padStart(2, "0");
}
