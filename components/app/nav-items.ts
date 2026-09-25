import { APP_TEXTS } from "@/components/texts";
import type { GlyphName } from "@/features/agents-ia/components/icons/glyphs";

const TEXTS = APP_TEXTS.nav;

export type NavItem = { href: string; label: string; glyph: GlyphName };

export type NavGroup = {
  id: "pilotage" | "agents" | "settings";
  label: string;
  /** Visible group title. The last group (one entry) is only set apart by a divider. */
  showLabel: boolean;
  items: readonly NavItem[];
};

/**
 * Primary navigation of the signed-in space, in three groups
 * (docs/design-system.md §2.10). Same routes as before the grouping: no link lost.
 *
 * Glyphs come from the house family (`features/agents-ia/components/icons`):
 * an agent's own symbol for the screen where that agent's work is handled.
 */
export const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: "pilotage",
    label: TEXTS.groupPilotage,
    showLabel: true,
    items: [
      { href: "/dashboard", label: TEXTS.dashboard, glyph: "dashboard" },
      { href: "/contacts", label: TEXTS.contacts, glyph: "prospect" },
      { href: "/pipeline", label: TEXTS.pipeline, glyph: "pipeline" },
      { href: "/taches", label: TEXTS.tasks, glyph: "tasks" },
      { href: "/rendez-vous", label: TEXTS.appointments, glyph: "appointment" },
    ],
  },
  {
    id: "agents",
    label: TEXTS.groupAgents,
    showLabel: true,
    // Order of the real work: a lead arrives (Léa), a first message waits for a
    // human, Emma prepares the follow-ups, Sarah follows the appointments.
    items: [
      { href: "/agents-ia", label: TEXTS.agentsOverview, glyph: "network" },
      { href: "/agents-ia/leads-entrants", label: TEXTS.agentsLeads, glyph: "lea" },
      { href: "/agents-ia/a-valider", label: TEXTS.agentsToValidate, glyph: "human" },
      { href: "/agents-ia/relances", label: TEXTS.agentsFollowUps, glyph: "emma" },
      { href: "/agents-ia/suivi-rendez-vous", label: TEXTS.agentsFollowThrough, glyph: "sarah" },
    ],
  },
  {
    id: "settings",
    label: TEXTS.groupSettings,
    showLabel: false,
    items: [{ href: "/parametres", label: TEXTS.settings, glyph: "settings" }],
  },
];

export const NAV_ITEMS: readonly NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

/**
 * Whether `href` is the current entry for `pathname`. Exactly one entry is
 * current on every screen of the signed-in space.
 *
 * « Vue d'ensemble » (`/agents-ia`) owns the replay of one execution, but none
 * of the sub-screens that have an entry of their own: otherwise two entries
 * would carry `aria-current` at the same time.
 */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/agents-ia") {
    return pathname === href || pathname.startsWith("/agents-ia/executions");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
