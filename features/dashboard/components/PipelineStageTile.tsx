import { APP_TEXTS } from "@/components/texts";
import { cn } from "@/components/ui/cn";
import { PipelineStageBadge } from "@/components/ui/PipelineStageBadge";

import type { DashboardPipeline } from "../types";
import { DashboardFigure } from "./DashboardFigure";

const TEXTS = APP_TEXTS.dashboard;

/** One stage of the pipeline summary. `perdu` is dashed and muted — never colour-only. */
export function PipelineStageTile({ stage }: { stage: DashboardPipeline["stages"][number] }) {
  const lost = stage.stage === "perdu";
  return (
    <li
      data-testid={`dashboard-stage-${stage.stage}`}
      className={cn(
        "rounded-lg border p-4",
        lost ? "border-dashed border-line-strong bg-surface-muted" : "border-line bg-surface",
      )}
    >
      <PipelineStageBadge stage={stage.stage} />
      <DashboardFigure
        indicator={stage.count}
        unit={TEXTS.pipelineUnit}
        size="md"
        muted={lost}
        showUnavailableHint={false}
        className="mt-3"
      />
      {lost ? <p className="mt-2 text-xs text-ink-subtle">{TEXTS.pipelineLostNote}</p> : null}
    </li>
  );
}
