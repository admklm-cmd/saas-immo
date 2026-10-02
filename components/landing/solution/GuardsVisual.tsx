import type { CSSProperties } from "react";

import { LANDING_TEXTS } from "@/components/landing-texts";

import styles from "./solution-people.module.css";

const TEXTS = LANDING_TEXTS.solution.tiles.guards;

/**
 * Tile 5 — the guard rails, as figures that are RULES of the prototype, not
 * statistics: no real send, two mandatory human validations (first contact,
 * mandate — CLAUDE.md). Plain text, read as is (no `role="img"`). Numbers
 * rise into place once, never count up.
 */
export function GuardsVisual() {
  return (
    <div className={styles.guards} data-testid="solution-guards">
      <div className={styles.figures}>
        {TEXTS.figures.map((figure, index) => (
          <p key={figure.caption} className={styles.figure} style={{ "--figure-index": index } as CSSProperties}>
            <span className={styles.figureValue}>{figure.value}</span>
            <span className={styles.figureCaption}>{figure.caption}</span>
          </p>
        ))}
      </div>
      <dl className={styles.rows}>
        {TEXTS.rows.map((row) => (
          <div key={row.label} className={styles.row}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
