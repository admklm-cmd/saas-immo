import { describe, expect, it } from "vitest";

import { LANDING_TEXTS } from "@/components/landing-texts";

import {
  clampStep,
  isFirstStep,
  isLastStep,
  nearestStep,
  nextStepIndex,
  positionLabel,
  PROCESS_COUNT,
  PROCESS_STEPS,
  progressLabel,
  progressPercent,
  progressRatio,
  stepAnnouncement,
  stepLabel,
  stepName,
  stepPill,
  VISUAL_DURATIONS_MS,
} from "./process-carousel";

describe("process carousel — bounds", () => {
  it("has the seven steps of a dossier, in order, two of them human", () => {
    expect(PROCESS_COUNT).toBe(7);
    expect(PROCESS_STEPS.map(stepName)).toEqual([
      "Demande reçue · Léa",
      "Qualification · Hugo",
      "Relance préparée · Emma",
      "Validation humaine · Vous",
      "Rendez-vous · Louis",
      "Suivi · Sarah",
      "Mandat · Vous",
    ]);
    expect(PROCESS_STEPS.filter((step) => step.human).map((step) => step.key)).toEqual(["review", "mandate"]);
  });

  it("keeps the index inside the seven steps, without wrapping", () => {
    expect(clampStep(-3)).toBe(0);
    expect(clampStep(0)).toBe(0);
    expect(clampStep(3.4)).toBe(3);
    expect(clampStep(6)).toBe(6);
    expect(clampStep(42)).toBe(6);
    expect(clampStep(Number.NaN)).toBe(0);
    expect(isFirstStep(0)).toBe(true);
    expect(isFirstStep(1)).toBe(false);
    expect(isLastStep(6)).toBe(true);
    expect(isLastStep(5)).toBe(false);
  });

  it("maps the keys of the track: ← → move by one, Home / End go to the ends, others are ignored", () => {
    expect(nextStepIndex("ArrowRight", 0)).toBe(1);
    expect(nextStepIndex("ArrowLeft", 0)).toBe(0);
    expect(nextStepIndex("ArrowRight", 6)).toBe(6);
    expect(nextStepIndex("ArrowLeft", 4)).toBe(3);
    expect(nextStepIndex("Home", 5)).toBe(0);
    expect(nextStepIndex("End", 1)).toBe(6);
    expect(nextStepIndex("Enter", 2)).toBeNull();
    expect(nextStepIndex("ArrowDown", 2)).toBeNull();
  });

  it("finds the card closest to the centre from the scroll position", () => {
    expect(nearestStep(0, 400)).toBe(0);
    expect(nearestStep(199, 400)).toBe(0);
    expect(nearestStep(201, 400)).toBe(1);
    expect(nearestStep(2_400, 400)).toBe(6);
    expect(nearestStep(9_999, 400)).toBe(6);
    expect(nearestStep(300, 0)).toBe(0);
  });
});

describe("process carousel — computed progress", () => {
  it("gives 14 · 29 · 43 · 57 · 71 · 86 · 100, computed, never written in the copy", () => {
    expect(Array.from({ length: 7 }, (_, index) => progressPercent(index))).toEqual([14, 29, 43, 57, 71, 86, 100]);
    expect(progressRatio(0)).toBeCloseTo(1 / 7);
    expect(progressRatio(6)).toBe(1);
    expect(progressPercent(-1)).toBe(14);
    expect(progressPercent(12)).toBe(100);
    expect(progressLabel(1)).toBe("29 %");
    expect(JSON.stringify(LANDING_TEXTS.final)).not.toMatch(/%/);
  });
});

describe("process carousel — labels", () => {
  it("names the cards and the position for assistive technology", () => {
    expect(positionLabel(1)).toBe("Étape 2 sur 7");
    expect(stepLabel(1)).toBe("Étape 2 sur 7 : Qualification · Hugo");
    expect(stepAnnouncement(1)).toBe(`Étape 2 sur 7 : Qualification · Hugo. ${PROCESS_STEPS[1]!.body}`);
  });

  it("marks the two human steps on their pill", () => {
    expect(stepPill(0)).toBe("Étape n°1");
    expect(stepPill(3)).toBe("Étape n°4 · Humaine");
    expect(stepPill(6)).toBe("Étape n°7 · Humaine");
  });

  it("plays every visual once in at most 2 400 ms", () => {
    for (const step of PROCESS_STEPS) {
      expect(VISUAL_DURATIONS_MS[step.key], step.key).toBeGreaterThan(0);
      expect(VISUAL_DURATIONS_MS[step.key], step.key).toBeLessThanOrEqual(2_400);
    }
  });
});
