"use client";

import { usePathname } from "next/navigation";

import { ParticleScene } from "./ParticleScene";
import { presetForPath } from "./route-presets";

/**
 * Persistent decorative scene for the app shell: the preset follows the route
 * and morphs on navigation. Placement is styled by `.route-particles`.
 */
export function RouteParticles() {
  const path = usePathname();
  return (
    <div className="route-particles" aria-hidden="true">
      <ParticleScene preset={presetForPath(path)} />
    </div>
  );
}
