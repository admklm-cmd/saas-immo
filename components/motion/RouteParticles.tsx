"use client";

import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

import { BACKGROUND_LAYOUT, DESKTOP_QUERY, MOBILE_QUERY, viewportClass, type ViewportClass } from "./background-layout";
import { ParticleScene } from "./ParticleScene";
import { presetForPath } from "./route-presets";

function subscribe(onChange: () => void): () => void {
  const queries = [window.matchMedia(DESKTOP_QUERY), window.matchMedia(MOBILE_QUERY)];
  for (const query of queries) query.addEventListener("change", onChange);
  return () => {
    for (const query of queries) query.removeEventListener("change", onChange);
  };
}

function getSnapshot(): ViewportClass {
  return viewportClass(window.matchMedia(DESKTOP_QUERY).matches, window.matchMedia(MOBILE_QUERY).matches);
}

/** Desktop first (reference width 1440 px); corrected right after hydration. */
function getServerSnapshot(): ViewportClass {
  return "desktop";
}

/**
 * Full-page decorative background of the signed-in space (spec §9).
 *
 * Rendered once by app/(app)/layout.tsx, which persists across navigations:
 * a single canvas and a single engine for the whole session. The shape follows
 * the route (`presetForPath`); a change of pathname — menu, link, browser
 * back/forward — morphs from what is displayed, without delaying anything.
 *
 * Purely decorative: it never reflects the state of an agent, carries no label
 * and is hidden from assistive technology (see ParticleScene).
 */
export function RouteParticles() {
  const path = usePathname();
  const viewport = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const layout = BACKGROUND_LAYOUT[viewport];
  return (
    <ParticleScene
      preset={presetForPath(path)}
      mode="background"
      region={layout.region}
      intensity={layout.intensity}
      className="app-particles"
    />
  );
}
