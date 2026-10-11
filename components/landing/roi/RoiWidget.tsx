import type { ReactNode } from "react";

import styles from "./roi.module.css";

export type RoiWidgetKey = "speed" | "mandates" | "time" | "followup";

/**
 * Frame of a ROI widget (docs/design-system.md §2.11.8.8 L4-B): an opaque
 * tile (`data-network-cover`), its overline and provenance tags, its `h3`,
 * the island that counts and moves (`children`), and the source note under a
 * hairline. Not a link, no hover. Server Component.
 */
export function RoiWidget({
  widget,
  kicker,
  title,
  tags,
  note,
  children,
}: {
  widget: RoiWidgetKey;
  kicker: string;
  title: string;
  tags: ReactNode;
  note: string;
  children: ReactNode;
}) {
  const titleId = `roi-${widget}-title`;
  return (
    <article className={styles.tile} aria-labelledby={titleId} data-testid="roi-widget" data-widget={widget} data-network-cover="">
      <div className={styles.tileHead}>
        <p className={styles.kicker}>{kicker}</p>
        {tags}
      </div>
      <h3 id={titleId} className={styles.title}>
        {title}
      </h3>
      {children}
      <p className={styles.note} data-roi-note="">
        {note}
      </p>
    </article>
  );
}
