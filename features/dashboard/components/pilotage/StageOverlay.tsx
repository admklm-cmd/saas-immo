"use client";

import { animate } from "./pilotage-motion";
import { useEffect, useRef } from "react";

import { useChartStable, useYScale } from "@/components/charts/bklit/chart-context";

import { prefersReducedMotion } from "./motion";
import { axisIndexes, bucketDate } from "./pilotage-format";
import type { StagePoint } from "./pilotage-view";

const END_DELAY_MS = 760;
const END_FADE_MS = 200;

export type StageOverlayProps = {
  points: readonly StagePoint[];
  showPrevious: boolean;
  /** How many axis labels the width allows. */
  axisLabels: number;
  ticks: readonly number[];
  /** The point the keyboard (or the pointer) is on. */
  activeIndex: number | null;
};

/**
 * What the Bklit area chart does not draw the way the Scène needs (docs §3.5.2.E1):
 * axis labels anchored `start` / `end` at the two ends (never cut), whole-number
 * marks on the Y axis, a 3 px dot per real point, the cobalt ring and the written
 * value at the end of each curve, and the keyboard cursor. SVG children of the chart,
 * drawn in its plot box.
 */
export function StageOverlay({ points, showPrevious, axisLabels, ticks, activeIndex }: StageOverlayProps) {
  const { xScale, innerHeight } = useChartStable();
  const yScale = useYScale();
  const endRef = useRef<SVGGElement>(null);

  // The written end values and the cobalt ring arrive once the curve is drawn (docs §3.5.2.E1: t = 1 s).
  useEffect(() => {
    const el = endRef.current;
    if (!el || prefersReducedMotion()) return;
    el.style.opacity = "0";
    const animation = animate(el, { opacity: 1, duration: END_FADE_MS, delay: END_DELAY_MS, ease: "outQuad" });
    return () => {
      animation.pause();
      el.style.removeProperty("opacity");
    };
  }, []);

  if (points.length === 0) return null;

  const xs = points.map((point) => xScale(bucketDate(point.bucketStart)));
  const xAt = (index: number): number => xs[index] ?? 0;
  const last = points.length - 1;
  const lastPoint = points[last];
  if (!lastPoint) return null;
  const shown = axisIndexes(points.length, axisLabels);
  const active = activeIndex === null ? null : points[activeIndex];

  return (
    <g data-testid="stage-overlay">
      {ticks.map((tick) => (
        <text
          key={tick}
          x={-10}
          y={yScale(tick)}
          dy="0.35em"
          textAnchor="end"
          className="fill-chart-label font-mono text-[11px] tabular-nums"
        >
          {tick}
        </text>
      ))}

      {shown.map((index) => (
        <text
          key={`${points[index]?.bucketStart}-${index}`}
          x={xAt(index)}
          y={innerHeight + 22}
          textAnchor={index === 0 ? "start" : index === last ? "end" : "middle"}
          className="fill-chart-label text-[11px]"
        >
          {points[index]?.axis}
        </text>
      ))}

      {points.map((point, index) => (
        <circle key={point.bucketStart} cx={xAt(index)} cy={yScale(point.cumulative)} r={3} className="fill-(--color-stage-line)" />
      ))}

      {active && activeIndex !== null ? (
        <g data-testid="stage-cursor">
          <line
            x1={xAt(activeIndex)}
            x2={xAt(activeIndex)}
            y1={0}
            y2={innerHeight}
            stroke="var(--color-stage-line)"
            strokeOpacity={0.3}
          />
          <circle cx={xAt(activeIndex)} cy={yScale(active.cumulative)} r={5} className="fill-(--color-stage-line)" />
        </g>
      ) : null}

      <g data-stage-end ref={endRef}>
        <circle
          cx={xAt(last)}
          cy={yScale(lastPoint.cumulative)}
          r={6}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={1.5}
          data-testid="stage-end-ring"
        />
        <text
          x={xAt(last) + 14}
          y={yScale(lastPoint.cumulative)}
          dy="0.35em"
          className="fill-(--color-stage-line) font-mono text-[13px] tabular-nums"
        >
          {lastPoint.cumulative}
        </text>
        {showPrevious ? (
          <text
            x={xAt(last) + 14}
            y={yScale(lastPoint.previousCumulative) + (Math.abs(yScale(lastPoint.previousCumulative) - yScale(lastPoint.cumulative)) < 14 ? 14 : 0)}
            dy="0.35em"
            className="fill-(--color-stage-line-muted) font-mono text-[13px] tabular-nums"
          >
            {lastPoint.previousCumulative}
          </text>
        ) : null}
      </g>
    </g>
  );
}
