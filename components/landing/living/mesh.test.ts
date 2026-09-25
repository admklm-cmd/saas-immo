import { describe, expect, it } from "vitest";

import { digest, recordDraw } from "./canvas-recorder.test-helper";
import { MESH_LINK_CAP, meshLinksOf, PARALLAX_MAX, PULSES } from "./mesh";
import { buildFrame, displayedMesh, parallaxShift, STATIC_TIME, TRANSITION_SECONDS } from "./model";
import type { Palette } from "./renderer";
import { LIVING_SCENES, type LivingScene } from "./scenes";
import type { Frame, SceneState, Viewport } from "./types";

const WIDE: Viewport = { width: 1440, height: 900, compact: false };
const COMPACT: Viewport = { width: 390, height: 844, compact: true };
const MESHED: readonly LivingScene[] = ["probleme", "agents"];
const PLAIN = LIVING_SCENES.filter((scene) => !MESHED.includes(scene));
const TIMES = [0, 3.7, 12.5, STATIC_TIME, 27.9, 55.05];

function still(scene: LivingScene): SceneState {
  return { scene, since: 0, previous: null, from: null };
}

function drawOptions(viewport: Viewport) {
  return { width: viewport.width, height: viewport.height, compact: viewport.compact };
}

/**
 * Fingerprints of the drawing calls of the five scenes without mesh, recorded
 * with the code as it was BEFORE the mesh existed (commit 03ff51f), at the
 * instants of `TIMES`. Any difference in any call (position, colour, opacity,
 * order) changes the fingerprint: these scenes are drawn exactly as before.
 */
const REFERENCE: Record<string, string> = {
  "hero|wide": "24860efd8a2b3e48",
  "hero|compact": "68ef230e252af98a",
  "solution|wide": "f726c05fecac34af",
  "solution|compact": "bdfdc519c963001e",
  "controle|wide": "0cb1154fa73ce03e",
  "controle|compact": "cc1486b2b7d1d965",
  "resultat|wide": "c0eaad640d1eaf19",
  "resultat|compact": "18398f73796b03c9",
  "final|wide": "76aabc48a46dbfe6",
  "final|compact": "f8bac670328599ba",
  "solution>controle": "ba028dd90391c6b1",
  "controle>resultat": "ee4f9e61ebe21a6b",
  "resultat>final": "752cb0adcbf252bc",
};

/**
 * Average ink of the problem and agents scenes with the code BEFORE the mesh
 * (same commit, t = 0..60 s every 0.5 s, see canvas-recorder.test-helper.ts).
 *
 * `agents|wide`: the composition of that scene moved (C2, around and between
 * the elements of its section), so its reference was measured again the same
 * way: the renderer of commit 03ff51f drawing the NEW composition without mesh
 * (1091.37 for the old composition). The same procedure reproduces the three
 * other values exactly.
 */
const INK_BEFORE: Record<string, number> = {
  "probleme|wide": 1410.4920064347125,
  "probleme|compact": 337.9707099954822,
  "agents|wide": 916.9266221758869,
  "agents|compact": 366.9802782056812,
};

function averageInk(scene: LivingScene, viewport: Viewport): number {
  let total = 0;
  let count = 0;
  for (let time = 0; time < 60; time += 0.5) {
    const state: SceneState = { scene, since: -100, previous: null, from: null };
    total += recordDraw(buildFrame({ time, state, viewport }), drawOptions(viewport)).ink;
    count += 1;
  }
  return total / count;
}

describe("scenes without mesh", () => {
  it("draw exactly the same calls as before the mesh, wide and compact", () => {
    for (const scene of PLAIN) {
      for (const viewport of [WIDE, COMPACT]) {
        const calls: string[] = [];
        for (const time of TIMES) {
          // A parallax request must change nothing either.
          const frame = buildFrame({ time, state: still(scene), viewport, parallax: 0.8 });
          calls.push(...recordDraw(frame, drawOptions(viewport)).calls);
        }
        expect(digest(calls), `${scene} ${viewport.compact ? "compact" : "wide"}`).toBe(
          REFERENCE[`${scene}|${viewport.compact ? "compact" : "wide"}`],
        );
      }
    }
  });

  it("keep the same transitions between them", () => {
    const pairs: [LivingScene, LivingScene][] = [
      ["solution", "controle"],
      ["controle", "resultat"],
      ["resultat", "final"],
    ];
    for (const [previous, scene] of pairs) {
      const calls: string[] = [];
      for (const time of [10, 10.4, 11.1, 12]) {
        const state: SceneState = { scene, since: 10, previous, from: null };
        calls.push(...recordDraw(buildFrame({ time, state, viewport: WIDE })).calls);
      }
      expect(digest(calls)).toBe(REFERENCE[`${previous}>${scene}`]);
    }
  });

  it("carry no mesh link, no impulse, no parallax", () => {
    for (const scene of PLAIN) {
      for (const viewport of [WIDE, COMPACT]) {
        for (const time of TIMES) {
          const frame = buildFrame({ time, state: still(scene), viewport, parallax: -1 });
          expect(frame.mesh).toBe(0);
          expect(frame.meshLinks).toHaveLength(0);
          expect(frame.meshPoints).toHaveLength(0);
          expect(frame.pulses).toHaveLength(0);
          expect(frame.parallax).toBe(0);
        }
      }
      expect(meshLinksOf(scene, WIDE, 1)).toHaveLength(0);
    }
  });
});

