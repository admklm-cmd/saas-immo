"use client";

import { useEffect, useRef, useState } from "react";

import { loadBakedHands } from "@/components/landing/hero/particles/hands-data";

import { PromoOverlay } from "./PromoOverlay";
import { collectRefs, updatePromoDom } from "./promo-dom";
import { parseHex, paintFrame, type Palette } from "./promo-draw";
import type { PromoDemo } from "./promo-demo";
import { layoutOf, type PromoFormat } from "./promo-format";
import { computePoints, createPointBuffer } from "./promo-points";
import { buildScene } from "./promo-scene";
import { DURATION_MS } from "./promo-timeline";

/** The handle the export script (and the tests) use: `seek` draws one complete frame synchronously. */
export type PromoApi = {
  ready: Promise<void>;
  durationMs: number;
  format: PromoFormat;
  seek: (ms: number) => void;
};

declare global {
  interface Window {
    __promo?: PromoApi;
  }
}

type Props = {
  format: PromoFormat;
  /** Fixed position (ms): export and stills. `null` = free preview in the browser. */
  fixedTime: number | null;
  demo: PromoDemo;
};

const PREVIEW_TEXTS = { play: "Lire", pause: "Pause", restart: "Revenir au début", hint: "Aperçu de la vidéo (développement). L'export passe par window.__promo.seek." } as const;

function readPalette(): Palette {
  const style = getComputedStyle(document.documentElement);
  const read = (name: string) => parseHex(style.getPropertyValue(name));
  return {
    pearl: read("--color-pearl-soft"),
    ink: read("--color-ink"),
    inverse: read("--color-ink-inverse"),
    accent: read("--color-accent"),
    surface: read("--color-surface"),
  };
}

function loadLogo(): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("logo"));
    image.src = "/brand/ascend-symbol-black.png";
  });
}

export function PromoStage({ format, fixedTime, demo }: Props) {
  const layout = layoutOf(format);
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const marksRef = useRef<HTMLCanvasElement>(null);
  const seekRef = useRef<(ms: number) => void>(() => {});
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [scale, setScale] = useState(1);
  const preview = fixedTime === null;

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const marksCanvas = marksRef.current;
    const context = canvas.getContext("2d");
    const marksContext = marksCanvas?.getContext("2d");
    if (!context || !marksContext) return;
    const ctx: CanvasRenderingContext2D = context;
    const marks: CanvasRenderingContext2D = marksContext;
    let engine: { render: (t: number) => void } | null = null;

    const ready$ = (async () => {
      const [baked, logo] = await Promise.all([loadBakedHands(), loadLogo()]);
      await document.fonts.ready;
      const scene = buildScene(layout, baked, demo);
      const buffer = createPointBuffer(scene.n);
      const palette = readPalette();
      const refs = collectRefs(root);
      const assets = { logo, logoAspect: logo.naturalWidth / logo.naturalHeight };
      engine = {
        render(t: number) {
          const clamped = Math.min(DURATION_MS, Math.max(0, t));
          computePoints(scene, clamped, buffer);
          paintFrame(ctx, marks, scene, buffer, clamped, palette, assets);
          updatePromoDom(refs, layout, clamped);
        },
      };
    })();

    const api: PromoApi = {
      ready: ready$,
      durationMs: DURATION_MS,
      format,
      seek(ms: number) {
        engine?.render(ms);
      },
    };
    window.__promo = api;
    seekRef.current = api.seek;

    let cancelled = false;
    void ready$.then(() => {
      if (cancelled) return;
      // Free preview under reduced motion shows the poster; export and stills show the fixed time.
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      engine?.render(fixedTime ?? (reduced ? DURATION_MS : 0));
      root.dataset.ready = "true";
      setReady(true);
    });
    return () => {
      cancelled = true;
      delete window.__promo;
    };
  }, [layout, format, fixedTime, demo]);

  // Free preview: scale the 1:1 stage to the window (the internal rendering is unchanged).
  useEffect(() => {
    if (!preview) return;
    const fit = () => setScale(Math.min((window.innerWidth - 32) / layout.width, (window.innerHeight - 96) / layout.height, 1));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [preview, layout]);

  // Free preview playback: the clock is the rAF timestamp, only ever used here, never by the export.
  const clockRef = useRef({ origin: 0, base: 0 });
  useEffect(() => {
    if (!preview || !playing || !ready) return;
    let frame = 0;
    const tick = (stamp: number) => {
      if (clockRef.current.origin === 0) clockRef.current.origin = stamp;
      const t = clockRef.current.base + (stamp - clockRef.current.origin);
      if (t >= DURATION_MS) {
        seekRef.current(DURATION_MS);
        clockRef.current = { origin: 0, base: DURATION_MS };
        setPlaying(false);
        return;
      }
      seekRef.current(t);
      frame = requestAnimationFrame(tick);
    };
    clockRef.current.origin = 0;
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      clockRef.current = { origin: 0, base: clockRef.current.base };
    };
  }, [playing, preview, ready]);

  const stage = (
    <div
      ref={rootRef}
      className="promo-stage"
      data-format={format}
      style={{ position: "relative", width: layout.width, height: layout.height, overflow: "hidden", background: "var(--color-pearl-soft)" }}
    >
      <canvas ref={canvasRef} width={layout.width} height={layout.height} style={{ position: "absolute", inset: 0, width: layout.width, height: layout.height }} />
      <PromoOverlay layout={layout} demo={demo} />
      <canvas ref={marksRef} width={layout.width} height={layout.height} style={{ position: "absolute", inset: 0, width: layout.width, height: layout.height, pointerEvents: "none" }} />
    </div>
  );

  if (!preview) {
    return <div style={{ position: "fixed", left: 0, top: 0, zIndex: 2_147_483_000 }}>{stage}</div>;
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-ink)", padding: 16 }}>
      <div style={{ width: layout.width * scale, height: layout.height * scale, margin: "0 auto", overflow: "hidden", borderRadius: 12 }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: layout.width, height: layout.height }}>{stage}</div>
      </div>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", alignItems: "center", marginTop: 16, color: "var(--color-ink-inverse-muted)", fontFamily: "var(--font-sans)", fontSize: 14 }}>
        <button
          type="button"
          disabled={!ready}
          onClick={() => {
            if (!playing && clockRef.current.base >= DURATION_MS) clockRef.current.base = 0;
            setPlaying((value) => !value);
          }}
          style={{ padding: "8px 16px", borderRadius: 999, background: "var(--color-ink-inverse)", color: "var(--color-ink)", fontWeight: 600 }}
        >
          {playing ? PREVIEW_TEXTS.pause : PREVIEW_TEXTS.play}
        </button>
        <button
          type="button"
          disabled={!ready}
          onClick={() => {
            setPlaying(false);
            clockRef.current = { origin: 0, base: 0 };
            seekRef.current(0);
          }}
          style={{ padding: "8px 16px", borderRadius: 999, border: "1px solid var(--color-ink-inverse-muted)", color: "var(--color-ink-inverse)" }}
        >
          {PREVIEW_TEXTS.restart}
        </button>
        <span>{PREVIEW_TEXTS.hint}</span>
      </div>
    </div>
  );
}
