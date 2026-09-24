import type { CSSProperties } from "react";

import { LANDING_TEXTS } from "@/components/landing-texts";
import { cn } from "@/components/ui/cn";

import styles from "./BlockerChart.module.css";
import {
  AREA_PATH,
  CAPACITY_DELAY_MS,
  CAPACITY_MARKER,
  causeOfEvent,
  CURVE_DELAY_MS,
  CURVE_DURATION_MS,
  CURVE_PATH,
  eventDelayMs,
  eventPoint,
  EXPECTED_PATH,
  FRICTION_DELAY_MS,
  FRICTION_PATH,
  FRICTION_START,
  isEarlyEvent,
  labelAlign,
  labelPoint,
  PROBLEM_EVENTS,
  VIEW,
  xAt,
} from "./problem/problem-scene";

const TEXTS = LANDING_TEXTS.problem.chart;

const percentX = (x: number) => `${(x / VIEW.width) * 100}%`;
const percentY = (y: number) => `${(y / VIEW.height) * 100}%`;
const ms = (value: number) => `${value}ms`;

const TIMING = {
  "--curve-delay": ms(CURVE_DELAY_MS),
  "--curve-duration": ms(CURVE_DURATION_MS),
  "--friction-delay": ms(FRICTION_DELAY_MS),
  "--capacity-delay": ms(CAPACITY_DELAY_MS),
} as CSSProperties;

/**
 * Illustration of the problem section: mandates progress, administrative
 * events accumulate in the friction zone, the curve plateaus far below the
 * progression it should have kept. The gap is named « Capacité absorbée par
 * l'administratif ». No axis, no tick, no figure: only the discreet words
 * « Mandats » and « Temps ». Labelled « Illustration — exemple fictif ».
 *
 * Server Component. The SVG draws the shapes; the words are HTML placed over
 * it, so they keep a readable size on a phone. The whole scene is one image
 * for assistive technology (`role="img"` + written description). Each event
 * carries `data-cause`: `ProblemSystem` (client) highlights the events of the
 * cause hovered or focused next to it. The drawing sequence is driven by the
 * enclosing `Reveal`; without JavaScript or under reduced motion the final
 * state is shown at once.
 */
export function BlockerChart() {
  return (
    <figure data-testid="blocker-chart" className="flex h-full min-w-0 flex-col" style={TIMING}>
      <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span id="blocker-chart-title" className="text-sm font-medium text-ink-muted">
          {TEXTS.title}
        </span>
        <span
          id="blocker-chart-label"
          data-testid="blocker-chart-label"
          className="rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-medium text-ink-muted"
        >
          {TEXTS.label}
        </span>
      </figcaption>

      <div
        role="img"
        aria-labelledby="blocker-chart-title blocker-chart-label"
        aria-describedby="blocker-chart-description"
        data-testid="blocker-chart-scene"
        className={styles.scene}
      >
        {/* Words of the scene: HTML over the SVG, never a figure. */}
        <span className={cn(styles.word, styles.axisY)}>{TEXTS.axisY}</span>
        {/* Named on the same row, right above the measure of the gap. */}
        <span
          className={styles.capacityLabel}
          data-testid="problem-capacity"
          style={{ right: percentX(VIEW.width - CAPACITY_MARKER.x) }}
        >
          {TEXTS.capacity}
        </span>

        {/* The plot: the SVG and the words placed in its coordinates. */}
        <div className={styles.plot}>
          <svg
            viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
            className={styles.svg}
            data-testid="blocker-chart-svg"
            aria-hidden="true"
            focusable="false"
          >
            <defs>
              <linearGradient
                id="problem-curve-stroke"
                gradientUnits="userSpaceOnUse"
                x1={xAt(0)}
                x2={xAt(1)}
                y1={0}
                y2={0}
              >
                <stop offset="0" className={styles.stopAccent} />
                <stop offset="0.42" className={styles.stopAccent} />
                <stop offset="0.72" className={styles.stopInk} />
                <stop offset="1" className={styles.stopMuted} />
              </linearGradient>
              <linearGradient id="problem-area-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" className={styles.stopAreaTop} />
                <stop offset="1" className={styles.stopAreaBottom} />
              </linearGradient>
              <linearGradient
                id="problem-friction-fill"
                gradientUnits="userSpaceOnUse"
                x1={xAt(FRICTION_START)}
                x2={xAt(1)}
                y1={0}
                y2={0}
              >
                <stop offset="0" className={styles.stopFrictionStart} />
                <stop offset="1" className={styles.stopFrictionEnd} />
              </linearGradient>
            </defs>

            <path className={styles.area} d={AREA_PATH} />
            <path className={styles.friction} d={FRICTION_PATH} data-testid="problem-friction" />
            <path className={styles.expected} d={EXPECTED_PATH} pathLength={1} />
            <path className={styles.curve} d={CURVE_PATH} pathLength={1} data-testid="problem-curve" />

            {PROBLEM_EVENTS.map((event) => {
              const point = eventPoint(event);
              return (
                <g
                  key={event.id}
                  className={styles.event}
                  data-testid="problem-event"
                  data-event-id={event.id}
                  data-event-kind={event.kind}
                  data-cause={causeOfEvent(event.kind)}
                  data-cause-target=""
                  data-early={isEarlyEvent(event) ? "true" : undefined}
                  data-label={event.label}
                >
                  <g
                    className={styles.appear}
                    style={
                      {
                        "--event-delay": ms(eventDelayMs(event)),
                      } as CSSProperties
                    }
                  >
                    {/* Links the event to the curve, and to its word hanging under the curve. */}
                    <line
                      className={styles.tether}
                      x1={point.x}
                      x2={point.x}
                      y1={event.label ? labelPoint(event).y : point.anchorY}
                      y2={point.y}
                    />
                    <circle className={styles.halo} cx={point.x} cy={point.y} r={12} />
                    <circle className={styles.dot} cx={point.x} cy={point.y} r={3.4} />
                  </g>
                </g>
              );
            })}

            <g className={styles.capacity}>
              <line
                className={styles.marker}
                x1={CAPACITY_MARKER.x}
                x2={CAPACITY_MARKER.x}
                y1={CAPACITY_MARKER.y1}
                y2={CAPACITY_MARKER.y2}
              />
              <line
                className={styles.markerCap}
                x1={CAPACITY_MARKER.x - 5}
                x2={CAPACITY_MARKER.x + 5}
                y1={CAPACITY_MARKER.y2}
                y2={CAPACITY_MARKER.y2}
              />
            </g>
            <circle className={styles.end} cx={CAPACITY_MARKER.x} cy={CAPACITY_MARKER.y1} r={4.5} />
          </svg>

          <span className={cn(styles.word, styles.axisX)}>{TEXTS.axisX}</span>

          {PROBLEM_EVENTS.filter((event) => event.label).map((event) => {
            const point = labelPoint(event);
            return (
              <span
                key={event.id}
                className={styles.chipSlot}
                data-testid="problem-event-label"
                data-event-kind={event.kind}
                data-cause={causeOfEvent(event.kind)}
                data-cause-target=""
                data-label={event.label}
                data-align={labelAlign(event)}
                style={{ left: percentX(point.x), top: percentY(point.y) }}
              >
                <span
                  className={styles.chip}
                  style={
                    {
                      "--event-delay": ms(eventDelayMs(event)),
                    } as CSSProperties
                  }
                >
                  {TEXTS.events[event.kind]}
                </span>
              </span>
            );
          })}
        </div>
      </div>

      <p id="blocker-chart-description" className="sr-only">
        {TEXTS.description}
      </p>
    </figure>
  );
}
