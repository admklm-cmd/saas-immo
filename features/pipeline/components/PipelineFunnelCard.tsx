import { ChartStage } from "@/components/charts/ChartStage";
import { Icon } from "@/components/icons/Icon";
import { APP_TEXTS } from "@/components/texts";
import { Card } from "@/components/ui/Card";
import { SimulationBadge } from "@/components/ui/SimulationBadge";

import type { PipelineFunnel } from "../types";
import { buildSlices, isEmptyFunnel } from "./funnel-chart";
import { PipelineFunnelChart } from "./PipelineFunnelChart";
import { PipelineFunnelTable } from "./PipelineFunnelTable";

const TEXTS = APP_TEXTS.pipeline.funnel;

export type PipelineFunnelCardProps = {
  /** `null` when the read itself failed: shown as « Indisponible », never as zeros. */
  funnel: PipelineFunnel | null;
};

/**
 * « Passage d'une étape à l'autre » (docs/design-system.md §3.5.1.B): how many
 * dossiers reached each stage and what share goes on to the next. A Server
 * Component: title, scope, lost row, table of values are in the HTML; the
 * funnel itself is a client island. Counts and ratios are the database's;
 * « Perdus » is counted apart, outside the funnel.
 */
export function PipelineFunnelCard({ funnel }: PipelineFunnelCardProps) {
  const empty = funnel !== null && isEmptyFunnel(funnel);
  const slices = funnel && !empty ? buildSlices(funnel) : [];
  const hasUncomputableRate = funnel !== null && funnel.steps.some((step, i) => i > 0 && step.rateFromPrevious === null);

  return (
    <section aria-labelledby="pipeline-funnel-title" data-testid="pipeline-funnel">
      <ChartStage>
        <Card
          title={<span id="pipeline-funnel-title">{TEXTS.title}</span>}
          description={TEXTS.scope}
          actions={<SimulationBadge />}
          headingLevel={2}
        >
          {funnel === null ? (
            <div data-testid="funnel-unavailable" role="status">
              <p className="text-heading font-semibold text-ink">{TEXTS.unavailableTitle}</p>
              <p className="mt-1 text-sm text-ink-muted">{TEXTS.unavailableBody}</p>
            </div>
          ) : empty ? (
            <p data-testid="funnel-empty" className="flex items-center gap-2.5 text-sm text-ink-subtle">
              <span
                aria-hidden="true"
                className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-line-strong text-xs text-ink-muted"
              >
                <Icon name="check" px="0.75rem" />
              </span>
              {TEXTS.empty}
            </p>
          ) : (
            <div className="flex flex-col gap-5">
              <PipelineFunnelChart slices={slices} />
              {hasUncomputableRate ? (
                <p className="text-xs text-ink-subtle" data-testid="funnel-not-computable">
                  {TEXTS.notComputable}
                </p>
              ) : null}
              <div
                data-testid="funnel-lost"
                className="flex flex-col gap-1 rounded-xl border border-dashed border-line-strong bg-surface-muted px-4 py-3 sm:flex-row sm:items-baseline sm:gap-x-4"
              >
                <p className="shrink-0 text-base font-semibold whitespace-nowrap text-ink-subtle">
                  {TEXTS.lostLabel} : <span className="figure text-heading text-ink-muted">{funnel.lost.total}</span>
                </p>
                <p className="text-xs text-ink-subtle">
                  {TEXTS.lostNote}
                  {funnel.lost.untraced > 0 ? ` ${TEXTS.lostUntraced(funnel.lost.untraced)}` : ""}
                </p>
              </div>
              <p className="text-xs text-ink-subtle">{TEXTS.finding}</p>
              <PipelineFunnelTable slices={slices} />
            </div>
          )}
        </Card>
      </ChartStage>
    </section>
  );
}
