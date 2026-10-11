/**
 * The sections of the landing, in order. Each `<section>` carries its name in
 * `data-living-scene` (docs/design-system.md §2.11.4): the tests and the
 * replay use it to find a section. The background no longer follows them.
 */

export const LIVING_SCENES = ["hero", "probleme", "solution", "agents", "controle", "resultat", "final"] as const;
export type LivingScene = (typeof LIVING_SCENES)[number];
