"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

type RevealState = "visible" | "hidden" | "entering";

/**
 * Reveals static server-rendered content once it enters the viewport.
 * The default is deliberately visible so missing JavaScript never hides content.
 */
export function Reveal({ children }: { children: ReactNode }) {
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
    <div ref={elementRef} className="reveal" data-reveal={state}>
      {children}
    </div>
  );
}
