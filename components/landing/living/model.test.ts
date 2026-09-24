import { describe, expect, it } from "vitest";

import { LANDING_TEXTS } from "@/components/landing-texts";

import { buildFrame, displayedPoints, scenePoints, STATIC_TIME } from "./model";
import { LIVING_SCENES, STOP_COUNT } from "./scenes";
import type { Frame, SceneState, Viewport } from "./types";

const WIDE: Viewport = { width: 1440, height: 900, compact: false };
const COMPACT: Viewport = { width: 390, height: 844, compact: true };

function still(scene: SceneState["scene"]): SceneState {
  return { scene, since: 0, previous: null, from: null };
}

function finite(frame: Frame): boolean {
  const values = [
    ...frame.nodes.flatMap((node) => [node.x, node.y, node.alpha, node.activity]),
    ...frame.links.flatMap((link) => [link.x1, link.y1, link.x2, link.y2, link.alpha]),
    ...frame.tokens.flatMap((token) => [token.x, token.y, token.alpha]),
    ...frame.motes.flatMap((mote) => [mote.x, mote.y, mote.r, mote.alpha]),
  ];
  return values.every(Number.isFinite);
}

describe("scenePoints", () => {
  it("places the eight stops inside the viewport for every scene", () => {
    for (const scene of LIVING_SCENES) {
      for (const viewport of [WIDE, COMPACT]) {
        const points = scenePoints(scene, viewport, 3);
        expect(points).toHaveLength(STOP_COUNT * 2);
        expect(points.every(Number.isFinite)).toBe(true);
      }
    }
  });
});

describe("displayedPoints", () => {
  it("starts from the previous layout and reaches the new one", () => {
    const from = scenePoints("hero", WIDE, 0);
    const state: SceneState = { scene: "agents", since: 10, previous: "hero", from };
    const close = (actual: number[], expected: number[]) =>
      actual.forEach((value, index) => expect(value).toBeCloseTo(expected[index] ?? NaN, 6));
    close(displayedPoints(state, WIDE, 10), from);
    close(displayedPoints(state, WIDE, 20), scenePoints("agents", WIDE, 20));
  });
});

describe("buildFrame", () => {
  it("is deterministic: the same instant always draws the same frame", () => {
    const input = { time: 12.5, state: still("solution"), viewport: WIDE };
    expect(buildFrame(input)).toEqual(buildFrame(input));
  });

  it("produces only finite values, for every scene, wide and compact", () => {
    for (const scene of LIVING_SCENES) {
      for (const viewport of [WIDE, COMPACT]) {
        expect(finite(buildFrame({ time: STATIC_TIME, state: still(scene), viewport }))).toBe(true);
      }
    }
  });

  it("draws the full path, labelled with the agents and the human gate on wide screens", () => {
    const frame = buildFrame({ time: STATIC_TIME, state: still("hero"), viewport: WIDE });
    const labels = frame.nodes.map((node) => node.label).filter(Boolean);
    expect(labels).toEqual(
      expect.arrayContaining([...LANDING_TEXTS.living.agents, LANDING_TEXTS.living.gate, LANDING_TEXTS.living.goal]),
    );
  });

  it("keeps the compact version quiet: no label, at most three fragments", () => {
    const frame = buildFrame({ time: STATIC_TIME, state: still("hero"), viewport: COMPACT });
    expect(frame.nodes.every((node) => node.label === null)).toBe(true);
    expect(frame.fragments.length).toBeLessThanOrEqual(3);
  });

  it("paints only generic fragments: no name, no figure", () => {
    const allowed = new Set<string>(Object.values(LANDING_TEXTS.living.fragments));
    for (const scene of LIVING_SCENES) {
      for (let time = 0; time < 60; time += 1.7) {
        for (const fragment of buildFrame({ time, state: still(scene), viewport: WIDE }).fragments) {
          expect(allowed.has(fragment.text)).toBe(true);
        }
      }
    }
  });
});
