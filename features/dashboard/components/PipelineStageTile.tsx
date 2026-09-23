import { APP_TEXTS } from "@/components/texts";
import { PipelineStageBadge } from "@/components/ui/PipelineStageBadge";

import type { DashboardPipeline } from "../types";
import { DashboardFigure } from "./DashboardFigure";

const TEXTS = APP_TEXTS.dashboard;

/**
 * One stage of the pipeline summary.
 *
 * Active stages are tiles of the six-column grid. `perdu` is a single, full
 * width row under a light divider: dashed, muted, figure in the same size as
 * the tiles but read on one line — set apart, never an orphan tile. Never
 * colour-only.
 */
export function PipelineStageTile({ stage }: { stage: DashboardPipeline["stages"][number] }) {
  const lost = stage.stage === "perdu";

  if (lost) {
    return (
      <li
        data-testid={`dashboard-stage-${stage.stage}`}
        className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-dashed border-line-strong bg-surface-muted px-4 py-3"
      >
        <PipelineStageBadge stage={stage.stage} />
        <DashboardFigure
          indicator={stage.count}
          unit={TEXTS.pipelineUnit}
          size="md"
          muted
          showUnavailableHint={false}
        />
        <p className="text-xs text-ink-subtle sm:ml-auto">{TEXTS.pipelineLostNote}</p>
      </li>
    );
  }

  return (
    <li
      data-testid={`dashboard-stage-${stage.stage}`}
      className="min-w-0 rounded-lg border border-line bg-surface p-3 sm:p-4"
    >
      <PipelineStageBadge stage={stage.stage} />
      <DashboardFigure
        indicator={stage.count}
        unit={TEXTS.pipelineUnit}
        size="md"
        showUnavailableHint={false}
        className="mt-3"
      />
    </li>
  );
}
