import { agents } from "./agents";
import { current } from "./current";
import { grid } from "./grid";
import { sphere } from "./sphere";
import type { ShapeDefinition } from "./types";
import { veil } from "./veil";
import { vortex } from "./vortex";

/**
 * One decorative preset per app screen (spec §3). Order = gallery order:
 * veil = dashboard, sphere = contacts, current = pipeline, agents = agents IA,
 * vortex = messages à valider, grid = paramètres.
 */
export const PARTICLE_PRESETS = ["veil", "sphere", "current", "agents", "vortex", "grid"] as const;
export type ParticlePreset = (typeof PARTICLE_PRESETS)[number];

export const SHAPES: Record<ParticlePreset, ShapeDefinition> = { veil, sphere, current, agents, vortex, grid };

export { POINT_STRIDE } from "./types";
export type { ShapeBounds, ShapeDefinition, ShapeFn } from "./types";
