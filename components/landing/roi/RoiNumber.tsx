"use client";

import { useState, type Ref } from "react";

import { cn } from "@/components/ui/cn";

import styles from "./roi.module.css";

/**
 * A ROI figure (docs/design-system.md §2.11.8.8 L4-B): the visible number is
 * `aria-hidden` and written by the widget (counting, anime.js), never by
 * React after the first render; next to it, an `sr-only` text ALWAYS holds
 * the final rounded value with its unit. `prefix` / `suffix` (« ≈ », « € HT »,
 * « % ») are set smaller so the figure fits a 360 px screen.
 * `data-roi-value`: the final value, not rounded (tests).
 */
export function RoiNumber({
  text,
  value,
  sr,
  prefix,
  suffix,
  size = "main",
  numberRef,
  className,
}: {
  /** Formatted final value at the first render (server HTML). */
  text: string;
  value: number;
  sr: string;
  prefix?: string;
  suffix?: string;
  size?: "main" | "secondary" | "inline" | "step";
  numberRef?: Ref<HTMLSpanElement>;
  className?: string;
}) {
  // Frozen: React never rewrites the text the widget animates.
  const [initial] = useState(text);
  return (
    <span className={cn(styles.number, styles[`number-${size}`], className)} data-roi-value={value}>
      <span aria-hidden="true" className={styles.numberVisual}>
        {prefix ? <span className={styles.unit}>{prefix}</span> : null}
        <span ref={numberRef} className={styles.digits} suppressHydrationWarning>
          {initial}
        </span>
        {suffix ? <span className={styles.unit}>{suffix}</span> : null}
      </span>
      <span className="sr-only">{sr}</span>
    </span>
  );
}
