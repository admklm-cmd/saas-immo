import { LANDING_TEXTS } from "@/components/landing-texts";
import { cn } from "@/components/ui/cn";

import styles from "./slots.module.css";
import frame from "./frame.module.css";

const TEXTS = LANDING_TEXTS.final.visuals.louis;
/** The slot Louis proposes: the first free one. */
const PROPOSED = TEXTS.slots.findIndex((slot) => !slot.taken);

/**
 * Card 5 — Louis looks for a free slot: a cobalt ring comes down, passes over
 * the slot already booked without stopping, and settles on the first free
 * one, « Proposé au vendeur ». Never booked twice.
 */
export function LouisVisual() {
  return (
    <div className={frame.stage}>
      <ul className={styles.slots}>
        {TEXTS.slots.map((slot, index) => (
          <li key={slot.time} className={cn(styles.slot, slot.taken && styles.slotTaken)}>
            <span className={styles.slotTime}>{slot.time}</span>
            {index === PROPOSED ? (
              <span className={styles.slotProposed}>
                <span className={styles.slotProposedDot} />
                {TEXTS.proposed}
              </span>
            ) : slot.note ? (
              <span className={styles.slotNote}>{slot.note}</span>
            ) : null}
          </li>
        ))}
        <li className={styles.slotRing} aria-hidden="true" style={{ top: `calc(${PROPOSED} * (var(--slot-h) + var(--slot-gap)))` }} />
      </ul>
    </div>
  );
}
