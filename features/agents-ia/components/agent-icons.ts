import type { ComponentType } from "react";
import {
  CalendarIcon,
  ChatBubbleIcon,
  ClockIcon,
  EnterIcon,
  IdCardIcon,
  MagnifyingGlassIcon,
  Pencil2Icon,
  PersonIcon,
  ReaderIcon,
} from "@radix-ui/react-icons";

import type { AiAgentName } from "@/features/contacts/types";

type IconComponent = ComponentType<{ className?: string; width?: number | string; height?: number | string }>;

/**
 * One linear symbol per agent, from the same family (Radix icons, 15 px grid,
 * 1 px stroke) — never an emoji. Each says the job, not a personality:
 * Léa takes a lead in, Hugo examines, Emma writes, Louis times the visit,
 * Sarah reads the report and follows through.
 */
export const AGENT_ICONS: Readonly<Record<AiAgentName, IconComponent>> = {
  lea: EnterIcon,
  hugo: MagnifyingGlassIcon,
  emma: ChatBubbleIcon,
  louis: ClockIcon,
  sarah: ReaderIcon,
};

/** Symbols of the non-agent stages of a dossier, same family. */
export const JOURNEY_ICONS = {
  prospect: IdCardIcon,
  human: PersonIcon,
  appointment: CalendarIcon,
  mandate: Pencil2Icon,
} as const satisfies Record<string, IconComponent>;
