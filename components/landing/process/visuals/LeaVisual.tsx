import type { CSSProperties } from "react";

import { LANDING_TEXTS } from "@/components/landing-texts";

import { easedTime } from "../../solution/solution-geometry";
import styles from "./lea.module.css";
import frame from "./frame.module.css";

const TEXTS = LANDING_TEXTS.final.visuals.lea;
/** The sweep turns once in 1 600 ms on `--ease-standard`. */
const SWEEP_MS = 1_600;
const EASE_STANDARD = [0.22, 0.61, 0.36, 1] as const;
/** Two sources, at 30 % and 62 % of the turn (clockwise from the top), radius in px. */
const TARGETS = [
  { share: 0.3, radius: 80 },
  { share: 0.62, radius: 96 },
] as const;

/**
 * Card 1 — Léa checks the source: a radar sweeps once; the two sources it
 * meets (the site form, a call) light up as cobalt rings, then merge into a
 * single clean record (« 1 fiche »). No red anywhere.
 */
export function LeaVisual() {
  return (
    <div className={frame.stage}>
      <div className={styles.radar}>
        <svg className={styles.rings} viewBox="-120 -120 240 240" aria-hidden="true" focusable="false">
          <circle r="40" />
          <circle r="80" />
          <circle r="119.5" />
        </svg>
        <span className={styles.sweep} />
        {TARGETS.map((target, index) => {
          const angle = target.share * 2 * Math.PI;
          const x = Math.round(Math.sin(angle) * target.radius);
          const y = Math.round(-Math.cos(angle) * target.radius);
          const hit = Math.round(easedTime(target.share, EASE_STANDARD) * SWEEP_MS);
          return (
            <span
              key={TEXTS.targets[index]}
              className={styles.target}
              style={{ left: x, top: y, "--to-x": `${-x}px`, "--to-y": `${-y}px`, "--hit": `${hit}ms` } as CSSProperties}
            >
              <span className={styles.targetDot} />
              <span className={styles.targetLabel}>{TEXTS.targets[index]}</span>
            </span>
          );
        })}
        <span className={styles.merged}>
          <span className={styles.mergedDot} />
          <span className={styles.mergedPill}>{TEXTS.merged}</span>
        </span>
      </div>
    </div>
  );
}