describe("mesh of the problem and agents scenes", () => {
  it("is deterministic: the same instant draws the same frame", () => {
    for (const scene of MESHED) {
      const input = { time: 17.25, state: still(scene), viewport: WIDE, parallax: 0.3 };
      expect(buildFrame(input)).toEqual(buildFrame(input));
    }
  });

  it("keeps the same pairs linked from one frame to the next (no flicker)", () => {
    for (const scene of MESHED) {
      const first = meshLinksOf(scene, WIDE, 20260924).map((link) => ({ ...link }));
      buildFrame({ time: 3, state: still(scene), viewport: WIDE });
      buildFrame({ time: 33, state: still(scene), viewport: WIDE });
      expect(meshLinksOf(scene, WIDE, 20260924)).toEqual(first);
      // Link ends move continuously: at 60 fps, no end jumps more than 2 px.
      const a = buildFrame({ time: 20, state: still(scene), viewport: WIDE });
      const b = buildFrame({ time: 20 + 1 / 60, state: still(scene), viewport: WIDE });
      expect(b.meshPoints).toHaveLength(a.meshPoints.length);
      a.meshPoints.forEach((point, index) => {
        const next = b.meshPoints[index];
        expect(Math.hypot((next?.x ?? NaN) - point.x, (next?.y ?? NaN) - point.y)).toBeLessThan(2);
      });
    }
  });

  it("caps the number of links, wide and compact", () => {
    for (const scene of MESHED) {
      const wide = meshLinksOf(scene, WIDE, 20260924);
      const compact = meshLinksOf(scene, COMPACT, 20260924);
      expect(wide.length).toBeGreaterThan(40);
      expect(wide.length).toBeLessThanOrEqual(MESH_LINK_CAP.wide);
      expect(MESH_LINK_CAP.wide).toBeLessThanOrEqual(160);
      expect(compact.length).toBeGreaterThan(5);
      expect(compact.length).toBeLessThanOrEqual(MESH_LINK_CAP.compact);
      for (let time = 0; time < 40; time += 1.3) {
        expect(buildFrame({ time, state: still(scene), viewport: WIDE }).meshLinks.length).toBeLessThanOrEqual(
          MESH_LINK_CAP.wide,
        );
        const pulses = buildFrame({ time, state: still(scene), viewport: WIDE }).pulses.length;
        expect(pulses).toBeLessThanOrEqual(PULSES.wide);
        expect(buildFrame({ time, state: still(scene), viewport: COMPACT }).pulses.length).toBeLessThanOrEqual(
          PULSES.compact,
        );
      }
    }
  });

  it("sends a few slow impulses, regularly", () => {
    for (const scene of MESHED) {
      let withPulse = 0;
      let samples = 0;
      for (let time = 0; time < 60; time += 0.25) {
        samples += 1;
        if (buildFrame({ time, state: still(scene), viewport: WIDE }).pulses.length > 0) withPulse += 1;
      }
      expect(withPulse / samples).toBeGreaterThan(0.4);
    }
  });

  it("never paints a resting link with the accent colour, and uses no shadow, blur or gradient", () => {
    const palette: Palette = { ink: [24, 24, 27], line: [150, 150, 160], accent: [1, 2, 3], paper: [255, 255, 255] };
    for (const scene of MESHED) {
      for (const viewport of [WIDE, COMPACT]) {
        for (const time of TIMES) {
          const frame = buildFrame({ time, state: still(scene), viewport, parallax: 0.5 });
          expect(frame.meshLinks.length).toBeGreaterThan(0);
          // The mesh alone (links and vertices, at rest): no accent anywhere.
          const rest: Frame = {
            ...frame,
            nodes: [],
            links: [],
            tokens: [],
            marks: [],
            motes: [],
            fragments: [],
            pulses: [],
          };
          const quiet = recordDraw(rest, { ...drawOptions(viewport), palette });
          expect(quiet.strokes.length).toBeGreaterThan(0);
          expect(quiet.calls.join("\n")).not.toContain("rgba(1,2,3,");
          // Every mesh link is a hairline under the opacity cap.
          for (const style of quiet.strokes) {
            const alpha = Number(style.match(/,([\d.]+)\)$/)?.[1]);
            expect(alpha).toBeLessThanOrEqual(0.08);
          }
          const full = recordDraw(frame, { ...drawOptions(viewport), palette }).calls.join("\n");
          expect(full).not.toMatch(/shadowBlur|shadowColor|filter=|createLinearGradient|createRadialGradient/);
        }
      }
    }
  });

  it("raises the visibility of these two scenes by 30 to 40 %, half of it on phones", () => {
    for (const scene of MESHED) {
      const wide = averageInk(scene, WIDE) / (INK_BEFORE[`${scene}|wide`] ?? NaN);
      const compact = averageInk(scene, COMPACT) / (INK_BEFORE[`${scene}|compact`] ?? NaN);
      expect(wide, `${scene} wide`).toBeGreaterThanOrEqual(1.3);
      expect(wide, `${scene} wide`).toBeLessThanOrEqual(1.4);
      expect(compact, `${scene} compact`).toBeGreaterThan(1.1);
      expect(compact, `${scene} compact`).toBeLessThan(1.25);
      expect(compact).toBeLessThan(wide);
    }
  });
});

