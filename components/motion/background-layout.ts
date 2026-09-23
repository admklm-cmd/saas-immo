import type { Region } from "./engine/layout";

/**
 * Where the full-page background shape lives, per viewport class (spec §9).
 *
 * The canvas covers the viewport; `region` keeps the shape away from the text
 * posed outside cards (titles, descriptions, filters, navigation), and the
 * `.app-particles` mask in app/globals.css fades whatever is left under them.
 * - desktop (>= 1024 px): the navigation is a 256 px column on the left and
 *   every title is left-aligned, so the shape sits on the right of the viewport;
 * - tablet (768–1023 px): same idea, a little wider (the navigation is on top);
 * - mobile (< 768 px): text spans the whole width, so the shape is discreet
 *   (lower intensity) and kept below the header area.
 */
export type ViewportClass = "desktop" | "tablet" | "mobile";

export type BackgroundLayout = { region: Region; intensity: number };

export const BACKGROUND_LAYOUT: Record<ViewportClass, BackgroundLayout> = {
  desktop: { region: { x: 0.54, y: 0.01, width: 0.44, height: 0.42 }, intensity: 1 },
  tablet: { region: { x: 0.4, y: 0.1, width: 0.58, height: 0.36 }, intensity: 0.9 },
  mobile: { region: { x: 0.02, y: 0.34, width: 0.96, height: 0.64 }, intensity: 0.7 },
};

export const DESKTOP_QUERY = "(min-width: 1024px)";
export const MOBILE_QUERY = "(max-width: 767px)";

export function viewportClass(desktop: boolean, mobile: boolean): ViewportClass {
  if (desktop) return "desktop";
  return mobile ? "mobile" : "tablet";
}
