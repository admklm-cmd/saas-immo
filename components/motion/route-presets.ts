import type { ParticlePreset } from "./shapes";

/** Decorative preset of each app route (spec §3). Most specific prefix first. */
const ROUTE_PRESETS: readonly (readonly [string, ParticlePreset])[] = [
  ["/agents-ia/a-valider", "vortex"],
  ["/agents-ia", "agents"],
  ["/contacts", "sphere"],
  ["/pipeline", "current"],
  ["/parametres", "grid"],
  ["/dashboard", "veil"],
];

export function presetForPath(path: string): ParticlePreset {
  for (const [prefix, preset] of ROUTE_PRESETS) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return preset;
  }
  return "veil";
}
