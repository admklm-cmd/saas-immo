import { describe, expect, it } from "vitest";

import { LABEL, labelRect, segmentRectDistance, STOP_LABEL, type Rect } from "./labels";
import { labelRects } from "./mesh";
import { buildFrame, STATIC_TIME } from "./model";
import { SCENES, type LivingScene } from "./scenes";
import type { SceneState, Viewport } from "./types";

const WIDE: Viewport = { width: 1440, height: 900, compact: false };
const MESHED: readonly LivingScene[] = ["probleme", "agents"];
const TIMES = [0, 2.2, 5.9, 11.35, 17.8, 26.4, STATIC_TIME, 48.7, 59.1];

function still(scene: LivingScene): SceneState {
  return { scene, since: 0, previous: null, from: null };
}

/**
 * Elements of the agents section at 1440 × 900, measured in Chromium
 * (getBoundingClientRect, text line boxes) at the reading position: section
 * top 120 px above the viewport. Fixed header, title lines, introduction, hint,
 * navigation, the six visible modules, detail text and scene window.
 */
const OCCUPIED: readonly Rect[] = [
  { x0: 0, y0: 0, x1: 1440, y1: 64 },
  { x0: 128, y0: 46, x1: 760, y1: 276 },
  { x0: 128, y0: 291, x1: 780, y1: 338 },
  { x0: 128, y0: 413, x1: 526, y1: 432 },
  { x0: 1160, y0: 405, x1: 1312, y1: 441 },
  { x0: 128, y0: 468, x1: 336, y1: 678 },
  { x0: 348, y0: 468, x1: 556, y1: 678 },
  { x0: 568, y0: 468, x1: 776, y1: 678 },
  { x0: 788, y0: 468, x1: 976, y1: 678 },
  { x0: 988, y0: 468, x1: 1196, y1: 678 },
  { x0: 1208, y0: 468, x1: 1320, y1: 678 },
  { x0: 128, y0: 723, x1: 582, y1: 900 },
  { x0: 630, y0: 723, x1: 1312, y1: 900 },
];

function occupied(x: number, y: number): boolean {
  return OCCUPIED.some((rect) => x >= rect.x0 && x <= rect.x1 && y >= rect.y0 && y <= rect.y1);
}

/** Drawn pieces of every mesh link of a frame, in CSS px. */
function pieces(link: { x1: number; y1: number; x2: number; y2: number; parts?: readonly (readonly [number, number])[] }) {
  return (link.parts ?? [[0, 1] as const]).map(([from, to]) => [
    link.x1 + (link.x2 - link.x1) * from,
    link.y1 + (link.y2 - link.y1) * from,
    link.x1 + (link.x2 - link.x1) * to,
    link.y1 + (link.y2 - link.y1) * to,
  ]);
}

describe("labels of the path stay clear of the mesh", () => {
  it("never lets a mesh line cross or touch a label (problem and agents, many instants)", () => {
    for (const scene of MESHED) {
      for (const time of TIMES) {
        for (const parallax of [0, -0.7, 1]) {
          const frame = buildFrame({ time, state: still(scene), viewport: WIDE, parallax });
          const labels = labelRects(frame.nodes, WIDE);
          expect(labels.length, scene).toBeGreaterThan(0);
          for (const link of frame.meshLinks) {
            for (const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] of pieces(link)) {
              for (const rect of labels) {
                expect(segmentRectDistance(x1, y1, x2, y2, rect), `${scene} t=${time}`).toBeGreaterThanOrEqual(
                  LABEL.clearance - 1e-6,
                );
              }
            }
          }
          // Impulses fade out before reaching a label (dot radius included).
          for (const pulse of frame.pulses) {
            if (pulse.alpha <= 0.001) continue;
            for (const rect of labels) {
              expect(segmentRectDistance(pulse.tx, pulse.ty, pulse.x, pulse.y, rect)).toBeGreaterThan(LABEL.clearance + 1.8);
            }
          }
        }
      }
    }
  });

  it("still draws the links that pass near a label, only interrupted (the network is unchanged)", () => {
    let interrupted = 0;
    for (const time of TIMES) {
      const frame = buildFrame({ time, state: still("probleme"), viewport: WIDE });
      interrupted += frame.meshLinks.filter((link) => link.parts).length;
    }
    expect(interrupted).toBeGreaterThan(0);
  });

  it("estimates label boxes wider than the text measured in Chromium", () => {
    // 500 11px system font (Segoe UI), measured with measureText.
    const measured: Record<string, number> = {
      Léa: 17,
      Hugo: 27.7,
      Emma: 30.9,
      "Validation humaine": 96.4,
      Louis: 26,
      Sarah: 27.9,
      Mandat: 38.7,
    };
    for (const text of STOP_LABEL) {
      if (!text) continue;
      const rect = labelRect(100, 100, text, 1440);
      expect(rect.x1 - rect.x0, text).toBeGreaterThanOrEqual((measured[text] ?? Infinity) * 1.05);
    }
  });
});

