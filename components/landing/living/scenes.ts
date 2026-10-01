/**
 * Sections of the landing that drive the network background: the section
 * crossing the middle band of the viewport is the current scene, and its
 * first entry plays one bounded sequence of impulses (never `hero`, which
 * has the arrival cascade). Docs: docs/design-system.md §2.11.4.
 */

export const LIVING_SCENES = ["hero", "probleme", "solution", "agents", "controle", "resultat", "final"] as const;
export type LivingScene = (typeof LIVING_SCENES)[number];

export function isLivingScene(value: string | undefined | null): value is LivingScene {
  return (LIVING_SCENES as readonly string[]).includes(value ?? "");
}
