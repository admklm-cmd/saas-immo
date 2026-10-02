import type { CSSProperties } from "react";

import { LANDING_TEXTS } from "@/components/landing-texts";
import { SimulationBadge } from "@/components/ui/SimulationBadge";

import styles from "./solution-people.module.css";

const TEXTS = LANDING_TEXTS.solution.tiles.report;
/** Widths of the six dotted lines of the sheet (% of the sheet). */
const LINES = [92, 78, 85, 60, 88, 40] as const;

/**
 * Tile 4 — the visit report Sarah works from: a slightly tilted sheet whose
 * lines are grids of dots (no readable text, nothing invented), and a card
 * laid over it: « Simulation » (never a red « recording » dot),
 * « Compte-rendu · Sarah », « 3 actions prêtes ».
 */
export function ReportVisual() {
  return (
    <div className={styles.report} data-testid="solution-report">
      <div className={styles.sheet}>
        {LINES.map((width, index) => (
          <span key={index} className={styles.sheetLine} style={{ width: `${width}%`, "--line-index": index } as CSSProperties} />
        ))}
      </div>
      <div className={styles.reportCard}>
        <SimulationBadge />
        <span className={styles.reportTitle}>{TEXTS.card}</span>
        <span className={styles.reportMeta}>{TEXTS.actions}</span>
      </div>
    </div>
  );
}
