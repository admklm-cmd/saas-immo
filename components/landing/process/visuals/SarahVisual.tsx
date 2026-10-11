import type { CSSProperties } from "react";

import { Icon } from "@/components/icons/Icon";
import { LANDING_TEXTS } from "@/components/landing-texts";

import styles from "./slots.module.css";
import frame from "./frame.module.css";

const TEXTS = LANDING_TEXTS.final.visuals.sarah;

/**
 * Card 6 — Sarah reads the visit report (dotted lines, no invented word) and
 * turns it into three next actions, one after the other — each still to be
 * validated or conditioned by consent.
 */
export function SarahVisual() {
  return (
    <div className={frame.stage}>
      <span className={styles.sheet}>
        <span className={styles.sheetLine} style={{ width: "88%" }} />
        <span className={styles.sheetLine} style={{ width: "64%" }} />
      </span>
      <ul className={styles.actions}>
        {TEXTS.actions.map((action, index) => (
          <li key={action} className={styles.action} style={{ "--action-index": index } as CSSProperties}>
            <Icon name="tasks" px={14} />
            <span className={styles.actionText}>{action}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