describe("parallax of the mesh", () => {
  it("is 0 without scroll progress (reduced motion draws with none)", () => {
    for (const scene of MESHED) {
      const frame = buildFrame({ time: STATIC_TIME, state: still(scene), viewport: WIDE });
      expect(frame.parallax).toBe(0);
    }
    expect(parallaxShift(0, 1)).toBe(0);
    expect(parallaxShift(0.7, 0)).toBe(0);
  });

  it("never exceeds 20 px, and moves the far plane less than the near one", () => {
    for (const progress of [-5, -1, -0.4, 0.2, 1, 5]) {
      expect(Math.abs(parallaxShift(progress, 1))).toBeLessThanOrEqual(PARALLAX_MAX);
    }
    expect(PARALLAX_MAX).toBeLessThanOrEqual(20);
    for (const scene of MESHED) {
      const rest = buildFrame({ time: 9, state: still(scene), viewport: WIDE, parallax: 0 });
      const scrolled = buildFrame({ time: 9, state: still(scene), viewport: WIDE, parallax: 1 });
      expect(Math.abs(scrolled.parallax)).toBeCloseTo(PARALLAX_MAX, 9);
      rest.meshPoints.forEach((point, index) => {
        const moved = scrolled.meshPoints[index];
        const dy = Math.abs((moved?.y ?? NaN) - point.y);
        expect(moved?.x).toBe(point.x);
        expect(dy).toBeLessThanOrEqual(PARALLAX_MAX + 1e-9);
        expect(dy).toBeCloseTo(point.far ? PARALLAX_MAX * 0.4 : PARALLAX_MAX, 9);
      });
      // Phones: half the mesh, half the shift.
      const phone = buildFrame({ time: 9, state: still(scene), viewport: COMPACT, parallax: 1 });
      expect(Math.abs(phone.parallax)).toBeLessThanOrEqual(PARALLAX_MAX / 2 + 1e-9);
      // The path itself never follows the parallax.
      expect(scrolled.nodes.map((node) => [node.x, node.y])).toEqual(rest.nodes.map((node) => [node.x, node.y]));
    }
  });
});

describe("mesh weight across scene changes", () => {
  it("fades in and out with a smoothstep: no jump", () => {
    const pairs: [LivingScene, LivingScene][] = [
      ["hero", "probleme"],
      ["probleme", "solution"],
      ["solution", "agents"],
      ["agents", "controle"],
      ["probleme", "agents"],
    ];
    for (const [previous, scene] of pairs) {
      for (const viewport of [WIDE, COMPACT]) {
        const since = 10;
        const state: SceneState = { scene, since, previous, from: null };
        const start = MESHED.includes(previous) ? (viewport.compact ? 0.5 : 1) : 0;
        const end = MESHED.includes(scene) ? (viewport.compact ? 0.5 : 1) : 0;
        expect(displayedMesh(state, viewport, since)).toBeCloseTo(start, 10);
        expect(displayedMesh(state, viewport, since + TRANSITION_SECONDS)).toBeCloseTo(end, 10);
        const step = 1 / 60;
        let last = displayedMesh(state, viewport, since);
        for (let time = since + step; time <= since + TRANSITION_SECONDS + 0.5; time += step) {
          const value = displayedMesh(state, viewport, time);
          expect(Math.abs(value - last)).toBeLessThan(0.02);
          last = value;
        }
        // The frame carries the same blended weight, and the links follow it.
        const middle = buildFrame({ time: since + TRANSITION_SECONDS / 2, state, viewport });
        expect(middle.mesh).toBeCloseTo((start + end) / 2, 10);
      }
    }
  });
});
