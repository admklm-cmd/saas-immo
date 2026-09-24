import type { ComponentType } from "react";

import type { AiAgentName } from "@/features/contacts/types";

import { glyphIcon } from "./icons/Glyph";
import type { GlyphName } from "./icons/glyphs";

type IconComponent = ComponentType<{ className?: string; width?: number | string; height?: number | string }>;

/**
 * Glyph of each agent, from the custom Ascend family (`icons/glyphs.ts`: one
 * 24 grid, one stroke weight, round caps) — never an emoji. Each says the job,
 * not a personality: Léa takes a contact in, Hugo examines and qualifies, Emma
 * writes, Louis proposes a slot, Sarah moves the dossier forward.
 */
export const AGENT_GLYPHS: Readonly<Record<AiAgentName, GlyphName>> = {
  lea: "lea",
  hugo: "hugo",
  emma: "emma",
  louis: "louis",
  sarah: "sarah",
};

/** Glyphs of the non-agent stages of a dossier, same family. */
export const JOURNEY_GLYPHS = {
  prospect: "prospect",
  human: "human",
  appointment: "appointment",
  mandate: "mandate",
} as const satisfies Record<string, GlyphName>;

/** The same glyphs as icon components (rail nodes and other icon maps). */
export const AGENT_ICONS: Readonly<Record<AiAgentName, IconComponent>> = {
  lea: glyphIcon(AGENT_GLYPHS.lea),
  hugo: glyphIcon(AGENT_GLYPHS.hugo),
  emma: glyphIcon(AGENT_GLYPHS.emma),
  louis: glyphIcon(AGENT_GLYPHS.louis),
  sarah: glyphIcon(AGENT_GLYPHS.sarah),
};

export const JOURNEY_ICONS = {
  prospect: glyphIcon(JOURNEY_GLYPHS.prospect),
  human: glyphIcon(JOURNEY_GLYPHS.human),
  appointment: glyphIcon(JOURNEY_GLYPHS.appointment),
  mandate: glyphIcon(JOURNEY_GLYPHS.mandate),
} as const satisfies Record<string, IconComponent>;
