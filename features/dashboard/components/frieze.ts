import type { DashboardIndicator, DashboardPipeline, DashboardPipelineStage, DashboardTodo } from "../types";
import { listTotal } from "./list-total";

/**
 * Model of the pipeline frieze of `/dashboard` (docs/design-system.md §3.5).
 *
 * Pure: it only REARRANGES what `getDashboardSummary` already counted — the
 * exact count per stage, and the exact totals of three « À faire » lists — in
 * the order of the seller's journey. It computes no rate, no trend, no new
 * figure.
 *
 * The three human checkpoints sit where their list is defined in the journey:
 *   * `leads`      — inbound leads not processed yet: before « Nouveau »
 *                    (a lead becomes a dossier once processed);
 *   * `to-confirm` — proposed appointments of a contact at `qualifie`, `chaud`
 *                    or `rdv_planifie`: on the way into « RDV planifié »;
 *   * `to-close`   — confirmed appointments whose report is missing: between
 *                    « RDV planifié » and « Estimation faite ».
 */

export type FriezeStageStep = {
  kind: "stage";
  stage: Exclude<DashboardPipelineStage, "perdu">;
  count: DashboardIndicator<number>;
};

export type FriezeCheckpointId = "leads" | "to-confirm" | "to-close";

export type FriezeCheckpointStep = {
  kind: "checkpoint";
  id: FriezeCheckpointId;
  total: DashboardIndicator<number>;
  href: string;
};

export type FriezeStep = FriezeStageStep | FriezeCheckpointStep;

export type Frieze = {
  steps: FriezeStep[];
  /** `perdu`, set apart from the line. `null` if the summary does not carry it. */
  lost: { stage: "perdu"; count: DashboardIndicator<number> } | null;
};

/** Beyond this many dossiers, a stage draws this many dots and says so. */
export const FRIEZE_DOT_CAP = 40;

export const FRIEZE_CHECKPOINT_HREFS: Readonly<Record<FriezeCheckpointId, string>> = {
  leads: "/agents-ia/leads-entrants",
  "to-confirm": "/agents-ia/suivi-rendez-vous",
  "to-close": "/agents-ia/suivi-rendez-vous",
};

/** Where each checkpoint goes: before the stage named here. */
const CHECKPOINT_BEFORE: Readonly<Partial<Record<DashboardPipelineStage, FriezeCheckpointId>>> = {
  nouveau: "leads",
  rdv_planifie: "to-confirm",
  estimation_faite: "to-close",
};

export function buildFrieze(pipeline: DashboardPipeline, todo: DashboardTodo): Frieze {
  const totals: Record<FriezeCheckpointId, DashboardIndicator<number>> = {
    leads: listTotal(todo.inboundLeadsToProcess),
    "to-confirm": listTotal(todo.appointmentsToConfirm),
    "to-close": listTotal(todo.appointmentsToClose),
  };

  const steps: FriezeStep[] = [];
  let lost: Frieze["lost"] = null;

  for (const { stage, count } of pipeline.stages) {
    if (stage === "perdu") {
      lost = { stage, count };
      continue;
    }
    const checkpoint = CHECKPOINT_BEFORE[stage];
    if (checkpoint) {
      steps.push({ kind: "checkpoint", id: checkpoint, total: totals[checkpoint], href: FRIEZE_CHECKPOINT_HREFS[checkpoint] });
    }
    steps.push({ kind: "stage", stage, count });
  }

  return { steps, lost };
}

/** Dots per column of the desktop bars: beyond, a stage starts a new column. */
export const FRIEZE_COLUMN_ROWS = 10;

/**
 * Height of the bars band, in dot rows: the tallest bar actually drawn (at
 * least 1, at most `FRIEZE_COLUMN_ROWS`). The band is never taller than the data.
 */
export function friezeRows(frieze: Frieze): number {
  const tallest = Math.max(0, ...frieze.steps.map((step) => (step.kind === "stage" ? friezeDots(step.count).drawn : 0)));
  return Math.min(FRIEZE_COLUMN_ROWS, Math.max(1, tallest));
}

/** How many dots a count draws: one per dossier, capped. */
export function friezeDots(count: DashboardIndicator<number>): { drawn: number; capped: boolean } {
  if (count.status !== "ok") return { drawn: 0, capped: false };
  const value = Math.max(0, count.value);
  return { drawn: Math.min(value, FRIEZE_DOT_CAP), capped: value > FRIEZE_DOT_CAP };
}
