import type { ComponentType } from "react";

import { iconComponent } from "@/components/icons/Icon";
import type { IconName } from "@/components/icons/icons";
import type { AiAgentName } from "@/features/contacts/types";

type IconComponent = ComponentType<{
  className?: string;
  width?: number | string;
  height?: number | string;
}>;

/**
 * Icon of each agent, from the Ascend family (`components/icons`: one 24 grid,
 * filled ink shapes, one cobalt accent) — never an emoji. Each says the job,
 * not a personality: Léa takes a contact in, Hugo examines the property,
 * Emma follows up, Louis proposes a slot, Sarah moves the dossier forward.
 */
export const AGENT_GLYPHS: Readonly<Record<AiAgentName, IconName>> = {
  lea: "lea",
  hugo: "hugo",
  emma: "emma",
  louis: "louis",
  sarah: "sarah",
};

/** Icons of the non-agent stages of a dossier, same family. */
export const JOURNEY_GLYPHS = {
  prospect: "prospect",
  human: "humanValidation",
  appointment: "appointment",
  mandate: "mandate",
} as const satisfies Record<string, IconName>;

/** The same icons as icon components (rail nodes and other icon maps). */
export const AGENT_ICONS: Readonly<Record<AiAgentName, IconComponent>> = {
  lea: iconComponent(AGENT_GLYPHS.lea),
  hugo: iconComponent(AGENT_GLYPHS.hugo),
  emma: iconComponent(AGENT_GLYPHS.emma),
  louis: iconComponent(AGENT_GLYPHS.louis),
  sarah: iconComponent(AGENT_GLYPHS.sarah),
};

export const JOURNEY_ICONS = {
  prospect: iconComponent(JOURNEY_GLYPHS.prospect),
  human: iconComponent(JOURNEY_GLYPHS.human),
  appointment: iconComponent(JOURNEY_GLYPHS.appointment),
  mandate: iconComponent(JOURNEY_GLYPHS.mandate),
} as const satisfies Record<string, IconComponent>;
