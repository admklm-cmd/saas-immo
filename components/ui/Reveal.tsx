"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

type RevealState = "visible" | "hidden" | "entering";

/** Beyond this position, blocks arrive together: the total delay stays short. */
const MAX_INDEX = 5;

/**
 * Reveals static server-rendered content once it enters the viewport: fade and
 * 12 px rise over 550 ms, once. `index` staggers neighbouring blocks by
 * `--stagger-step` (110 ms), capped.
 * The default is deliberately visible so missing JavaScript never hides content.
 */
export function Reveal({ children, index = 0 }: { children: ReactNode; index?: number }) {
  const elementRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<RevealState>("visible");

  useLayoutEffect(() => {
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion || !("IntersectionObserver" in window)) return;

    const element = elementRef.current;
    if (!element) return;

    setState("hidden");
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setState("entering");
        observer.disconnect();
      },
      { rootMargin: "0px 0px -8%", threshold: 0.08 },
    );
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={elementRef}
      className="reveal"
      data-reveal={state}
      style={{ "--reveal-index": Math.min(Math.max(index, 0), MAX_INDEX) } as CSSProperties}
    >
      {children}
    </div>
  );
}
