import Link from "next/link";

import { APP_TEXTS } from "@/components/texts";
import { Card } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";

import type { DashboardPipeline } from "../types";
import { ITEM_LINK_CLASS } from "./link-styles";
import { PipelineStageTile } from "./PipelineStageTile";

const TEXTS = APP_TEXTS.dashboard;

/**
 * « Pipeline » — one exact count per stage. `perdu` is set apart and
 * de-emphasised (dashed, muted) on one full-width row under a light divider,
 * like on `/pipeline`. A stage whose
 * count failed reads « Indisponible »; the other stages stay.
 */
export function PipelineSummary({ pipeline }: { pipeline: DashboardPipeline }) {
  const active = pipeline.stages.filter((stage) => stage.stage !== "perdu");
  const lost = pipeline.stages.filter((stage) => stage.stage === "perdu");

  return (
    <Card
      title={TEXTS.pipelineTitle}
      description={TEXTS.pipelineSubtitle}
      testId="dashboard-pipeline"
      actions={
        <Link href="/pipeline" className={cn(ITEM_LINK_CLASS, "text-sm")}>
          {TEXTS.pipelineLink}
        </Link>
      }
    >
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {active.map((stage) => (
          <PipelineStageTile key={stage.stage} stage={stage} />
        ))}
      </ul>
      {lost.length > 0 ? (
        <ul className="mt-4 border-t border-line pt-4">
          {lost.map((stage) => (
            <PipelineStageTile key={stage.stage} stage={stage} />
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
