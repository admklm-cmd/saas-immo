"use client";

import { useEffect, useRef } from "react";
import { animate } from "animejs";

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
const NANO_PARTICLE_COUNT = 34;
/** Sections that drive the background carry this attribute. */
export const SCENE_ATTRIBUTE = "data-living-scene";
/** Text blocks posed outside an opaque surface: impulses fade out around them. */
export const QUIET_ATTRIBUTE = "data-network-quiet";
/** Opaque surfaces (cards, panels): no sequence starts behind them. */
export const COVER_ATTRIBUTE = "data-network-cover";

type NanoParticle = {
  left: number;
  top: number;
  size: number;
  opacity: number;
  driftX: number;
  driftY: number;
  duration: number;
  delay: number;
  accent: boolean;
};

/** Stable pseudo-random particles: identical server/client markup, no hydration jitter. */
function nanoParticles(): NanoParticle[] {
  let seed = 0x51a9d;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x1_0000_0000;
  };
  return Array.from({ length: NANO_PARTICLE_COUNT }, (_, index) => ({
    left: 4 + random() * 92,
    top: 8 + random() * 84,
    size: 1.5 + random() * 2.5,
    opacity: 0.22 + random() * 0.46,
    driftX: 8 + random() * 22,
    driftY: 7 + random() * 20,
    duration: 5_800 + random() * 6_400,
    delay: random() * 1_800,
    accent: index % 11 === 0,
  }));
}

const NANO_PARTICLES = nanoParticles();

/**
 * Living point-field behind the landing (docs/design-system.md §2.11.4) — an
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
  const artworkRef = useRef<HTMLDivElement>(null);
  const nanoFieldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const artwork = artworkRef.current;
    const reduced = window.matchMedia?.(REDUCED_MOTION);
    if (!artwork || reduced?.matches) return;

    const drift = animate(artwork, {
      translateX: ["-0.25%", "0.35%"],
      translateY: ["0%", "-0.3%"],
      scale: [1.02, 1.035],
      opacity: [0.3, 0.38],
      duration: 16_000,
      ease: "inOutQuart",
      loop: true,
      alternate: true,
    });

    return () => {
      drift.cancel();
    };
  }, []);

  useEffect(() => {
    const field = nanoFieldRef.current;
    const reduced = window.matchMedia?.(REDUCED_MOTION);
    if (!field || reduced?.matches) return;

    const motions = Array.from(field.querySelectorAll<HTMLElement>("[data-nano-particle]")).map((particle, index) => {
      const config = NANO_PARTICLES[index];
      if (!config) return null;
      const x = config.driftX * (index % 2 === 0 ? 1 : -1);
      const y = config.driftY * (index % 3 === 0 ? -1 : 1);
      return animate(particle, {
        translateX: [-x * 0.45, x],
        translateY: [-y * 0.4, y],
        scale: [0.72, 1.18],
        opacity: [config.opacity * 0.42, config.opacity],
        duration: config.duration,
        delay: config.delay,
        ease: "inOutSine",
        loop: true,
        alternate: true,
      });
    });

    return () => {
      for (const motion of motions) motion?.cancel();
    };
  }, []);

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
      <div
        ref={artworkRef}
        aria-hidden="true"
        data-testid="particle-handoff-background"
        className={styles.artwork}
      />
      <div ref={nanoFieldRef} aria-hidden="true" data-testid="nano-particle-field" className={styles.nanoField}>
        {NANO_PARTICLES.map((particle, index) => (
          <span
            key={index}
            data-nano-particle=""
            data-accent={particle.accent ? "" : undefined}
            className={styles.nanoParticle}
            style={{
              left: `${particle.left}%`,
              top: `${particle.top}%`,
              width: `${particle.size}px`,
              opacity: particle.opacity,
            }}
          />
        ))}
      </div>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        data-testid="living-background"
        data-motion="idle"
        className={styles.measurementCanvas}
      />
      <div aria-hidden="true" data-testid="network-atmosphere" className={styles.atmosphere} />
    </>
  );
}
