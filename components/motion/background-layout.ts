import { FULL_REGION, type Region } from "./engine/layout";

/**
 * Where the full-page background shape lives, per viewport class (spec §9,
 * revised on 26/09/2026 — docs/plans/2026-09-26-typography-particles.md).
 *
 * The shape now spans the WHOLE viewport on every viewport class: no side of
 * the page is left bare and no mask fades it any more. Readability is kept by
 * the opaque white cards and by `.particle-veil` under every block of text
 * posed directly on the canvas (app/globals.css). Only the intensity still
 * follows the viewport: a phone, where text spans the whole width, gets a
 * quieter shape.
 */
export type ViewportClass = "desktop" | "tablet" | "mobile";

export type BackgroundLayout = { region: Region; intensity: number };

export const BACKGROUND_LAYOUT: Record<ViewportClass, BackgroundLayout> = {
  desktop: { region: FULL_REGION, intensity: 1 },
  tablet: { region: FULL_REGION, intensity: 0.9 },
  mobile: { region: FULL_REGION, intensity: 0.75 },
};

export const DESKTOP_QUERY = "(min-width: 1024px)";
export const MOBILE_QUERY = "(max-width: 767px)";

export function viewportClass(desktop: boolean, mobile: boolean): ViewportClass {
  if (desktop) return "desktop";
  return mobile ? "mobile" : "tablet";
}
