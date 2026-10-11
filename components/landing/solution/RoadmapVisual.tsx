import type { CSSProperties } from "react";

import { LANDING_TEXTS } from "@/components/landing-texts";
import { cn } from "@/components/ui/cn";
import { AgentAppIcon } from "@/features/agents-ia/components/icons/AgentAppIcon";

import { roadmapHeight, roadmapPath, roadmapTop } from "./solution-geometry";
import styles from "./solution-paths.module.css";

const TEXTS = LANDING_TEXTS.solution;
/** The step the dossier waits at: the human validation (04). */
const WAITING = TEXTS.rail.findIndex((step) => "human" in step && step.human);

/**
 * Tile 1 — the roadmap of a dossier: the seven real steps in a zigzag, linked
 * by a dotted path; the dossier waits at « Validation humaine » (dashed card,
 * the only cobalt dot of the tile), the steps after it are not reached yet
 * (dimmed), the last one is cut by the fade of the frame. Decorative inside
 * its `role="img"` frame.
 */
export function RoadmapVisual() {
  const count = TEXTS.rail.length;
  const height = roadmapHeight(count);
  return (
    <div className={styles.roadmap} data-testid="solution-roadmap">
      <svg
        className={styles.roadmapPath}
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        style={{ height }}
        aria-hidden="true"
        focusable="false"
      >
        <path d={roadmapPath(count)} vectorEffect="non-scaling-stroke" />
      </svg>
      <ol className={styles.steps}>
        {TEXTS.rail.map((step, index) => {
          const human = "human" in step && step.human;
          const waiting = index === WAITING;
          const later = index > WAITING;
          const kind = index === count - 1 ? "outcome" : human ? "human" : "agent";
          return (
            <li
              key={step.label}
              className={cn(styles.step, index % 2 === 1 && styles.stepRight, waiting && styles.stepWaiting, later && styles.stepLater)}
              style={{ top: roadmapTop(index), "--step-index": index } as CSSProperties}
              data-step-state={waiting ? "waiting" : later ? "later" : "done"}
            >
              <AgentAppIcon glyph={step.glyph} kind={kind} size="sm" state={waiting || later ? "inactive" : "idle"} />
              <span className={styles.stepText}>
                <span className={styles.stepLine}>
                  <span className={styles.stepNumber}>{String(index + 1).padStart(2, "0")}</span>
                  <span className={styles.stepLabel}>{step.label}</span>
                </span>
                {waiting ? (
                  <span className={styles.stepPending}>
                    <span className={styles.pendingDot} data-testid="solution-roadmap-dot" />
                    {TEXTS.tiles.roadmap.pending}
                  </span>
                ) : (
                  <span className={styles.stepOwner}>{step.owner}</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
