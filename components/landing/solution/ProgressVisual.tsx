import type { CSSProperties } from "react";

import { LANDING_TEXTS } from "@/components/landing-texts";
import { cn } from "@/components/ui/cn";
import { PIPELINE_STAGE_LABELS } from "@/features/contacts/types";
import { PIPELINE_STAGES } from "@/features/pipeline/types";

import { areaPath, EASE_DRAW, easedTime, progressPoints, smoothPath } from "./solution-geometry";
import styles from "./solution-paths.module.css";

const TEXTS = LANDING_TEXTS.solution.tiles.progress;
/** The real stages of the pipeline, « Perdu » aside (it is not a step forward). */
const STAGES = PIPELINE_STAGES.filter((stage) => stage !== "perdu");
const POINTS = progressPoints();
/** The curve is drawn in 1 200 ms from 200 ms: each dot appears when the stroke reaches it. */
const DRAW_START_MS = 200;
const DRAW_MS = 1_200;

/**
 * Tile 2 — a fictitious dossier moving up the real stages of the pipeline,
 * from « Nouveau » to « Mandat signé ». No value, no y axis: only the shape
 * says it advances. The last stage is a double ring (a human signs it).
 */
export function ProgressVisual() {
  return (
    <div className={styles.progress} data-testid="solution-progress">
      <div className={styles.chartCard}>
        <p className={styles.chartHeading}>{TEXTS.heading}</p>
        <div className={styles.plot}>
          <svg className={styles.plotSvg} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <defs>
              <linearGradient id="solution-progress-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="rgb(24 24 27)" stopOpacity="0.08" />
                <stop offset="1" stopColor="rgb(24 24 27)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path className={styles.area} d={areaPath(POINTS)} fill="url(#solution-progress-area)" />
            <path className={styles.curve} d={smoothPath(POINTS)} pathLength={1} vectorEffect="non-scaling-stroke" />
          </svg>
          {POINTS.map((point, index) => (
            <span
              key={STAGES[index]}
              className={cn(styles.stageDot, index === POINTS.length - 1 && styles.stageDotHuman)}
              style={
                {
                  left: `${point.x}%`,
                  top: `${point.y}%`,
                  "--dot-delay": `${Math.round(DRAW_START_MS + DRAW_MS * easedTime(index / (POINTS.length - 1), EASE_DRAW))}ms`,
                } as CSSProperties
              }
            />
          ))}
        </div>
        <ol className={styles.stageLabels}>
          {STAGES.map((stage, index) => (
            <li key={stage} data-edge={index === 0 || index === STAGES.length - 1 ? "" : undefined}>
              {PIPELINE_STAGE_LABELS[stage]}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
