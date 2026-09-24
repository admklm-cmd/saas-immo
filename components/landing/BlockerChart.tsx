import { LANDING_TEXTS } from "@/components/landing-texts";

import styles from "./BlockerChart.module.css";

const TEXTS = LANDING_TEXTS.problem.chart;

/*
 * Geometry of the illustration, in viewBox units. No scale, no tick, no
 * figure: the chart shows a shape (growth, then a ceiling), not a measure.
 */
const ORIGIN = { x: 64, y: 292 };
const END_X = 616;
const TOP_Y = 28;
const ZONE = { x: 300, y: 56, width: 316, height: 54 };
const CEILING_Y = 114;
const CURVE = "M64 286 C 150 278, 208 204, 276 160 S 380 125, 460 124 L 612 123";
const AREA = `${CURVE} L 612 ${ORIGIN.y} L ${ORIGIN.x} ${ORIGIN.y} Z`;
/** Where the three causes hold the curve down (no number, no label on the plot). */
const STOPS = [380, 480, 580];
const PLATEAU_Y = 124;

/**
 * Illustration « blocage administratif » of the problem section: a curve of
 * mandates that grows, then flattens under a dashed zone named « Blocage
 * administratif ». Labelled « Illustration — exemple fictif »; the axes only
 * say « Temps » and « Mandats », never a figure.
 *
 * Server Component, pure SVG. The curve draws itself when the enclosing
 * `Reveal` enters the viewport (stroke-dashoffset); without JavaScript or
 * under reduced motion it is shown complete at once. `role="img"` with a
 * written description for assistive technology.
 */
export function BlockerChart() {
  return (
    <figure data-testid="blocker-chart" className="min-w-0">
      <figcaption className="flex flex-wrap items-center justify-between gap-3">
        <span id="blocker-chart-title" className="text-sm font-semibold text-ink">
          {TEXTS.title}
        </span>
        <span
          id="blocker-chart-label"
          data-testid="blocker-chart-label"
          className="rounded-full border border-dashed border-ink-subtle px-2.5 py-0.5 text-xs font-medium text-ink-muted"
        >
          {TEXTS.label}
        </span>
      </figcaption>

      <svg
        role="img"
        aria-labelledby="blocker-chart-title blocker-chart-label"
        aria-describedby="blocker-chart-description"
        viewBox="0 0 640 330"
        className={styles.chart}
        data-testid="blocker-chart-svg"
      >
        {/* Axes: no tick, no scale. */}
        <path className={styles.axis} d={`M${ORIGIN.x} ${TOP_Y} V${ORIGIN.y} H${END_X}`} />
        <path className={styles.axis} d={`M${ORIGIN.x - 5} ${TOP_Y + 7} L${ORIGIN.x} ${TOP_Y} L${ORIGIN.x + 5} ${TOP_Y + 7}`} />
        <path className={styles.axis} d={`M${END_X - 7} ${ORIGIN.y - 5} L${END_X} ${ORIGIN.y} L${END_X - 7} ${ORIGIN.y + 5}`} />
        <text className={styles.axisLabel} x={ORIGIN.x + 12} y={TOP_Y + 12}>
          {TEXTS.axisY}
        </text>
        <text className={styles.axisLabel} x={END_X} y={ORIGIN.y + 28} textAnchor="end">
          {TEXTS.axisX}
        </text>

        {/* The curve: grows, then flattens under the zone. */}
        <path className={styles.area} d={AREA} />
        <path className={styles.curve} d={CURVE} pathLength={1} />

        {/* The administrative block: a dashed zone at the level of the ceiling. */}
        <g className={styles.late}>
          <rect className={styles.zone} x={ZONE.x} y={ZONE.y} width={ZONE.width} height={ZONE.height} rx={12} />
          <text className={styles.zoneLabel} x={ZONE.x + ZONE.width / 2} y={ZONE.y + ZONE.height / 2} textAnchor="middle">
            {TEXTS.zone}
          </text>
          <line className={styles.ceiling} x1={ZONE.x - 40} x2={END_X} y1={CEILING_Y} y2={CEILING_Y} />
          {STOPS.map((x) => (
            <g key={x}>
              <line className={styles.tick} x1={x} x2={x} y1={ZONE.y + ZONE.height} y2={PLATEAU_Y - 6} />
              <circle className={styles.stop} cx={x} cy={PLATEAU_Y} r={5} />
            </g>
          ))}
        </g>

      </svg>

      <p id="blocker-chart-description" className="sr-only">
        {TEXTS.description}
      </p>
    </figure>
  );
}
