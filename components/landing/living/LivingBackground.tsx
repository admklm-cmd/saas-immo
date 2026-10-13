"use client";

import { useContext, useEffect, useRef } from "react";

import { HeroMotionContext } from "../hero/hero-motion-context";
import { onReplay } from "../replay/replay-bus";
import { PageField } from "./PageField";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const RESIZE_DEBOUNCE_MS = 150;
/** One pixel at the bottom of the opaque hero stage: while it is below the window, the hero covers it and the field is hidden behind. */
const HERO_END = "[data-hero-end]";

/**
 * Fixed background of the landing below the hero (docs/design-system.md T.6): about 22 000 small
 * particles in three planes that breathe, with a wave sent from the title near the middle of the
 * window, behind every content. The opaque stage of the hero covers them, so they only show from the
 * end of the hero down — and nothing is drawn before. `aria-hidden`, inert. The loop belongs to
 * `PageField`; this component connects it to the page: size, scroll, visibility, pause (shared with the
 * hero through `HeroMotionContext`), replay, reduced motion (one still image).
 */
export function LivingBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldRef = useRef<PageField | null>(null);
  const { stopped } = useContext(HeroMotionContext);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.getContext("2d")) return;
    const reduced = window.matchMedia?.(REDUCED_MOTION);
    const field = new PageField(canvas, Boolean(reduced?.matches));
    fieldRef.current = field;

    // The hero covers the window while the end of its stage is below the window. Observed, never measured: no layout read while scrolling.
    const sentinel = document.querySelector(HERO_END);
    const coverage =
      sentinel && typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver((entries) => {
            const entry = entries[entries.length - 1];
            if (entry) field.setHeroCovers(!entry.isIntersecting && entry.boundingClientRect.top >= (entry.rootBounds?.height ?? window.innerHeight));
          })
        : null;
    coverage?.observe(sentinel!);
    field.resize(window.innerWidth, window.innerHeight);
    field.setPageVisible(document.visibilityState !== "hidden");

    let resizeTimer: number | null = null;
    const onResize = () => {
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        resizeTimer = null;
        field.resize(window.innerWidth, window.innerHeight);
      }, RESIZE_DEBOUNCE_MS);
    };
    const onVisibility = () => field.setPageVisible(document.visibilityState !== "hidden");
    const onReduced = () => field.setReduced(Boolean(reduced?.matches));
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    reduced?.addEventListener?.("change", onReduced);
    const offReplay = onReplay(() => field.replay());
    return () => {
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      coverage?.disconnect();
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      reduced?.removeEventListener?.("change", onReduced);
      offReplay();
      field.dispose();
      fieldRef.current = null;
    };
  }, []);

  useEffect(() => {
    fieldRef.current?.setStopped(stopped);
  }, [stopped]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-testid="page-dust"
      data-loop="allowed"
      data-loop-state="paused"
      data-points="0"
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
    />
  );
}
