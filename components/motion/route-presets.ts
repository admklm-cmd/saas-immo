import type { ParticlePreset } from "./shapes";

/**
 * Decorative preset of each app route (spec §3). Most specific prefix first.
 *
 * Rule for the screens without a shape of their own (docs/design-system.md §2.5.8):
 * - a sub-screen keeps the shape of its section: `/contacts/[id]` keeps the sphere
 *   (opening a record from the list is no change of place, so nothing morphs), and
 *   `/agents-ia/leads-entrants`, `/relances`, `/suivi-rendez-vous`, `/executions/[id]`
 *   keep the agents shape. `/agents-ia/a-valider` is the exception with its own shape;
 * - a top-level screen without a shape (`/taches`, `/rendez-vous`, anything new) gets
 *   the veil of the dashboard, the neutral material of the daily work.
 * No other shape is invented.
 */
const ROUTE_PRESETS: readonly (readonly [string, ParticlePreset])[] = [
  ["/agents-ia/a-valider", "vortex"],
  ["/agents-ia", "agents"],
  ["/contacts", "sphere"],
  ["/pipeline", "current"],
  ["/parametres", "grid"],
  ["/dashboard", "veil"],
];

/** Shape of screens that have none (see above). */
export const FALLBACK_PRESET: ParticlePreset = "veil";

export function presetForPath(path: string): ParticlePreset {
  for (const [prefix, preset] of ROUTE_PRESETS) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return preset;
  }
  return FALLBACK_PRESET;
}
