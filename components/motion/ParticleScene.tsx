"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";

import type { Region } from "./engine/layout";
import { ParticleEngine, type ParticleDensity, type ParticleMode, type TransitionOptions } from "./engine/ParticleEngine";
import styles from "./ParticleScene.module.css";
import type { ParticlePreset } from "./shapes";

export type ParticleSceneHandle = {
  /** Morphs towards `preset` from what is displayed (see ParticleEngine.transitionTo). */
  transitionTo: (preset: ParticlePreset, options?: TransitionOptions) => void;
};

export type ParticleSceneProps = {
  preset: ParticlePreset;
  /**
   * "zone" (default): fills its box, count follows the box size.
   * "background": the canvas is fixed to the viewport behind the content (spec §9);
   * count follows the viewport width, opacities .08–.35, adaptive density.
   * Read once at mount.
   */
  mode?: ParticleMode;
  /** Particle count, or "auto" (default). */
  density?: ParticleDensity;
  /** Opacity multiplier (default 1). */
  intensity?: number;
  /** Part of the canvas the shape fits into, normalised (whole canvas by default). */
  region?: Region;
  /** Adaptive density (default: on in background mode). Read once at mount. */
  adaptive?: boolean;
  /** Extra classes (sizing and placement in zone mode). */
  className?: string;
  paused?: boolean;
  /** Development aid: pins the animation clock to this instant, in seconds. */
  frozenTime?: number | null;
  ref?: Ref<ParticleSceneHandle>;
};

/**
 * Decorative particle material. Hidden from assistive technology, never
 * interactive, and never re-rendered by React per frame: the engine owns the
 * canvas. Changing `preset` morphs smoothly to the new shape.
 */
export function ParticleScene({
  preset,
  mode = "zone",
  density = "auto",
  intensity = 1,
  region,
  adaptive,
  className,
  paused = false,
  frozenTime = null,
  ref,
}: ParticleSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ParticleEngine | null>(null);
  // Latest props, so a remount (React Strict Mode) starts from the current state.
  const latest = useRef({ preset, mode, density, intensity, region, adaptive, paused, frozenTime });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const current = latest.current;
    const engine = new ParticleEngine(canvas, {
      preset: current.preset,
      mode: current.mode,
      density: current.density,
      intensity: current.intensity,
      region: current.region,
      adaptive: current.adaptive,
      paused: current.paused,
    });
    engine.setFrozenTime(current.frozenTime);
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    latest.current.preset = preset;
    engineRef.current?.transitionTo(preset);
  }, [preset]);
  useEffect(() => {
    latest.current.density = density;
    engineRef.current?.setDensity(density);
  }, [density]);
  useEffect(() => {
    latest.current.intensity = intensity;
    engineRef.current?.setIntensity(intensity);
  }, [intensity]);
  const regionX = region?.x ?? 0;
  const regionY = region?.y ?? 0;
  const regionWidth = region?.width ?? 1;
  const regionHeight = region?.height ?? 1;
  useEffect(() => {
    const next = { x: regionX, y: regionY, width: regionWidth, height: regionHeight };
    latest.current.region = next;
    engineRef.current?.setRegion(next);
  }, [regionX, regionY, regionWidth, regionHeight]);
  useEffect(() => {
    latest.current.paused = paused;
    engineRef.current?.setPaused(paused);
  }, [paused]);
  useEffect(() => {
    latest.current.frozenTime = frozenTime;
    engineRef.current?.setFrozenTime(frozenTime);
  }, [frozenTime]);

  useImperativeHandle(ref, () => ({ transitionTo: (next, options) => engineRef.current?.transitionTo(next, options) }), []);

  const base = mode === "background" ? `${styles.canvas} ${styles.background}` : styles.canvas;
  const classes = className ? `${base} ${className}` : base;
  return <canvas ref={canvasRef} aria-hidden="true" data-preset={preset} className={classes} />;
}
