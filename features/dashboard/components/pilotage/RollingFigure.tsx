"use client";

import { animate } from "./pilotage-motion";
import { useEffect, useRef } from "react";

import { cn } from "@/components/ui/cn";

import { prefersReducedMotion } from "./motion";
import { ROLLING_FIGURES, ROLLING_MS } from "./pilotage-format";

export type RollingFigureProps = {
  /** The written final value (already in the HTML). */
  text: string;
  /** The number behind it; `null` when the figure is not measurable. */
  value: number | null;
  /** Writes an intermediate number the same way as the final text. */
  format: (value: number) => string;
  className?: string;
  testId?: string;
};

/**
 * A figure that rolls from the old true value to the new true value when the period
 * changes (≤ 420 ms, docs §3.5.2.H). Never on the first render. The final text is
 * always in the DOM for assistive technology (`sr-only`); the rolling copy is
 * `aria-hidden`. Reduced motion: it simply changes.
 */
export function RollingFigure({ text, value, format, className, testId }: RollingFigureProps) {
  const visibleRef = useRef<HTMLSpanElement>(null);
  const previous = useRef<{ value: number | null; text: string } | null>(null);

  useEffect(() => {
    const node = visibleRef.current?.firstChild;
    const before = previous.current;
    previous.current = { value, text };
    if (!node || !before || before.text === text) return;
    if (!ROLLING_FIGURES || prefersReducedMotion() || before.value === null || value === null) return;

    const state = { n: before.value };
    const animation = animate(state, {
      n: value,
      duration: ROLLING_MS,
      ease: "outQuad",
      onUpdate: () => {
        node.nodeValue = format(Math.round(state.n));
      },
      onComplete: () => {
        node.nodeValue = text;
      },
    });
    return () => {
      animation.pause();
      node.nodeValue = text;
    };
  }, [text, value, format]);

  return (
    <span data-testid={testId} className={cn("figure", className)}>
      <span className="sr-only">{text}</span>
      <span ref={visibleRef} aria-hidden="true">
        {text}
      </span>
    </span>
  );
}
