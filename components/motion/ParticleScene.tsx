"use client";

import { useEffect, useRef } from "react";
import { createParticles, particlePosition, smoothstep, type ParticlePreset, type Point } from "./particle-presets";

type Props = { preset: ParticlePreset; density?: number; intensity?: number; className?: string; paused?: boolean };

export function ParticleScene({ preset, density = 6000, intensity = 1, className = "", paused = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetRef = useRef(preset);
  const restartRef = useRef<(() => void) | null>(null);
  const clockRef = useRef(0);
  useEffect(() => { targetRef.current = preset; restartRef.current?.(); }, [preset]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const count = Math.max(200, Math.min(13500, Math.round(density)));
    const particles = createParticles(count);
    const positions = new Float32Array(count * 3);
    const origins = new Float32Array(count * 3);
    const point: Point = { x: 0, y: 0, z: 0, alpha: 0 };
    let width = 0, height = 0, frame = 0, visible = true, disposed = false;
    let current = targetRef.current, elapsed = clockRef.current, transitionStart = -2, last = 0, initialized = false;
    const canAnimate = () => !paused && !motion.matches && visible && !document.hidden;

    const draw = (now: number) => {
      frame = 0;
      if (disposed || !width || !height) return;
      if (canAnimate() && last) elapsed += Math.min((now - last) / 1000, .05);
      clockRef.current = elapsed;
      last = now;
      if (current !== targetRef.current) {
        origins.set(positions); current = targetRef.current; transitionStart = elapsed;
      }
      const blend = !initialized || motion.matches ? 1 : smoothstep((elapsed - transitionStart) / .85);
      // Static representatives show the distinctive split/terrain instead of a shared sphere.
      const time = motion.matches ? (current === "agents" || current === "terrain" ? 9 : 2) : elapsed;
      context.clearRect(0, 0, width, height);
      const scale = Math.min(width / 2.4, height / 1.9);
      const rendered = width < 450 ? Math.min(count, 2600) : count;
      for (let i = 0; i < rendered; i++) {
        const p = particles[i];
        if (!p) continue;
        particlePosition(p, current, time, point);
        const j = i * 3;
        const dispersion = Math.sin(blend * Math.PI) * .075;
        const x = (origins[j] ?? 0) * (1 - blend) + point.x * blend + dispersion * Math.cos(p.u * 19);
        const y = (origins[j + 1] ?? 0) * (1 - blend) + point.y * blend + dispersion * Math.sin(p.v * 19);
        const alpha = (origins[j + 2] ?? 0) * (1 - blend) + point.alpha * blend;
        positions[j] = x; positions[j + 1] = y; positions[j + 2] = alpha;
        context.fillStyle = `rgba(39,39,49,${Math.min(.65, alpha * intensity)})`;
        const size = .4 + p.w * .5;
        context.fillRect(width / 2 + x * scale, height / 2 + y * scale, size, size);
      }
      initialized = true;
      canvas.dataset.motion = motion.matches ? "reduced" : paused ? "paused" : "active";
      if (canAnimate()) frame = requestAnimationFrame(draw);
    };
    const restart = () => {
      cancelAnimationFrame(frame); frame = 0; last = 0;
      if (!disposed && visible && !document.hidden) draw(performance.now());
    };
    restartRef.current = restart;
    const resize = () => {
      const rect = canvas.getBoundingClientRect(); width = rect.width; height = rect.height;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0); restart();
    };
    const observer = new ResizeObserver(resize); observer.observe(canvas);
    const intersection = new IntersectionObserver(([entry]) => { visible = entry?.isIntersecting ?? false; restart(); });
    intersection.observe(canvas);
    motion.addEventListener("change", restart);
    document.addEventListener("visibilitychange", restart);
    resize();
    return () => {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect(); intersection.disconnect();
      motion.removeEventListener("change", restart); document.removeEventListener("visibilitychange", restart);
      restartRef.current = null;
    };
  }, [density, intensity, paused]);

  return <canvas ref={canvasRef} aria-hidden="true" data-preset={preset} className={`particle-scene ${className}`} />;
}
