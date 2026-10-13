"use client";

import { curveMonotoneX } from "@visx/curve";
import { MotionConfig } from "motion/react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { Area, AreaChart } from "@/components/charts/bklit/area-chart";
import { Grid } from "@/components/charts/bklit/grid";
import { ChartTooltip } from "@/components/charts/bklit/tooltip";
import { APP_TEXTS } from "@/components/texts";

import { prefersReducedMotion } from "./motion";
import { bucketDate, gridTicks, niceMax } from "./pilotage-format";
import type { StagePoint } from "./pilotage-view";
import { StageOverlay } from "./StageOverlay";

const TEXTS = APP_TEXTS.dashboard.pilotage.stage;
/** The curve draws in this time (docs §3.5.2.E1: 700 ms at the first load, 600 ms after a change of period). */
const DRAW_MS = 700;
const MARGIN = { top: 16, right: 56, bottom: 32, left: 32 };

export type StageChartProps = {
  points: readonly StagePoint[];
  showPrevious: boolean;
  /** Written in the `aria-label` of the group. */
  summary: string;
};

/** How many axis labels a plot of this width can carry without crowding. */
function labelBudget(width: number, count: number): number {
  if (width >= 640) return Math.min(count, count > 13 ? 7 : count);
  return Math.min(count, 4);
}

/**
 * The Scène's course chart (Bklit `AreaChart`): running total of signed mandates for
 * the period (solid, white, a dot per real point) and for the previous period (dashed,
 * muted, no dots). Client island, loaded with `next/dynamic`, so it only ever mounts
 * after hydration. The SVG is hidden from assistive technology and doubled by the
 * summary, the table of values and a live region; the keyboard moves a cursor.
 */
export function StageChart({ points, showPrevious, summary }: StageChartProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [active, setActive] = useState<number | null>(null);
  const reduced = useMemo(() => prefersReducedMotion(), []);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(() => setWidth(box.getBoundingClientRect().width));
    observer.observe(box);
    setWidth(box.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  const data = useMemo(
    () =>
      points.map((point) => ({
        date: bucketDate(point.bucketStart),
        cumCurrent: point.cumulative,
        cumPrevious: point.previousCumulative,
        signed: point.signed,
        previousSigned: point.previousSigned,
        long: point.long,
      })),
    [points],
  );
  const max = useMemo(
    () => Math.max(...points.map((p) => Math.max(p.cumulative, showPrevious ? p.previousCumulative : 0)), 0),
    [points, showPrevious],
  );
  const ticks = useMemo(() => gridTicks(max), [max]);
  const top = niceMax(max);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const last = points.length - 1;
    const go = (to: number | null) => {
      event.preventDefault();
      setActive(to);
    };
    if (event.key === "ArrowRight") go(active === null ? 0 : Math.min(last, active + 1));
    else if (event.key === "ArrowLeft") go(active === null ? last : Math.max(0, active - 1));
    else if (event.key === "Home") go(0);
    else if (event.key === "End") go(last);
    else if (event.key === "Escape" && active !== null) go(null);
  }

  const activePoint = active === null ? null : (points[active] ?? null);

  return (
    <div className="flex h-full flex-col">
      <div
        role="group"
        tabIndex={0}
        aria-label={summary}
        aria-describedby="stage-keyboard-hint"
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
        data-testid="stage-chart"
        data-points={points.length}
        className="min-h-0 flex-1 rounded-lg"
      >
        <div ref={boxRef} aria-hidden="true" className="chart-scope chart-scope-stage h-full">
          <MotionConfig reducedMotion="user">
            <AreaChart
              data={data}
              margin={MARGIN}
              animationDuration={reduced ? 0 : DRAW_MS}
              className="h-full"
              style={{ aspectRatio: "auto" }}
            >
              <Grid horizontal vertical={false} rowTickValues={ticks} strokeDasharray="" fadeHorizontal={false} />
              {showPrevious ? (
                <Area
                  dataKey="cumPrevious"
                  curve={curveMonotoneX}
                  stroke="var(--color-stage-line-muted)"
                  fill="var(--color-stage-line-muted)"
                  fillOpacity={0}
                  strokeWidth={1.5}
                  dashFromIndex={0}
                  dashArray="5 5"
                />
              ) : null}
              <Area
                dataKey="cumCurrent"
                curve={curveMonotoneX}
                stroke="var(--color-stage-line)"
                fill="var(--color-stage-line)"
                fillOpacity={0.1}
                strokeWidth={2.5}
              />
              <StageOverlay
                points={points}
                showPrevious={showPrevious}
                axisLabels={labelBudget(width, points.length)}
                ticks={ticks.filter((tick) => tick <= top)}
                activeIndex={active}
              />
              <ChartTooltip
                showDatePill={false}
                showDots={false}
                backgroundColor="var(--color-stage-tooltip)"
                content={({ index }) => {
                  const point = points[index];
                  if (!point) return null;
                  return (
                    <div className="min-w-48 px-3 py-2.5 text-[13px]" data-testid="stage-tooltip">
                      <p className="font-medium text-chart-tooltip-foreground">{point.long}</p>
                      <dl className="mt-1.5 space-y-1">
                        <Row label={TEXTS.tooltipSigned} value={String(point.signed)} />
                        <Row label={TEXTS.tooltipCumulative} value={String(point.cumulative)} />
                        {showPrevious ? (
                          <Row
                            label={TEXTS.tooltipPrevious}
                            value={TEXTS.tooltipPreviousValue(point.previousSigned, point.previousCumulative)}
                            muted
                          />
                        ) : null}
                      </dl>
                    </div>
                  );
                }}
              />
            </AreaChart>
          </MotionConfig>
        </div>
      </div>
      <p id="stage-keyboard-hint" className="sr-only">
        {TEXTS.keyboardHint}
      </p>
      <p aria-live="polite" data-testid="stage-live" className="min-h-5 pt-1 text-sm text-ink-inverse-muted">
        {activePoint
          ? TEXTS.live(
              activePoint.long,
              activePoint.signed,
              activePoint.cumulative,
              showPrevious ? TEXTS.liveWithPrevious(activePoint.previousSigned, activePoint.previousCumulative) : "",
            )
          : ""}
      </p>
    </div>
  );
}

function Row({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={muted ? "text-chart-tooltip-muted" : "text-chart-tooltip-foreground"}>{label}</dt>
      <dd className="figure text-chart-tooltip-foreground">{value}</dd>
    </div>
  );
}