describe("composition of the agents scene", () => {
  it("keeps the network in the free space around and between the elements of the section", () => {
    let points = 0;
    let pointsOut = 0;
    let ink = 0;
    let inkOut = 0;
    let pulses = 0;
    let pulsesOut = 0;
    for (let time = 0; time < 60; time += 1.5) {
      const frame = buildFrame({ time, state: still("agents"), viewport: WIDE });
      for (const point of frame.meshPoints) {
        points += 1;
        if (!occupied(point.x, point.y)) pointsOut += 1;
      }
      for (const link of frame.meshLinks) {
        for (const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] of pieces(link)) {
          for (let step = 0; step < 20; step++) {
            const share = (step + 0.5) / 20;
            const weight = (link.alpha * Math.hypot(x2 - x1, y2 - y1)) / 20;
            ink += weight;
            if (!occupied(x1 + (x2 - x1) * share, y1 + (y2 - y1) * share)) inkOut += weight;
          }
        }
      }
      for (const pulse of frame.pulses) {
        if (pulse.alpha < 0.05) continue;
        pulses += 1;
        if (!occupied(pulse.x, pulse.y)) pulsesOut += 1;
      }
    }
    // Measured: 100 % of the vertices, 96 % of the link ink and 46 of 47
    // impulses (the composition before C2: 45 %, 46 % and 15 of 43).
    expect(pointsOut / points).toBeGreaterThan(0.9);
    expect(inkOut / ink).toBeGreaterThan(0.85);
    expect(pulses).toBeGreaterThan(20);
    expect(pulsesOut / pulses).toBeGreaterThan(0.85);
  });

  it("draws a few mesh lines through the gaps between the modules", () => {
    const gaps = [342, 562, 782];
    let inGaps = 0;
    for (const time of TIMES) {
      const frame = buildFrame({ time, state: still("agents"), viewport: WIDE });
      for (const link of frame.meshLinks) {
        for (let step = 0; step <= 20; step++) {
          const x = link.x1 + ((link.x2 - link.x1) * step) / 20;
          const y = link.y1 + ((link.y2 - link.y1) * step) / 20;
          if (y > 480 && y < 670 && gaps.some((gap) => Math.abs(x - gap) < 6)) inGaps += 1;
        }
      }
    }
    expect(inGaps / TIMES.length).toBeGreaterThan(20);
  });

  it("never puts a stop or a label of the path in the title column, from 1280 to 1920 px wide", () => {
    // Right edge of the heading box (max-w-3xl) at each width, whatever the scroll.
    const titleRight: [Viewport, number][] = [
      [{ width: 1280, height: 800, compact: false }, 816],
      [WIDE, 896],
      [{ width: 1920, height: 1080, compact: false }, 1136],
    ];
    for (const [viewport, right] of titleRight) {
      for (const time of [0, 12.5, STATIC_TIME]) {
        const frame = buildFrame({ time, state: still("agents"), viewport });
        for (const node of frame.nodes) {
          expect(node.x, `${viewport.width}`).toBeGreaterThan(right + 16);
          if (node.label) expect(labelRect(node.x, node.y, node.label, viewport.width).x0).toBeGreaterThan(right);
        }
      }
    }
  });

  it("keeps the measured pixel geometry on larger screens (centred reference frame)", () => {
    const reference = buildFrame({ time: 9, state: still("agents"), viewport: WIDE });
    const large = buildFrame({ time: 9, state: still("agents"), viewport: { width: 1920, height: 1080, compact: false } });
    large.nodes.forEach((node, index) => {
      expect(node.x - 240).toBeCloseTo(reference.nodes[index]?.x ?? NaN, 6);
      expect(node.y).toBeCloseTo(reference.nodes[index]?.y ?? NaN, 6);
    });
    // Other scenes keep the whole viewport.
    expect(SCENES.probleme.frame).toBeUndefined();
  });

  it("moves the resting points into and out of the field without any jump", () => {
    // Scenes with the same inflow. (Between scenes whose inflow differs, e.g.
    // probleme > solution, a prospect restarting its inflow cycle mid-change
    // already jumped before C2; the field changes nothing to it.)
    const pairs: [LivingScene, LivingScene][] = [
      ["solution", "agents"],
      ["agents", "controle"],
      ["hero", "agents"],
    ];
    for (const [previous, scene] of pairs) {
      const since = 10;
      const from = buildFrame({ time: since, state: still(previous), viewport: WIDE }).nodes.flatMap((node) => [node.x, node.y]);
      const state: SceneState = { scene, since, previous, from };
      let last = buildFrame({ time: since, state, viewport: WIDE }).motes;
      // First frame of the change: the prospects are where the previous scene left them.
      const before = buildFrame({ time: since, state: still(previous), viewport: WIDE }).motes;
      last.forEach((mote, index) => {
        expect(Math.hypot(mote.x - (before[index]?.x ?? NaN), mote.y - (before[index]?.y ?? NaN))).toBeLessThan(1);
      });
      for (let time = since + 1 / 60; time < since + 2; time += 1 / 60) {
        const motes = buildFrame({ time, state, viewport: WIDE }).motes;
        motes.forEach((mote, index) => {
          const previousMote = last[index];
          // A prospect reaching the entry restarts from its resting place while
          // invisible (existing inflow cycle): only visible ones are compared.
          if (mote.alpha < 0.05 || (previousMote?.alpha ?? 0) < 0.05) return;
          // Only the inflow motion and the smooth blend: a jump would be hundreds of px.
          expect(Math.hypot(mote.x - (previousMote?.x ?? NaN), mote.y - (previousMote?.y ?? NaN)), `${previous}>${scene} #${index} t=${time.toFixed(3)}`).toBeLessThan(40);
        });
        last = motes;
      }
    }
  });
});

describe("path of the agents scene", () => {
  it("never runs a link of the path through a label (labels sit right of their node)", () => {
    for (const time of TIMES) {
      const frame = buildFrame({ time, state: still("agents"), viewport: WIDE });
      const labels = labelRects(frame.nodes, WIDE);
      for (const link of frame.links) {
        for (const rect of labels) {
          expect(segmentRectDistance(link.x1, link.y1, link.x2, link.y2, rect)).toBeGreaterThanOrEqual(LABEL.clearance);
        }
      }
    }
  });
});
