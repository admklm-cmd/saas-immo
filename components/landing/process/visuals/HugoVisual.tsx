import type { CSSProperties } from "react";

import { LANDING_TEXTS } from "@/components/landing-texts";

import styles from "./fields.module.css";
import frame from "./frame.module.css";

const TEXTS = LANDING_TEXTS.final.visuals.hugo;

/**
 * Card 2 — Hugo structures the project: three fields fill in (property,
 * sector, timing), the motivation stays a dashed, empty field « Manquante —
 * signalée »: flagged, never invented.
 */
export function HugoVisual() {
  return (
    <div className={frame.stage}>
      <div className={styles.fields}>
        {TEXTS.rows.map((row, index) => (
          <div key={row.label} className={styles.field} style={{ "--row-index": index } as CSSProperties}>
            <span className={styles.fieldLine}>
              <span className={styles.fieldLabel}>{row.label}</span>
              <span className={styles.fieldValue}>{row.value}</span>
            </span>
            <span className={styles.fieldBar} />
          </div>
        ))}
        <div className={styles.field} data-missing="">
          <span className={styles.fieldLine}>
            <span className={styles.fieldLabel}>{TEXTS.missingLabel}</span>
            <span className={styles.fieldMissing}>{TEXTS.missingValue}</span>
          </span>
          <span className={styles.fieldDashed} />
        </div>
      </div>
    </div>
  );
}
