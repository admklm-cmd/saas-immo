import { APP_TEXTS } from "@/components/texts";
import { cn } from "@/components/ui/cn";
import { PIPELINE_STAGE_LABELS } from "@/features/contacts/types";
import { AgentAppIcon } from "@/features/agents-ia/components/icons/AgentAppIcon";

import type { FriezeStageStep } from "./frieze";
import { friezeDots } from "./frieze";
import { FriezeDots } from "./FriezeDots";
import { FriezeRail } from "./FriezeRail";
import styles from "./PipelineFrieze.module.css";

const TEXTS = APP_TEXTS.dashboard;

/**
 * One stage of the frieze: its dossiers as dots, its node on the line, its
 * label and its exact count. « Mandat signé » ends the line with the outcome
 * shape of the family (filled circle, double contour) and says who seals it.
 */
export function FriezeStage({ step, last = false }: { step: FriezeStageStep; last?: boolean }) {
  const outcome = step.stage === "mandat_signe";
  const value = step.count.status === "ok" ? step.count.value : null;
  const { capped, drawn } = friezeDots(step.count);

  return (
    <li
      data-testid={`dashboard-stage-${step.stage}`}
      className={cn(styles.stage, "relative flex min-w-0 xl:flex-1 xl:flex-col")}
    >
      <FriezeRail last={last}>
        {outcome ? (
          <AgentAppIcon glyph="mandate" kind="outcome" size="sm" />
        ) : (
          <span className={cn(styles.node, "block size-2.5 rounded-full border-[1.5px] border-ink-subtle bg-surface")} />
        )}
      </FriezeRail>

      {/* Label first in the reading order; the figure is drawn above it from 1280 px. */}
      <div className="order-2 flex min-w-0 flex-col justify-center gap-0.5 py-3 pl-3 xl:order-3 xl:flex-col-reverse xl:items-center xl:justify-end xl:gap-1 xl:px-1 xl:pt-3 xl:pb-0 xl:text-center">
        <p className={cn("text-sm text-ink", outcome ? "font-semibold" : "font-medium")}>
          {PIPELINE_STAGE_LABELS[step.stage]}
          {outcome ? <span className="block text-xs font-normal text-ink-subtle">{TEXTS.friezeMandateNote}</span> : null}
        </p>
        <div data-testid="dashboard-figure" data-status={step.count.status}>
          <p className="flex items-baseline gap-1.5 xl:justify-center">
            {value !== null ? (
              <>
                <span className="text-heading font-semibold text-ink tabular-nums xl:text-hero">
                  {value}
                </span>
                <span className="text-xs text-ink-muted">
                  {TEXTS.pipelineUnit(value)}
                </span>
              </>
            ) : (
              <span className="text-sm font-semibold text-ink">{TEXTS.unavailable}</span>
            )}
          </p>
          <span className="sr-only">
            {TEXTS.scopePrefix} {TEXTS.scopes[step.count.scope.key]}
          </span>
          {capped ? <p className="text-xs text-ink-subtle">{TEXTS.friezeCapped(drawn)}</p> : null}
        </div>
      </div>

      <div className="order-3 ml-auto flex items-center py-3 pl-4 xl:order-1 xl:ml-0 xl:h-[calc(var(--frieze-rows,10)*0.875rem+1.5rem)] xl:items-end xl:justify-center xl:py-0 xl:pb-3 xl:pl-0">
        {value !== null ? (
          <FriezeDots count={step.count} tone={outcome ? "outcome" : "default"} />
        ) : (
          <span aria-hidden="true" className="block h-8 w-2 rounded-full border border-dashed border-line-strong" />
        )}
      </div>
    </li>
  );
}
