"use client";
import { usePathname } from "next/navigation";
import { ParticleScene } from "./ParticleScene";
import { presetForPath } from "./particle-presets";

/** Lives in the shared layout: back/forward and interrupted navigations retain the canvas. */
export function RouteParticles() {
  const path = usePathname();
  return <div className="route-particles"><ParticleScene preset={presetForPath(path)} /></div>;
}
