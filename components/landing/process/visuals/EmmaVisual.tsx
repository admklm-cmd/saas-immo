import type { CSSProperties } from "react";

import { Icon } from "@/components/icons/Icon";
import { LANDING_TEXTS } from "@/components/landing-texts";

import styles from "./fields.module.css";
import frame from "./frame.module.css";

const TEXTS = LANDING_TEXTS.final.visuals.emma;
/** Widths of the three lines of the draft (% of the mail), written one after the other. */
const LINES = [92, 80, 56] as const;

/**
 * Card 3 — Emma prepares a draft: a small e-mail whose lines write
 * themselves, the consent checked for this channel, the unsubscribe link in
 * the footer. A draft: nothing is sent.
 */
export function EmmaVisual() {
  return (
    <div className={frame.stage}>
      <div className={styles.mail}>
        <span className={styles.mailChannel}>{TEXTS.channel}</span>
        <span className={styles.mailSubject}>{TEXTS.subject}</span>
        <span className={styles.mailLines}>
          {LINES.map((width, index) => (
            <span key={width} className={styles.mailLine} style={{ width: `${width}%`, "--line-index": index } as CSSProperties} />
          ))}
        </span>
        <span className={styles.consent}>
          <Icon name="check" px={12} className={styles.consentCheck} />
          {TEXTS.consent}
        </span>
        <span className={styles.unsubscribe}>{TEXTS.unsubscribe}</span>
      </div>
    </div>
  );
}
