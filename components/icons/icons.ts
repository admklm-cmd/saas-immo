import { AGENT_ICON_DEFINITIONS } from "./definitions/agents";
import { BOARD_SIGNAL_ICONS } from "./definitions/board-signals";
import { BOARD_WORK_ICONS } from "./definitions/board-work";
import { UTILITY_ICONS } from "./definitions/utility";
import type { IconDefinition } from "./icon-types";

/** The single grid of the family: every icon scales from it (up to 1024 × 1024). */
export const ICON_VIEWBOX = "0 0 24 24";

export const ICONS = {
  ...BOARD_WORK_ICONS,
  ...BOARD_SIGNAL_ICONS,
  ...AGENT_ICON_DEFINITIONS,
  ...UTILITY_ICONS,
} as const satisfies Record<string, IconDefinition>;

export type IconName = keyof typeof ICONS;

export const ICON_NAMES = Object.keys(ICONS) as IconName[];

/** The 24 icons of the reference boards, in their order. */
export const BOARD_ICON_NAMES = [
  ...(Object.keys(BOARD_WORK_ICONS) as (keyof typeof BOARD_WORK_ICONS)[]),
  ...(Object.keys(BOARD_SIGNAL_ICONS) as (keyof typeof BOARD_SIGNAL_ICONS)[]),
] as const;

/** The five agents, then the other stages of a dossier. */
export const AGENT_ICON_NAMES = Object.keys(AGENT_ICON_DEFINITIONS) as (keyof typeof AGENT_ICON_DEFINITIONS)[];

export const UTILITY_ICON_NAMES = Object.keys(UTILITY_ICONS) as (keyof typeof UTILITY_ICONS)[];

/** The only icons allowed a red accent (always next to written words). */
export const DANGER_ICON_NAMES: readonly IconName[] = ["alert"];
