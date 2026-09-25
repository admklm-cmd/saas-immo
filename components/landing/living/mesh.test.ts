import { describe, expect, it } from "vitest";

import { digest, recordDraw } from "./canvas-recorder.test-helper";
import { MESH_LINK_CAP, meshLinksOf, PARALLAX_MAX, PULSES } from "./mesh";
import { AGENTS_MESH_STYLE } from "./mesh-style";
import { buildFrame, displayedMesh, parallaxShift, STATIC_TIME, TRANSITION_SECONDS } from "./model";
import type { Palette } from "./renderer";
import { LIVING_SCENES, SCENES, type LivingScene } from "./scenes";
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

/**
 * Fingerprints of the problem scene recorded with the code of commit 01348a6
 * (C2), before the agents mesh profile (C3): its mesh, its impulses and its
 * transitions to and from the scenes without mesh are drawn exactly as before.
 */
const PROBLEME_REFERENCE: Record<string, string> = {
  "probleme|wide": "3662d0e98a5c66a7",
  "probleme|compact": "f0474ca99078981b",
  "hero>probleme|wide": "890c15ceb9b9f006",
  "hero>probleme|compact": "db3d27c89f73603c",
  "probleme>solution|wide": "8976214581544c2d",
  "probleme>solution|compact": "1ec6d55bbf4469e3",
};

/** Average ink of the agents scene with the code of commit 01348a6 (C2), same procedure. */
const AGENTS_INK_C2 = { wide: 1259.3257866751696, compact: 419.7682131997187 } as const;

function averageInk(scene: LivingScene, viewport: Viewport): number {
  return averageRecording(scene, viewport).ink;
}

