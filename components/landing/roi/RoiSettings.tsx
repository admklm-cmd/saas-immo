"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { LANDING_TEXTS } from "@/components/landing-texts";
import { cn } from "@/components/ui/cn";

import { ANNOUNCE_DELAY_MS, type RoiKind } from "./roi-model";
import { RoiTags } from "./RoiTag";
import styles from "./roi.module.css";

const TEXTS = LANDING_TEXTS.roi;

/**
 * Settings of a ROI widget (W2, W3; docs/design-system.md §2.11.8.8 L4-B):
 * the sliders, the « Valeurs par défaut » link (only when a value differs),
 * the note « Réglages disponibles avec JavaScript. » in the server HTML, the
 * fixed hypotheses, and the polite live region that speaks the result 500 ms
 * after the last change (nothing is announced during the arrival).
 */
export function RoiSettings({
  children,
  changed,
  hydrated,
  onReset,
  fixed,
  announcement,
  changes,
}: {
  children: ReactNode;
  /** A value differs from its default. */
  changed: boolean;
  hydrated: boolean;
  onReset: () => void;
  fixed: readonly { value: string; label: string; kind: RoiKind }[];
  /** Sentence spoken after a change. */
  announcement: string;
  /** Number of changes made by the visitor (0: nothing to announce). */
  changes: number;
}) {
  const [live, setLive] = useState("");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (changes === 0) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setLive(announcement), ANNOUNCE_DELAY_MS);
    return () => window.clearTimeout(timer.current);
  }, [changes, announcement]);

  return (
    <>
      <div className={styles.settings}>
        {children}
        {!hydrated ? <p className={styles.noScript}>{TEXTS.noScript}</p> : null}
        {hydrated && changed ? (
          <button type="button" className={styles.reset} onClick={onReset}>
            {TEXTS.reset}
          </button>
        ) : null}
      </div>
      <ul className={styles.fixed}>
        {fixed.map((entry) => (
          <li key={entry.label} className={styles.fixedItem}>
            <span className={cn(styles.fixedValue, entry.kind === "hypothesis" && styles.hypothesisValue)}>{entry.value}</span>
            <span className={styles.fixedLabel}>{entry.label}</span>
            <RoiTags kind={entry.kind} />
          </li>
        ))}
      </ul>
      <p className="sr-only" aria-live="polite" data-roi-live="">
        {live}
      </p>
    </>
  );
}
