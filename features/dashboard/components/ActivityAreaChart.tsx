"use client";

import { curveMonotoneX } from "@visx/curve";
import { MotionConfig } from "motion/react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { Area, AreaChart } from "@/components/charts/bklit/area-chart";
import { Grid } from "@/components/charts/bklit/grid";
import { ChartTooltip } from "@/components/charts/bklit/tooltip";
import { XAxis } from "@/components/charts/bklit/x-axis";
import { useChartReady } from "@/components/charts/ChartReadyContext";
import { APP_TEXTS } from "@/components/texts";

import type { DashboardDailyPoint } from "../types";
import { axisTickCount, describeDay, integerGridTicks, maxOfSeries, toChartDays } from "./activity-chart";

const TEXTS = APP_TEXTS.dashboard.activity;
/** The chart's own entrance, at most 900 ms (docs §3.5.1.D). */
const ENTER_MS = 900;
const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
const MARGIN = { top: 12, right: 8, bottom: 28, left: 8 };

export type ActivityAreaChartProps = {
  /** Exact daily counts, oldest first. Numbers and day labels only: no personal data. */
  points: readonly DashboardDailyPoint[];
};

/**
 * The area chart (Bklit UI) of the last 30 days. A client island because the
 * chart measures itself and follows the pointer; it only receives numbers.
 *
 * The SVG is hidden from assistive technology and doubled by the written
 * summary (`aria-label`), the table of values under the card and a live region
 * that reads the active day. Bklit's tooltip follows the pointer only, so the
 * keyboard is handled here: arrows move the active day, which is announced and
 * shown in a line under the chart.
 */
export function ActivityAreaChart({ points }: ActivityAreaChartProps) {
  const ready = useChartReady();
  const days = useMemo(() => toChartDays(points), [points]);
  const ticks = useMemo(() => integerGridTicks(maxOfSeries(points)), [points]);
  const [tickCount, setTickCount] = useState(7);
  const [active, setActive] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  // The chart only mounts after hydration (`ready`), so reading the media query here cannot mismatch.
  const reduced = ready && window.matchMedia(REDUCED_QUERY).matches;

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => setTickCount(axisTickCount(box.getBoundingClientRect().width));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  const totals = useMemo(
    () => ({
      received: points.reduce((sum, point) => sum + point.received, 0),
      qualified: points.reduce((sum, point) => sum + point.qualified, 0),
    }),
    [points],
  );

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const last = points.length - 1;
    const step = (to: number | null) => {
      event.preventDefault();
      setActive(to);
    };
    if (event.key === "ArrowRight") step(active === null ? 0 : Math.min(last, active + 1));
    else if (event.key === "ArrowLeft") step(active === null ? last : Math.max(0, active - 1));
    else if (event.key === "Home") step(0);
    else if (event.key === "End") step(last);
    else if (event.key === "Escape" && active !== null) step(null);
  }

  const activePoint = active === null ? null : (points[active] ?? null);

  return (
    <div>
      <div
        role="group"
        tabIndex={0}
        aria-label={TEXTS.chartLabel(totals.received, totals.qualified)}
        aria-describedby="activity-keyboard-hint"
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
        data-testid="activity-chart"
        className="rounded-lg"
      >
        {/* Same reserved height before and after the chart mounts: no layout shift. */}
        <div ref={boxRef} aria-hidden="true" className="aspect-16/10 w-full sm:aspect-3/1 xl:aspect-4/1">
          {ready ? (
            <MotionConfig reducedMotion="user">
              <AreaChart
                data={days}
                margin={MARGIN}
                animationDuration={reduced ? 0 : ENTER_MS}
                className="chart-scope h-full"
                style={{ aspectRatio: "auto" }}
              >
                <Grid horizontal vertical={false} rowTickValues={ticks} strokeDasharray="" fadeHorizontal={false} />
                <Area
                  dataKey="received"
                  curve={curveMonotoneX}
                  stroke="var(--chart-line-primary)"
                  fill="var(--chart-line-primary)"
                  fillOpacity={0.1}
                  strokeWidth={2}
                />
                <Area
                  dataKey="qualified"
                  curve={curveMonotoneX}
                  stroke="var(--chart-line-secondary)"
                  fill="var(--chart-line-secondary)"
                  fillOpacity={0.06}
                  strokeWidth={1.5}
                  dashFromIndex={0}
                  dashArray="4 3"
                />
                <XAxis numTicks={tickCount} />
                <ChartTooltip
                  showDatePill={false}
                  rows={(point) => [
                    { color: "var(--chart-line-primary)", label: TEXTS.receivedSeries, value: Number(point.received) },
                    { color: "var(--chart-line-secondary)", label: TEXTS.qualifiedSeries, value: Number(point.qualified) },
                  ]}
                />
              </AreaChart>
            </MotionConfig>
          ) : null}
        </div>
      </div>
      <p id="activity-keyboard-hint" className="sr-only">
        {TEXTS.keyboardHint}
      </p>
      <p aria-live="polite" data-testid="activity-live" className="mt-2 min-h-5 text-sm text-ink-muted">
        {activePoint ? describeDay(activePoint) : ""}
      </p>
    </div>
  );
}