function averageRecording(scene: LivingScene, viewport: Viewport): { ink: number; accentInk: number } {
  let ink = 0;
  let accentInk = 0;
  let count = 0;
  for (let time = 0; time < 60; time += 0.5) {
    const state: SceneState = { scene, since: -100, previous: null, from: null };
    const recording = recordDraw(buildFrame({ time, state, viewport }), drawOptions(viewport));
    ink += recording.ink;
    accentInk += recording.accentInk;
    count += 1;
  }
  return { ink: ink / count, accentInk: accentInk / count };
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

  it("leave the problem scene and its transitions exactly as in C2 (the agents profile changes nothing there)", () => {
    for (const viewport of [WIDE, COMPACT]) {
      const size = viewport.compact ? "compact" : "wide";
      const calls: string[] = [];
      for (const time of TIMES) {
        for (const parallax of [0, 0.8]) {
          calls.push(...recordDraw(buildFrame({ time, state: still("probleme"), viewport, parallax }), drawOptions(viewport)).calls);
        }
      }
      expect(digest(calls), `probleme ${size}`).toBe(PROBLEME_REFERENCE[`probleme|${size}`]);
      const pairs: [LivingScene, LivingScene][] = [
        ["hero", "probleme"],
        ["probleme", "solution"],
      ];
      for (const [previous, scene] of pairs) {
        const moves: string[] = [];
        for (const time of [10, 10.4, 11.1, 12]) {
          const state: SceneState = { scene, since: 10, previous, from: null };
          moves.push(...recordDraw(buildFrame({ time, state, viewport }), drawOptions(viewport)).calls);
        }
        expect(digest(moves), `${previous}>${scene} ${size}`).toBe(PROBLEME_REFERENCE[`${previous}>${scene}|${size}`]);
      }
    }
    expect(SCENES.probleme.meshStyle).toBeUndefined();
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

  it("caps the number of points, links and impulses, wide and compact", () => {
    // The problem scene keeps the C1 caps; the agents profile has its own (C3).
    const caps = {
      probleme: { wide: MESH_LINK_CAP.wide, compact: MESH_LINK_CAP.compact, points: { wide: 64, compact: 20 } },
      agents: {
        wide: AGENTS_MESH_STYLE.wide.links,
        compact: AGENTS_MESH_STYLE.compact.links,
        points: { wide: AGENTS_MESH_STYLE.wide.points, compact: AGENTS_MESH_STYLE.compact.points },
      },
    } as const;
    expect(MESH_LINK_CAP.wide).toBeLessThanOrEqual(160);
    expect(AGENTS_MESH_STYLE.wide.links).toBeLessThanOrEqual(260);
    expect(AGENTS_MESH_STYLE.compact.links).toBeLessThanOrEqual(45);
    expect(AGENTS_MESH_STYLE.wide.points).toBeLessThanOrEqual(120);
    expect(AGENTS_MESH_STYLE.compact.points).toBeLessThanOrEqual(30);
    expect(AGENTS_MESH_STYLE.wide.pulses).toBeLessThanOrEqual(PULSES.wide);
    expect(AGENTS_MESH_STYLE.compact.pulses).toBeLessThanOrEqual(PULSES.compact);
    expect(PULSES.wide).toBeLessThanOrEqual(3);
    for (const scene of MESHED) {
      const cap = caps[scene as keyof typeof caps];
      const wide = meshLinksOf(scene, WIDE, 20260924);
      const compact = meshLinksOf(scene, COMPACT, 20260924);
      expect(wide.length).toBeGreaterThan(40);
      expect(wide.length).toBeLessThanOrEqual(cap.wide);
      expect(compact.length).toBeGreaterThan(5);
      expect(compact.length).toBeLessThanOrEqual(cap.compact);
      for (let time = 0; time < 40; time += 1.3) {
        const frame = buildFrame({ time, state: still(scene), viewport: WIDE });
        expect(frame.meshLinks.length).toBeLessThanOrEqual(cap.wide);
        expect(frame.meshPoints.length).toBe(cap.points.wide);
        expect(buildFrame({ time, state: still(scene), viewport: COMPACT }).meshPoints.length).toBe(cap.points.compact);
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
          // Every mesh link is a hairline under the opacity cap (C1: 0.08;
          // agents profile, C3: 0.3, about 0.15 to 0.3 on screen).
          const cap = scene === "agents" ? 0.3 : 0.08;
          const hairlines = quiet.strokes.filter((style) => style.startsWith("rgba(150,150,160,"));
          expect(hairlines.length).toBeGreaterThan(0);
          for (const style of hairlines) {
            const alpha = Number(style.match(/,([\d.]+)\)$/)?.[1]);
            expect(alpha).toBeLessThanOrEqual(cap);
          }
          const full = recordDraw(frame, { ...drawOptions(viewport), palette }).calls.join("\n");
          expect(full).not.toMatch(/shadowBlur|shadowColor|filter=|createLinearGradient|createRadialGradient/);
        }
      }
    }
  });

  it("raises the visibility of the problem scene by 30 to 40 %, half of it on phones", () => {
    for (const scene of ["probleme"] as const) {
      const wide = averageInk(scene, WIDE) / (INK_BEFORE[`${scene}|wide`] ?? NaN);
      const compact = averageInk(scene, COMPACT) / (INK_BEFORE[`${scene}|compact`] ?? NaN);
      expect(wide, `${scene} wide`).toBeGreaterThanOrEqual(1.3);
      expect(wide, `${scene} wide`).toBeLessThanOrEqual(1.4);
      expect(compact, `${scene} compact`).toBeGreaterThan(1.1);
      expect(compact, `${scene} compact`).toBeLessThan(1.25);
      expect(compact).toBeLessThan(wide);
    }
  });

  it("makes the agents network clearly visible: at least 2.5 times the ink of C2, less on phones", () => {
    const wide = averageInk("agents", WIDE) / AGENTS_INK_C2.wide;
    const compact = averageInk("agents", COMPACT) / AGENTS_INK_C2.compact;
    // Measured: 3.8 (wide) and 1.4 (phones, a sober column, a little more present).
    expect(wide).toBeGreaterThanOrEqual(2.5);
    expect(wide).toBeLessThan(5);
    expect(compact).toBeGreaterThan(1.2);
    expect(compact).toBeLessThan(wide);
  });

  it("keeps cobalt a small share of the agents network ink (under 15 %)", () => {
    for (const viewport of [WIDE, COMPACT]) {
      // The mesh alone (hairlines, vertices, impulses and the vertices they light).
      let ink = 0;
      let accentInk = 0;
      for (let time = 0; time < 60; time += 0.5) {
        const frame = buildFrame({ time, state: { scene: "agents", since: -100, previous: null, from: null }, viewport });
        const mesh: Frame = { ...frame, nodes: [], links: [], tokens: [], marks: [], motes: [], fragments: [] };
        const recording = recordDraw(mesh, drawOptions(viewport));
        ink += recording.ink;
        accentInk += recording.accentInk;
      }
      expect(accentInk / ink, viewport.compact ? "mesh compact" : "mesh wide").toBeLessThan(0.15);
    }
    // The whole scene: under 15 % on desktop. On phones the path's own signals
    // (unchanged) weigh more: 27 % in C2, lower now that the mesh adds grey.
    const wide = averageRecording("agents", WIDE);
    expect(wide.accentInk / wide.ink).toBeLessThan(0.15);
    const compact = averageRecording("agents", COMPACT);
    expect(compact.accentInk / compact.ink).toBeLessThan(0.21);
  });

  it("draws the agents vertices as small grey dots, a few outlined hubs, never cobalt at rest", () => {
    const frame = buildFrame({ time: 17, state: still("agents"), viewport: WIDE });
    const looks = frame.meshPoints.map((point) => point.look).filter((look) => look !== undefined);
    expect(looks).toHaveLength(AGENTS_MESH_STYLE.wide.points);
    const hubs = looks.filter((look) => look.hub);
    expect(hubs.length).toBeGreaterThanOrEqual(3);
    expect(hubs.length).toBeLessThan(looks.length * 0.15);
    for (const look of looks) {
      expect(look.r).toBeGreaterThanOrEqual(1);
      expect(look.r).toBeLessThanOrEqual(4);
      // On screen (rest intensity 0.72): at most about 0.55.
      expect(look.alpha * 0.72).toBeLessThanOrEqual(0.56);
    }
    const near = looks.filter((look) => !look.hub && look.r >= AGENTS_MESH_STYLE.wide.radius[0]);
    expect(Math.max(...near.map((look) => look.alpha * 0.72))).toBeGreaterThanOrEqual(0.35);
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
