import { APP_TEXTS } from "@/components/texts";
import { PIPELINE_STAGE_LABELS } from "@/features/contacts/types";

import type { PipelineFunnel, PipelineFunnelStep } from "../types";

/**
 * Pure helpers of the « Passage d'une étape à l'autre » card. The rates come
 * from the database as exact ratios (0..1, not rounded); they are rounded here,
 * once, for display — with one rule for the whole screen: `Math.round`, half up.
 * Nothing is recomputed from rounded values.
 */

const TEXTS = APP_TEXTS.pipeline.funnel;
const NARROW_NBSP = "\u202F";
const number = new Intl.NumberFormat("fr-FR");

/** `0.6309` → « 63 % » (thin no-break space before %). `null` → « — ». */
export function formatRate(rate: number | null): string {
  if (rate === null || !Number.isFinite(rate)) return TEXTS.noRate;
  return `${number.format(Math.round(rate * 100))}${NARROW_NBSP}%`;
}

export function stageLabel(step: Pick<PipelineFunnelStep, "stage">): string {
  return PIPELINE_STAGE_LABELS[step.stage];
}

/** One slice of the funnel, with every text it needs already written. */
export type FunnelSlice = {
  stage: PipelineFunnelStep["stage"];
  label: string;
  reached: number;
  /** Rate from the previous slice, written (« 63 % » or « — »); `null` for the first slice. */
  rate: string | null;
  /** Accessible name of the rate between this slice and the previous one. */
  rateName: string | null;
  /** « 63 sur 84 dossiers » — the raw numbers behind the pass rate to the next slice; `null` when it has none. */
  ratioToNext: string | null;
  /** Written, for the tooltip and the live region: « 75 % passent à « Chaud » », or `null` (last slice, or no rate). */
  passToNext: string | null;
};

export function buildSlices(funnel: PipelineFunnel): FunnelSlice[] {
  return funnel.steps.map((step, index) => {
    const previous = funnel.steps[index - 1];
    const next = funnel.steps[index + 1];
    const label = stageLabel(step);
    const rate = previous ? formatRate(step.rateFromPrevious) : null;
    return {
      stage: step.stage,
      label,
      reached: step.reached,
      rate,
      rateName:
        previous && rate !== null
          ? step.rateFromPrevious === null
            ? TEXTS.rateNameEmpty(stageLabel(previous), label)
            : TEXTS.rateName(rate, stageLabel(previous), label)
          : null,
      ratioToNext: next && next.rateFromPrevious !== null ? TEXTS.ratio(next.reached, step.reached) : null,
      passToNext: next && next.rateFromPrevious !== null ? TEXTS.tooltipPass(formatRate(next.rateFromPrevious), stageLabel(next)) : null,
    };
  });
}

/** The funnel counts only a first slice at 0 (and so nothing else): no dossier at all. */
export function isEmptyFunnel(funnel: PipelineFunnel): boolean {
  return funnel.total === 0;
}

/** Text of the live region: the active stage, its count and its pass rate to the next one. */
export function describeSlice(slice: FunnelSlice): string {
  return TEXTS.liveStage(slice.label, slice.reached, slice.passToNext);
}

/** Text of `aria-label` of the whole graphic: every stage with its count. */
export function funnelAriaLabel(slices: readonly FunnelSlice[]): string {
  return TEXTS.chartLabel(slices.map((slice) => TEXTS.chartLabelPart(slice.label, slice.reached)).join(" "));
}
