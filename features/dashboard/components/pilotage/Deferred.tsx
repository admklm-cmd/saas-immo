"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { useChartReady } from "@/components/charts/ChartReadyContext";
import { cn } from "@/components/ui/cn";

export type DeferredProps = {
  children: ReactNode;
  /** The box keeps its final height before and after: nothing moves when the chart arrives. */
  className?: string;
  testId?: string;
  /** The zone fades out and in when the period changes (`data-swap`). */
  swap?: boolean;
};

/** Distance at which a zone below the fold starts loading its chart (docs §3.5.2.N). */
const APPROACH_MARGIN = "400px";

/**
 * Renders its children (a `next/dynamic` island) only when the zone approaches the
 * viewport, so that the code of the charts below the fold is never part of the first
 * load. Without IntersectionObserver the children render at once.
 */
export function Deferred({ children, className, testId, swap }: DeferredProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  // Inside a `ChartStage`: the chart waits for the card to be on screen, so its own entrance is seen.
  const ready = useChartReady();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      const timer = window.setTimeout(() => setNear(true), 0);
      return () => window.clearTimeout(timer);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: APPROACH_MARGIN },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} data-testid={testId} data-swap={swap ? "chart" : undefined}
      data-near={near ? "true" : "false"} className={cn(className)}>
      {near && ready ? children : null}
    </div>
  );
}
