"use client";

import { useEffect, useRef } from "react";

import { DUST, createDust, dustCount, stepDust } from "./page-dust";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/**
 * Fixed background of the landing below the hero (docs/design-system.md §2.11.4 ter J): small
 * pale particles drifting very slowly on white, behind every content. The opaque stage of the
 * hero covers them, so they only show from the end of the hero down. `aria-hidden`, inert. The
 * image of the hands is gone from here (it is the end of the hero animation). 30 frames/s on a timer
 * (no requestAnimationFrame), stopped in a hidden tab; one still frame under reduced motion.
 */
export function LivingBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduced = window.matchMedia?.(REDUCED_MOTION);
    const ink = getComputedStyle(canvas).getPropertyValue("--color-ink").trim() || getComputedStyle(canvas).color;
    let width = 1;
    let height = 1;
    let dust = createDust(dustCount(window.innerWidth));
    let timer: number | null = null;
    let last = 0;

    const draw = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = ink;
      for (let plane = 0; plane < DUST.planes.length; plane++) {
        ctx.globalAlpha = DUST.planes[plane]!.alpha;
        ctx.beginPath();
        for (let i = 0; i < dust.count; i++) {
          if (dust.plane[i] !== plane) continue;
          const size = dust.size[i]!;
          ctx.rect(dust.x[i]! * width - size / 2, dust.y[i]! * height - size / 2, size, size);
        }
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
      const wanted = dustCount(width);
      if (wanted !== dust.count) dust = createDust(wanted);
      draw();
    };
    // A slow 30 frames/s timer, not requestAnimationFrame: nothing here is worth a display-synchronised frame,
    // and the page keeps requesting none of its own while nothing else moves.
    const step = () => {
      const now = performance.now();
      const seconds = Math.min(now - last, 100) / 1000;
      last = now;
      stepDust(dust, seconds, width, height);
      draw();
    };
    const run = () => {
      const moving = !reduced?.matches && document.visibilityState !== "hidden";
      canvas.dataset.loopState = moving ? "playing" : "paused";
      if (moving && timer === null) {
        last = performance.now();
        timer = window.setInterval(step, DUST.frameMs);
      } else if (!moving && timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
    };
    resize();
    run();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", run);
    reduced?.addEventListener?.("change", run);
    return () => {
      if (timer !== null) window.clearInterval(timer);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", run);
      reduced?.removeEventListener?.("change", run);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-testid="page-dust"
      data-loop="allowed"
      data-loop-state="paused"
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
    />
  );
}
