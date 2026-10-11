"use client";

import { createTimeline, cubicBezier, utils } from "animejs";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { ChartReadyProvider } from "./ChartReadyContext";
import { cn } from "@/components/ui/cn";

/** The card appears at this share of its height on screen (docs §3.5.1.D.1). */
const VISIBLE_SHARE = 0.35;
const CARD_MS = 550;
const FIGURE_MS = 300;
const FIGURE_STEP_MS = 70;
const FIGURE_AT_MS = 200;
const CHART_AT_MS = 450;

/** `--ease-standard` is `cubic-bezier(a, b, c, d)`: read it from the CSS, never copied here. */
function readStandardEase(el: Element) {
  const raw = getComputedStyle(el).getPropertyValue("--ease-standard");
  const numbers = raw.match(/-?\d*\.?\d+/g)?.map(Number);
  return numbers && numbers.length === 4 ? cubicBezier(numbers[0], numbers[1], numbers[2], numbers[3]) : "outQuad";
}

export type ChartStageProps = {
  children: ReactNode;
  className?: string;
  testId?: string;
};

/**
 * The single place where Anime.js acts on the analytics cards (docs/design-system.md
 * §3.5.1.D): ONE timeline for the card (opacity + 12 px rise), its key figures
 * (opacity + 6 px rise, never a counting number: the text already is the final value),
 * then the hand-over to the chart (`ready`), so that Anime.js and the chart's own
 * motion never play together. Only `transform` and `opacity` of the card and of
 * `[data-chart-figure]`; never the chart's SVG. Nothing loops; `revert()` on unmount.
 *
 * Reduced motion: no timeline at all, `ready` at once, everything in its final state.
 * Without JavaScript: the server HTML is complete (the card is never hidden by CSS).
 * Once per page load: nothing replays on resize, the chart redraws without animation.
 */
export function ChartStage({ children, className, testId }: ChartStageProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    // Reading the browser (reduced motion, layout) decides the first state: a legitimate effect.
    const markReady = () => setReady(true);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      markReady();
      return;
    }

    const rect = root.getBoundingClientRect();
    const visibleHeight = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
    // Already on screen when the page hydrates: hiding it now would only make it blink.
    if (rect.height > 0 && visibleHeight >= rect.height * VISIBLE_SHARE) {
      markReady();
      return;
    }
    if (typeof IntersectionObserver === "undefined") {
      markReady();
      return;
    }

    const figures = Array.from(root.querySelectorAll<HTMLElement>("[data-chart-figure]"));
    // Off screen: hide it before it can be seen, then play once when it comes in.
    utils.set(root, { opacity: 0, translateY: 12 });
    utils.set(figures, { opacity: 0, translateY: 6 });

    let timeline: ReturnType<typeof createTimeline> | null = null;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        const ease = readStandardEase(root);
        const tl = createTimeline({
          autoplay: true,
          defaults: { ease },
          // Engine at rest, no inline style left: the card is back to its plain CSS.
          onComplete: () => {
            for (const el of [root, ...figures]) {
              el.style.removeProperty("opacity");
              el.style.removeProperty("transform");
            }
          },
        });
        tl.add(root, { opacity: [0, 1], translateY: [12, 0], duration: CARD_MS }, 0);
        if (figures.length > 0) {
          tl.add(
            figures,
            { opacity: [0, 1], translateY: [6, 0], duration: FIGURE_MS, delay: utils.stagger(FIGURE_STEP_MS) },
            FIGURE_AT_MS,
          );
        }
        tl.call(() => setReady(true), CHART_AT_MS);
        timeline = tl;
      },
      { threshold: VISIBLE_SHARE },
    );
    observer.observe(root);

    return () => {
      observer.disconnect();
      timeline?.revert();
      // Left unmounted before the entrance: put the card back in its final state.
      utils.set([root, ...figures], { opacity: 1, translateY: 0 });
      root.style.removeProperty("opacity");
      root.style.removeProperty("transform");
    };
  }, []);

  return (
    <div ref={rootRef} data-testid={testId} data-chart-ready={ready ? "true" : "false"} className={cn(className)}>
      <ChartReadyProvider value={ready}>{children}</ChartReadyProvider>
    </div>
  );
}
