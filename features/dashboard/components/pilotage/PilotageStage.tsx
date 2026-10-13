"use client";

import dynamic from "next/dynamic";

import { APP_TEXTS } from "@/components/texts";
import { Overline } from "@/components/ui/Overline";
import { SimulationBadge } from "@/components/ui/SimulationBadge";

import { formatCount } from "./pilotage-format";
import type { PilotageView, StageView } from "./pilotage-view";
import { RollingFigure } from "./RollingFigure";
import { StageValuesTable } from "./StageValuesTable";

const TEXTS = APP_TEXTS.dashboard.pilotage;
const STAGE_TEXTS = TEXTS.stage;

/** Reserved at its final height: the chart arrives later and nothing moves (CLS 0). */
const CHART_BOX = "h-64 sm:h-72 lg:h-80 xl:h-88";
const DASHES = "repeating-linear-gradient(90deg, var(--color-stage-line-muted) 0 4px, transparent 4px 7px)";

const StageChart = dynamic(() => import("./StageChart").then((module) => module.StageChart), {
  ssr: false,
  loading: () => <StageChartSkeleton />,
});

function StageChartSkeleton() {
  return (
    <div aria-hidden="true" data-testid="stage-chart-skeleton" className={`${CHART_BOX} flex flex-col justify-between py-4`}>
      {[0, 1, 2].map((row) => (
        <div key={row} className="h-px w-full bg-stage-grid" />
      ))}
    </div>
  );
}

export type PilotageStageProps = {
  view: PilotageView;
};

function Bars({ stage }: { stage: StageView }) {
  const widest = Math.max(stage.value, stage.previous, 1);
  const bar = (value: number) => `${Math.max(2, Math.round((value / widest) * 100))}%`;
  return (
    <div className="mt-6 flex max-w-72 flex-col gap-3" data-testid="stage-bars">
      <div>
        <div className="flex items-baseline justify-between gap-3 font-mono text-xs text-ink-inverse">
          <span>{STAGE_TEXTS.currentBar}</span>
          <span className="figure">{formatCount(stage.value)}</span>
        </div>
        <div className="mt-1.5 h-[3px] w-full">
          <div className="stage-bar h-full rounded-full bg-stage-line" style={{ width: bar(stage.value) }} />
        </div>
      </div>
      {stage.fairPrevious ? (
        <div>
          <div className="flex items-baseline justify-between gap-3 font-mono text-xs text-ink-inverse-muted">
            <span>{STAGE_TEXTS.previousBar}</span>
            <span className="figure">{formatCount(stage.previous)}</span>
          </div>
          <div className="mt-1.5 h-[3px] w-full">
            <div
              className="stage-bar h-full"
              style={{ width: bar(stage.previous), backgroundImage: DASHES, ["--stage-bar-delay" as string]: "500ms" }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Legend({ showPrevious }: { showPrevious: boolean }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-ink-inverse-muted" data-testid="stage-legend">
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className="h-0.5 w-5 rounded-full bg-stage-line" />
        {STAGE_TEXTS.currentBar}
      </li>
      {showPrevious ? (
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-0.5 w-5" style={{ backgroundImage: DASHES }} />
          {STAGE_TEXTS.previousBar}
        </li>
      ) : null}
    </ul>
  );
}

/**
 * « La Scène » (docs §3.5.2.E1): the one black band of the page. The giant figure,
 * its honest comparison, two bars and the course of the cumulative signed mandates
 * against the previous period (dashed). The text is in the server HTML; the chart
 * is a lazy island. A failed computation reads « Indisponible », never a zero.
 */
export function PilotageStage({ view }: PilotageStageProps) {
  const block = view.stage;
  const stage = block.status === "ok" ? block.value : null;
  const showPrevious = Boolean(stage?.fairPrevious);

  return (
    <section
      aria-labelledby="pilotage-stage-title"
      data-testid="pilotage-stage"
      data-status={block.status}
      className="stage-scope stage-texture relative overflow-hidden rounded-[1.25rem] bg-stage px-5 py-8 text-ink-inverse sm:rounded-3xl sm:px-8 sm:py-10 lg:px-10"
    >
      <h2 id="pilotage-stage-title" className="sr-only">
        {STAGE_TEXTS.unit}
      </h2>
      <div className="absolute top-5 right-5 z-10 sm:top-6 sm:right-6">
        <SimulationBadge surface="dark" />
      </div>

      <div className="relative grid gap-8 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] lg:gap-10">
        <div className="min-w-0">
          <Overline className="text-ink-inverse-muted" as="p">
            {STAGE_TEXTS.overline(view.eyebrow)}
          </Overline>

          {stage ? (
            <>
              <p className="mt-6 animate-rise leading-none" style={{ animationDelay: "120ms" }}>
                <RollingFigure
                  testId="stage-giant"
                  text={formatCount(stage.value)}
                  value={stage.value}
                  format={formatCount}
                  className="block text-pilotage-giant font-medium"
                />
              </p>
              <p className="mt-3 animate-rise text-base text-ink-inverse" style={{ animationDelay: "240ms" }}>
                {stage.value === 1 ? STAGE_TEXTS.unitOne : STAGE_TEXTS.unit}
                <span className="block text-sm text-ink-inverse-muted">{STAGE_TEXTS.human}</span>
              </p>
              <p
                data-testid="stage-comparison"
                className="figure mt-5 animate-rise text-sm leading-5 text-ink-inverse"
                style={{ animationDelay: "320ms" }}
              >
                {stage.comparison}
              </p>
              {stage.historyNote ? (
                <p data-testid="stage-history-note" className="mt-1 text-xs leading-5 text-ink-inverse-muted">
                  {stage.historyNote.charAt(0).toUpperCase() + stage.historyNote.slice(1)}
                </p>
              ) : null}
              <Bars stage={stage} />
            </>
          ) : (
            <div className="mt-6" data-testid="stage-unavailable">
              <p className="figure text-5xl font-medium">{TEXTS.unavailable}</p>
              <p className="mt-3 max-w-72 text-sm text-ink-inverse-muted">{TEXTS.unavailableHint}</p>
            </div>
          )}
        </div>

        <div data-swap="chart" className="min-w-0">
          {stage ? (
            stage.series === null ? (
              <p className="py-10 text-sm text-ink-inverse-muted" data-testid="stage-chart-unavailable">
                {TEXTS.unavailable} · {TEXTS.unavailableCalc}
              </p>
            ) : stage.series.emptyBoth ? (
              <div className={`${CHART_BOX} flex items-end border-b border-stage-tooltip-line pb-4`} data-testid="stage-empty">
                <p className="text-base text-ink-inverse">{STAGE_TEXTS.empty}</p>
              </div>
            ) : (
              <>
                <p className="mb-2 text-xs leading-5 text-ink-inverse-muted" data-testid="stage-scope">
                  {STAGE_TEXTS.chartScope(view.grain)}
                </p>
                <Legend showPrevious={showPrevious} />
                <div className={`${CHART_BOX} mt-3`}>
                  <StageChart
                    key={view.key}
                    points={stage.series.points}
                    showPrevious={showPrevious}
                    summary={STAGE_TEXTS.chartLabel(
                      view.announce,
                      stage.value,
                      showPrevious ? String(stage.previous) : TEXTS.comparison.unavailable,
                    )}
                  />
                </div>
                <StageValuesTable
                  points={stage.series.points}
                  showPrevious={showPrevious}
                  grainTitle={view.grainTitle}
                  period={view.announce}
                />
              </>
            )
          ) : null}
        </div>
      </div>
    </section>
  );
}
