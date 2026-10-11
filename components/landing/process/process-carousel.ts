/**
 * Pure logic of the process carousel of block C (docs/design-system.md
 * §2.11.8.5), unit-tested without a browser (`process-carousel.test.ts`):
 * bounded index, keyboard map, computed progress, labels and the duration of
 * each visual. Nothing here scrolls nor moves on its own.
 */

import { LANDING_TEXTS } from "@/components/landing-texts";

const TEXTS = LANDING_TEXTS.final;

export type ProcessStep = (typeof TEXTS.steps)[number];
export type ProcessStepKey = ProcessStep["key"];

export const PROCESS_STEPS: readonly ProcessStep[] = TEXTS.steps;
export const PROCESS_COUNT = PROCESS_STEPS.length;

/**
 * Time a visual takes to play once, from its activation to its final state
 * (ms, ≤ 2 400 — §2.11.8.5 « Mouvement »). The carousel marks it `done` then.
 */
export const VISUAL_DURATIONS_MS: Readonly<Record<ProcessStepKey, number>> = {
  lea: 2_400,
  hugo: 1_700,
  emma: 1_700,
  review: 1_500,
  louis: 1_600,
  sarah: 1_400,
  mandate: 2_200,
};

/** The index, kept inside the seven steps (no wrap-around: first and last are ends). */
export function clampStep(index: number, count = PROCESS_COUNT): number {
  if (!Number.isFinite(index)) return 0;
  return Math.min(Math.max(Math.round(index), 0), count - 1);
}

/** Position read by the progress bar, as a share of the journey (`(i + 1) / 7`). */
export function progressRatio(index: number, count = PROCESS_COUNT): number {
  return (clampStep(index, count) + 1) / count;
}

/** The computed percentage: 14, 29, 43, 57, 71, 86, 100. */
export function progressPercent(index: number, count = PROCESS_COUNT): number {
  return Math.round(progressRatio(index, count) * 100);
}

/** « 14 % », with the narrow no-break space of French typography. */
export function progressLabel(index: number, count = PROCESS_COUNT): string {
  return `${progressPercent(index, count)} %`;
}

/** Target of a key on the track (← → Home End), `null` for any other key. */
export function nextStepIndex(key: string, current: number, count = PROCESS_COUNT): number | null {
  switch (key) {
    case "ArrowLeft":
      return clampStep(current - 1, count);
    case "ArrowRight":
      return clampStep(current + 1, count);
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

export function isFirstStep(index: number): boolean {
  return clampStep(index) === 0;
}

export function isLastStep(index: number, count = PROCESS_COUNT): boolean {
  return clampStep(index, count) === count - 1;
}

/** « Qualification · Hugo ». */
export function stepName(step: ProcessStep): string {
  return `${step.title} · ${step.owner}`;
}

/** « Étape 2 sur 7 ». */
export function positionLabel(index: number): string {
  return TEXTS.carousel.position.replace("{n}", String(clampStep(index) + 1));
}

/** Accessible name of a card: « Étape 2 sur 7 : Qualification · Hugo ». */
export function stepLabel(index: number): string {
  const step = PROCESS_STEPS[clampStep(index)] ?? PROCESS_STEPS[0]!;
  return `${positionLabel(index)} : ${stepName(step)}`;
}

/** The polite announcement after a change made by the user: name, then paragraph. */
export function stepAnnouncement(index: number): string {
  const step = PROCESS_STEPS[clampStep(index)] ?? PROCESS_STEPS[0]!;
  return `${stepLabel(index)}. ${step.body}`;
}

/** Pill of the card: « ÉTAPE N°4 · HUMAINE » (written in capitals by CSS). */
export function stepPill(index: number): string {
  const step = PROCESS_STEPS[clampStep(index)] ?? PROCESS_STEPS[0]!;
  const base = `${TEXTS.carousel.stepPrefix}${clampStep(index) + 1}`;
  return step.human ? `${base} · ${TEXTS.carousel.human}` : base;
}

/**
 * The card closest to the centre of the track, from its scroll position: the
 * track is padded so that the card `i` is centred at `scrollLeft = i × step`.
 */
export function nearestStep(scrollLeft: number, step: number, count = PROCESS_COUNT): number {
  if (!(step > 0)) return 0;
  return clampStep(scrollLeft / step, count);
}
