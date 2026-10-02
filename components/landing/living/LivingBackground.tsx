"use client";

import { useEffect, useRef } from "react";

import { LivingEngine, type FrameCost } from "./LivingEngine";
import type { ScreenClass } from "./network";
import { addQuietRect, type QuietZones } from "./quiet";
import { DEFAULT_PALETTE, parseColor } from "./paint-kit";
import { NetworkPainter } from "./renderer";
import { isLivingScene, type LivingScene } from "./scenes";
import styles from "./LivingBackground.module.css";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const COMPACT = "(max-width: 767px), (pointer: coarse)";
const LARGE_MIN_WIDTH = 1280;
/** The arrival cascade waits for the hero title lines to be posed. */
const ARRIVAL_DELAY_MS = 900;
const RESIZE_DEBOUNCE_MS = 150;
/** Sections that drive the background carry this attribute. */
export const SCENE_ATTRIBUTE = "data-living-scene";
/** Text blocks posed outside an opaque surface: impulses fade out around them. */
export const QUIET_ATTRIBUTE = "data-network-quiet";
/** Opaque surfaces (cards, panels): no sequence starts behind them. */
export const COVER_ATTRIBUTE = "data-network-cover";

/**
 * Neural network behind the landing (docs/design-system.md §2.11.4) — an
 * illustration (fictitious example, simulation) that reads no real state.
 *
 * One fixed canvas behind the whole page, hidden from assistive technology
 * and never interactive, under a static white atmosphere. The camera follows
 * the scroll progress of the page; impulses play in bounded sequences only:
 * an arrival cascade, then one salvo at the first entry of each section.
 * At rest nothing runs (no frame, no timer).
 */
export function LivingBackground({ initialScene = "hero" }: { initialScene?: LivingScene }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reducedQuery = window.matchMedia?.(REDUCED_MOTION);
    const compactQuery = window.matchMedia?.(COMPACT);
    const tokens = getComputedStyle(document.documentElement);
    const painter = new NetworkPainter(canvas, {
      ...DEFAULT_PALETTE,
      ink: parseColor(tokens.getPropertyValue("--color-ink"), DEFAULT_PALETTE.ink),
      accent: parseColor(tokens.getPropertyValue("--color-accent"), DEFAULT_PALETTE.accent),
    });

    const collect = (attribute: string, zones: QuietZones) => {
      const height = window.innerHeight;
      for (const element of document.querySelectorAll<HTMLElement>(`[${attribute}]`)) {
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0 || rect.bottom < -16 || rect.top > height + 16) continue;
        if (!addQuietRect(zones, rect.left, rect.top, rect.right, rect.bottom)) break;
      }
    };
    const readZones = (quiet: QuietZones, covers: QuietZones) => {
      collect(QUIET_ATTRIBUTE, quiet);
      collect(COVER_ATTRIBUTE, covers);
    };

    const engine = new LivingEngine({
      reduced: Boolean(reducedQuery?.matches),
      painter,
      readZones,
      onMotion: (state) => {
        canvas.dataset.motion = state;
      },
      onStats: (stats) => {
        canvas.dataset.frames = String(stats.frames);
        canvas.dataset.signals = String(stats.signals);
        canvas.dataset.lit = String(stats.lit);
        canvas.dataset.sequences = stats.sequences.join(",");
      },
      onFrameCost: (cost: FrameCost) => {
        canvas.dataset.frameMs = cost.mean.toFixed(2);
        canvas.dataset.frameMsP95 = cost.p95.toFixed(2);
        if (cost.p95Full !== null) canvas.dataset.frameMsP95Full = cost.p95Full.toFixed(2);
        if (cost.p95Cached !== null) canvas.dataset.frameMsP95Cached = cost.p95Cached.toFixed(2);
      },
    });
    canvas.dataset.scene = initialScene;

    const screenClass = (): ScreenClass =>
      compactQuery?.matches ? "compact" : window.innerWidth >= LARGE_MIN_WIDTH ? "large" : "medium";
    const scrollProgress = () => {
      const range = document.documentElement.scrollHeight - window.innerHeight;
      return range > 0 ? window.scrollY / range : 0;
    };
    const resize = () => {
      engine.setScrollProgress(scrollProgress());
      engine.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio, screenClass());
      const network = engine.currentNetwork;
      if (network) {
        canvas.dataset.nodes = String(network.nodeCount);
        canvas.dataset.links = String(network.linkCount);
        canvas.dataset.fibers = String(network.fiberCount);
        // Recentring of §2.11.4 (lever 3), CSS px: computed on resize only.
        canvas.dataset.centerOffset = engine.projectionOffset.toFixed(1);
      }
    };
    resize();

    let resizeTimer: number | null = null;
    const onResize = () => {
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        resizeTimer = null;
        resize();
      }, RESIZE_DEBOUNCE_MS);
    };
    window.addEventListener("resize", onResize);
    compactQuery?.addEventListener?.("change", onResize);

    const onScroll = () => engine.setScrollProgress(scrollProgress());
    window.addEventListener("scroll", onScroll, { passive: true });

    const onReducedChange = () => engine.setReduced(Boolean(reducedQuery?.matches));
    reducedQuery?.addEventListener?.("change", onReducedChange);

    const onVisibility = () => engine.setHidden(document.visibilityState === "hidden");
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);

    // Arrival: once the fonts are there and the hero lines are posed.
    let arrivalTimer: number | null = null;
    let disposed = false;
    const fontsReady = document.fonts?.ready ?? Promise.resolve();
    void fontsReady.then(() => {
      if (disposed) return;
      arrivalTimer = window.setTimeout(() => {
        arrivalTimer = null;
        engine.startSequence("arrivee");
      }, ARRIVAL_DELAY_MS);
    });

    let sections: IntersectionObserver | null = null;
    if ("IntersectionObserver" in window) {
      // The section crossing the middle band of the viewport is the scene;
      // its first entry plays one salvo (never the hero).
      sections = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const scene = (entry.target as HTMLElement).dataset.livingScene;
            if (!isLivingScene(scene)) continue;
            canvas.dataset.scene = scene;
            engine.enterScene(scene);
          }
        },
        { rootMargin: "-45% 0px -45% 0px" },
      );
      for (const section of document.querySelectorAll<HTMLElement>(`[${SCENE_ATTRIBUTE}]`)) sections.observe(section);
    }

    return () => {
      disposed = true;
      sections?.disconnect();
      if (arrivalTimer !== null) window.clearTimeout(arrivalTimer);
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      reducedQuery?.removeEventListener?.("change", onReducedChange);
      compactQuery?.removeEventListener?.("change", onResize);
      engine.destroy();
    };
  }, [initialScene]);

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        data-testid="living-background"
        data-motion="idle"
        className={styles.canvas}
      />
      <div aria-hidden="true" data-testid="network-atmosphere" className={styles.atmosphere} />
    </>
  );
}
