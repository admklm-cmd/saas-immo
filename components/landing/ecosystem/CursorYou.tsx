import type { CSSProperties, Ref } from "react";

import { cn } from "@/components/ui/cn";

import styles from "./ecosystem.module.css";

export type CursorYouProps = {
  /** The label next to the arrow (`LANDING_TEXTS.journey.cursor`: « Vous »). */
  label: string;
  /** The click: the arrow shrinks to 0.88 around its tip, then comes back. */
  pressed?: boolean;
  className?: string;
  style?: CSSProperties;
  ref?: Ref<HTMLSpanElement>;
  testId?: string;
};

/**
 * The « Vous » cursor: the advisor of the agency, the only one who checks a
 * human step (docs/design-system.md §2.11.8.3). A cobalt arrow (20 × 20, white
 * 1.5 px contour) whose TIP is the origin of the element, and a white-on-cobalt
 * « Vous » label offset by (14 ; 16) px. Decorative: always inside an
 * `aria-hidden` drawing. Server-safe; the caller positions it (FLIP transform
 * in block A, CSS in block C, Lot 2) and sets `pressed`.
 */
export function CursorYou({ label, pressed = false, className, style, ref, testId }: CursorYouProps) {
  return (
    <span ref={ref} className={cn(styles.cursor, className)} style={style} data-testid={testId} data-pressed={pressed ? "" : undefined}>
      <span className={styles.cursorBody}>
        <svg className={styles.cursorArrow} width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <path d="M1.5 1.5 L1.5 15.6 L5.4 12 L8.1 18 L10.9 16.8 L8.3 10.9 L13.6 10.9 Z" />
        </svg>
        <span className={styles.cursorLabel}>{label}</span>
      </span>
    </span>
  );
}
