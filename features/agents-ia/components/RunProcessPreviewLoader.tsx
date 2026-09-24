import { cache, Suspense } from "react";

import { APP_TEXTS } from "@/components/texts";
import { getRunSteps } from "@/features/agents-ia/queries";

import { AgentRunProcessPreview } from "./AgentRunProcessPreview";
import { replayStepsFromView } from "./replay";

const TEXTS = APP_TEXTS.runProcess;

/**
 * One read per run and per request: the same run can be listed several times
 * on the screen (last run of an agent, recent issues, journal).
 */
const readRunSteps = cache(getRunSteps);

async function RunProcessPreviewContent({ runId }: { runId: string }) {
  const { data, error } = await readRunSteps(runId);
  if (error) {
    // The server's French message, as-is: nothing is drawn in place of the steps.
    return (
      <p className="text-sm text-ink-muted" data-testid="run-process-unavailable">
        <span className="font-medium text-ink">{TEXTS.unavailableTitle} : </span>
        {error.message}
      </p>
    );
  }
  return <AgentRunProcessPreview steps={replayStepsFromView(data.steps)} runStatus={data.run.status} />;
}

/**
 * Server read of the recorded steps of one run, streamed: the page is never
 * held back by the previews, each one arrives when its read is done.
 */
export function RunProcessPreviewLoader({ runId }: { runId: string }) {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-ink-muted" aria-busy="true">
          {TEXTS.loading}
        </p>
      }
    >
      <RunProcessPreviewContent runId={runId} />
    </Suspense>
  );
}
