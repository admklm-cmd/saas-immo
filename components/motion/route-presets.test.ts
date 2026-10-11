import { describe, expect, it } from "vitest";

import { BACKGROUND_LAYOUT, viewportClass } from "./background-layout";
import { FALLBACK_PRESET, presetForPath } from "./route-presets";

describe("presetForPath", () => {
  it("gives each of the six main screens its own shape (spec §3)", () => {
    expect(presetForPath("/dashboard")).toBe("veil");
    expect(presetForPath("/contacts")).toBe("sphere");
    expect(presetForPath("/pipeline")).toBe("current");
    expect(presetForPath("/agents-ia")).toBe("agents");
    expect(presetForPath("/agents-ia/a-valider")).toBe("vortex");
    expect(presetForPath("/parametres")).toBe("grid");
  });

  it("keeps the shape of the section on its sub-screens", () => {
    expect(presetForPath("/contacts/0b6c2a4e-1d2f-4c3b-9a8e-7f6d5c4b3a21")).toBe("sphere");
    expect(presetForPath("/agents-ia/leads-entrants")).toBe("agents");
    expect(presetForPath("/agents-ia/relances")).toBe("agents");
    expect(presetForPath("/agents-ia/suivi-rendez-vous")).toBe("agents");
    expect(presetForPath("/agents-ia/executions/42")).toBe("agents");
  });

  it("gives the dashboard veil to top-level screens without a shape of their own", () => {
    expect(FALLBACK_PRESET).toBe("veil");
    expect(presetForPath("/taches")).toBe("veil");
    expect(presetForPath("/rendez-vous")).toBe("veil");
  });

  it("does not match a mere prefix of a segment and falls back to the veil", () => {
    expect(presetForPath("/contactsx")).toBe("veil");
    expect(presetForPath("/agents-ia/a-validerx")).toBe("agents");
    expect(presetForPath("/")).toBe("veil");
  });

  it("covers every entry of the main navigation", () => {
    const menu = [
      "/dashboard",
      "/contacts",
      "/pipeline",
      "/taches",
      "/rendez-vous",
      "/agents-ia",
      "/agents-ia/leads-entrants",
      "/agents-ia/relances",
      "/agents-ia/a-valider",
      "/agents-ia/suivi-rendez-vous",
      "/parametres",
    ];
    expect(menu.map(presetForPath)).toEqual([
      "veil",
      "sphere",
      "current",
      "veil",
      "veil",
      "agents",
      "agents",
      "agents",
      "vortex",
      "agents",
      "grid",
    ]);
  });
});

describe("background layout", () => {
  it("classifies the viewport like the Tailwind breakpoints (lg 1024, md 768)", () => {
    expect(viewportClass(true, false)).toBe("desktop");
    expect(viewportClass(false, false)).toBe("tablet");
    expect(viewportClass(false, true)).toBe("mobile");
  });

  it("keeps every region inside the canvas and every intensity within the mode range", () => {
    for (const { region, intensity } of Object.values(BACKGROUND_LAYOUT)) {
      expect(region.x).toBeGreaterThanOrEqual(0);
      expect(region.y).toBeGreaterThanOrEqual(0);
      expect(region.x + region.width).toBeLessThanOrEqual(1);
      expect(region.y + region.height).toBeLessThanOrEqual(1);
      expect(intensity).toBeGreaterThan(0);
      expect(intensity).toBeLessThanOrEqual(1);
    }
  });

  // Spec changed on 26/09/2026 (docs/plans/2026-09-26-typography-particles.md):
  // the shape no longer avoids the navigation and the titles — it spans the whole
  // viewport on every class; readability comes from opaque cards and .particle-veil.
  it("spans the whole viewport on every viewport class, quieter on mobile", () => {
    for (const { region } of Object.values(BACKGROUND_LAYOUT)) {
      expect(region).toEqual({ x: 0, y: 0, width: 1, height: 1 });
    }
    expect(BACKGROUND_LAYOUT.desktop.intensity).toBe(1);
    expect(BACKGROUND_LAYOUT.mobile.intensity).toBeLessThan(BACKGROUND_LAYOUT.tablet.intensity);
  });
});
