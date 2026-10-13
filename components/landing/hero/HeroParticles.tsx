"use client";

import { useContext, useEffect, useRef } from "react";

import { onReplay } from "../replay/replay-bus";
import { HeroMotionContext } from "./hero-motion-context";
import styles from "./HeroStage.module.css";
import { HeroParticleEngine, type StageGeometry } from "./particles/HeroParticleEngine";
import { loadBakedHands } from "./particles/hands-data";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const COARSE_POINTER = "(pointer: coarse)";
const RESIZE_DEBOUNCE_MS = 150;
/** Share of the stage on screen below which the loop stops. */
const VISIBLE_SHARE = 0.1;
/** Selector of the free space (between the buttons and the terminal) the shapes are centred on. */
const ZONE = "[data-nano-stage]";

/**
 * The background of band 1 of the hero (docs/design-system.md §2.11.4 ter): ONE canvas of
 * nanoparticles that organise themselves — cloud, ball, apple, the two hands of « La Création
 * d'Adam » — once, then stay on the final image, alive. Decorative: hidden from assistive
 * technology, inert. The loop belongs to `HeroParticleEngine`; this component only connects it to
 * the page: size, visibility, pause (terminal button), replay, reduced motion.
 */
export function HeroParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<HeroParticleEngine | null>(null);
  const { stopped } = useContext(HeroMotionContext);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = canvas?.parentElement;
    if (!canvas || !stage) return;
    const reduced = window.matchMedia?.(REDUCED_MOTION);
    const coarse = window.matchMedia?.(COARSE_POINTER);
    const engine = new HeroParticleEngine(canvas, Boolean(reduced?.matches));
    engineRef.current = engine;

    const geometry = (): StageGeometry => {
      const box = stage.getBoundingClientRect();
      const zone = stage.querySelector<HTMLElement>(ZONE)?.getBoundingClientRect();
      return {
        width: Math.max(1, Math.round(box.width)),
        height: Math.max(1, Math.round(box.height)),
        zone: zone ? { x: zone.left - box.left, y: zone.top - box.top, w: zone.width, h: zone.height } : { x: 0, y: box.height / 2 - 100, w: box.width, h: 200 },
        coarsePointer: Boolean(coarse?.matches),
      };
    };
    engine.setGeometry(geometry());
    engine.setPageVisible(document.visibilityState !== "hidden");

    let disposed = false;
    // If the hands cannot be loaded the sequence holds on the apple: the page stays complete and usable.
    void loadBakedHands()
      .then((baked) => {
        if (!disposed) engine.setHands(baked);
      })
      .catch(() => {});

    let timer: number | null = null;
    const onResize = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        engine.setGeometry(geometry());
      }, RESIZE_DEBOUNCE_MS);
    };
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(onResize);
    resizeObserver?.observe(stage);
    const zone = stage.querySelector(ZONE);
    if (zone) resizeObserver?.observe(zone);

    const intersection =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            (entries) => {
              const entry = entries[entries.length - 1];
              if (entry) engine.setVisible(entry.isIntersecting && entry.intersectionRatio >= VISIBLE_SHARE - 0.001);
            },
            { threshold: [0, VISIBLE_SHARE] },
          );
    intersection?.observe(stage);

    const onVisibility = () => engine.setPageVisible(document.visibilityState !== "hidden");
    const onReduced = () => engine.setReduced(Boolean(reduced?.matches));
    document.addEventListener("visibilitychange", onVisibility);
    reduced?.addEventListener?.("change", onReduced);
    const offReplay = onReplay(() => engine.replay());
    return () => {
      disposed = true;
      if (timer !== null) window.clearTimeout(timer);
      resizeObserver?.disconnect();
      intersection?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      reduced?.removeEventListener?.("change", onReduced);
      offReplay();
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setStopped(stopped);
  }, [stopped]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-testid="hero-particles"
      data-loop="allowed"
      data-phase="cloud"
      data-state="paused"
      data-points="0"
      data-sequence-ms="0"
      className={styles.canvas}
    />
  );
}
