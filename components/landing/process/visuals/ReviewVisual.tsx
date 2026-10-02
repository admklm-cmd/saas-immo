import type { CSSProperties } from "react";

import { Icon } from "@/components/icons/Icon";
import { LANDING_TEXTS } from "@/components/landing-texts";

import { CursorYou } from "../../ecosystem/CursorYou";
import styles from "./decisions.module.css";
import frame from "./frame.module.css";

const TEXTS = LANDING_TEXTS.final.visuals.review;
const LINES = [94, 86, 62] as const;

/**
 * Card 4 — the human validation: the first message waits; the « Vous »
 * cursor of block A (same drawing) glides to « Valider » and clicks it, the
 * button fills and checks. Only a human does this.
 */
export function ReviewVisual() {
  const [edit, refuse, validate] = TEXTS.actions;
  return (
    <div className={frame.stage}>
      <div className={styles.message}>
        <span className={styles.messageLines}>
          {LINES.map((width) => (
            <span key={width} className={styles.messageLine} style={{ width: `${width}%` } as CSSProperties} />
          ))}
        </span>
        <span className={styles.decisions}>
          <span className={styles.decision}>{edit}</span>
          <span className={styles.decision}>{refuse}</span>
          <span className={styles.decisionTarget}>
            <span className={styles.decisionDone}>
              <Icon name="check" px={12} />
              {validate}
            </span>
            <CursorYou label={TEXTS.cursor} className={styles.cursor} style={{ left: "62%", top: "64%" }} testId="process-cursor" />
          </span>
        </span>
      </div>
    </div>
  );
}
