"use client";

import { useEffect, useRef } from "react";

import { isLandingPaused, onLandingMotion } from "../landing-motion";

import { parseColor, DEFAULT_PALETTE } from "./renderer";
import { LivingEngine } from "./LivingEngine";
import { isLivingScene, type LivingScene } from "./scenes";
import styles from "./LivingBackground.module.css";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const COMPACT = "(max-width: 767px), (pointer: coarse)";
/** Sections that drive the background carry this attribute. */
export const SCENE_ATTRIBUTE = "data-living-scene";

/**
 * Illustrative background of the landing page (fictitious example, simulation).
 *
 * One fixed canvas behind the whole page, hidden from assistive technology and
 * never interactive. The section crossing the middle of the viewport chooses
 * the scene. It reads no real state: it is a decor, labelled as a simulation
 * by the visible text of the page.
 */
export function LivingBackground({ initialScene = "hero" }: { initialScene?: LivingScene }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reducedQuery = window.matchMedia?.(REDUCED_MOTION);
    const compactQuery = window.matchMedia?.(COMPACT);
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--color-accent");
    const engine = new LivingEngine(canvas, {
      scene: initialScene,
      reduced: Boolean(reducedQuery?.matches),
      palette: { ...DEFAULT_PALETTE, accent: parseColor(accent, DEFAULT_PALETTE.accent) },
      onMotion: (state) => {
        canvas.dataset.motion = state;
      },
      onFrameCost: (milliseconds) => {
        canvas.dataset.frameMs = milliseconds.toFixed(2);
      },
    });
    canvas.dataset.scene = initialScene;

    const resize = () =>
      engine.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio, Boolean(compactQuery?.matches));
    resize();
    window.addEventListener("resize", resize);

    const onReducedChange = () => engine.setReduced(Boolean(reducedQuery?.matches));
    reducedQuery?.addEventListener?.("change", onReducedChange);
    compactQuery?.addEventListener?.("change", resize);

    // A hidden tab and the page pause (WCAG 2.2.2) both stop the loop; the
    // last frame stays drawn.
    const onVisibility = () => engine.setHidden(document.visibilityState === "hidden" || isLandingPaused());
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    const unsubscribePause = onLandingMotion(onVisibility);

    // Scroll progress through the section in view (-1 entering, 1 leaving):
    // feeds the light parallax of the mesh (problem and agents scenes only).
    let section: HTMLElement | null = null;
    const followScroll = () => {
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const span = rect.height / 2 + window.innerHeight / 2;
      engine.setParallax(span > 0 ? (window.innerHeight / 2 - (rect.top + rect.height / 2)) / span : 0);
    };
    const onScroll = () => {
      engine.boost();
      followScroll();
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    const observers: IntersectionObserver[] = [];
    if ("IntersectionObserver" in window) {
      // The section crossing the middle band of the viewport picks the scene.
      const sections = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const scene = (entry.target as HTMLElement).dataset.livingScene;
            if (!isLivingScene(scene)) continue;
            engine.setScene(scene);
            canvas.dataset.scene = scene;
            section = entry.target as HTMLElement;
            followScroll();
          }
        },
        { rootMargin: "-45% 0px -45% 0px" },
      );
      document.querySelectorAll<HTMLElement>(`[${SCENE_ATTRIBUTE}]`).forEach((section) => sections.observe(section));
      observers.push(sections);

      // Off screen (e.g. the canvas made static by a future layout): no frame.
      const self = new IntersectionObserver((entries) => {
        engine.setOffscreen(!entries.some((entry) => entry.isIntersecting));
      });
      self.observe(canvas);
      observers.push(self);
    }

    return () => {
      observers.forEach((observer) => observer.disconnect());
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      unsubscribePause();
      reducedQuery?.removeEventListener?.("change", onReducedChange);
      compactQuery?.removeEventListener?.("change", resize);
      engine.destroy();
    };
  }, [initialScene]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-testid="living-background"
      data-motion="idle"
      className={styles.canvas}
    />
  );
}
