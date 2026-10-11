"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { LANDING_TEXTS } from "@/components/landing-texts";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { SimulationBadge } from "@/components/ui/SimulationBadge";

import { ConvergingLines, type ConvergingColumn } from "./ConvergingLines";
import { CursorYou } from "./CursorYou";
import { EcosystemBlock, type EcosystemBlockTexts } from "./EcosystemBlock";
import { onReplay } from "../replay/replay-bus";
import { convergingGeometry, cursorPoint } from "./ecosystem-geometry";
import {
  CURSOR_MOVES,
  EcosystemLoop,
  STEP_TIMES,
  checkKey,
  finalFrame,
  frameAt,
  type CursorTarget,
  type LoopSnapshot,
} from "./ecosystem-timeline";
import styles from "./ecosystem.module.css";

const TEXTS = LANDING_TEXTS.journey;
const BLOCKS: readonly EcosystemBlockTexts[] = TEXTS.blocks;
/** Where the still cursor of the server HTML sits: the last move of the cycle (« Mandat confirmé »). */
const STILL_AT = CURSOR_MOVES.at(-1)?.target;
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
/** Wide layouts (rows of columns, converging lines); below, a carousel with dots. */
const WIDE = "(min-width: 64rem)";
/** Share of the figure that must be on screen for the loop to play. */
const VISIBLE_SHARE = 0.25;

function subscribeMotion(onChange: () => void): () => void {
  const query = window.matchMedia?.(REDUCED_MOTION);
  query?.addEventListener?.("change", onChange);
  return () => query?.removeEventListener?.("change", onChange);
}

/** Motion welcome on this device (false on the server: the still final state first). */
function useMotionWelcome(): boolean {
  return useSyncExternalStore(
    subscribeMotion,
    // No matchMedia (old engine, test DOM): treated as still.
    () => (typeof window.matchMedia === "function" ? !window.matchMedia(REDUCED_MOTION).matches : false),
    () => false,
  );
}

/**
 * Block A of the hero (docs/design-system.md §2.11.8.8 L4-A): three blocks —
 * Acquisition (Léa, Hugo, Emma), Validation humaine, Suivi (Louis, Sarah) —
 * each marked by an app tile. The agents check their own work; the « Vous »
 * cursor — the advisor — checks the first message, then, once Sarah has
 * flagged it, confirms the mandate. Labelled « Exemple fictif — simulation »;
 * it reads no real data and claims no activity.
 *
 * The ONLY loop of the landing (decision of the user): 24 s cycles driven by
 * one timer (`EcosystemLoop`), CSS transitions for the motion, never
 * `requestAnimationFrame`, never an infinite CSS animation. Paused off screen
 * (< 25 %) and in a hidden tab; still on its final state under reduced motion.
 * The server HTML is that final state, with a still cursor on the mandate.
 */
export function HeroEcosystem() {
  const figureRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const motion = useMotionWelcome();
  const [loop, setLoop] = useState<LoopSnapshot>({ status: "paused", index: null, cycles: 0 });
  const [lines, setLines] = useState<{ columns: ConvergingColumn[]; target: { x: number; y: number } } | null>(null);
  const [activeDot, setActiveDot] = useState(0);

  const frame = useMemo(() => (loop.index === null ? finalFrame() : frameAt(STEP_TIMES[loop.index] ?? 0)), [loop.index]);
  const pressedKey = frame.pressed && frame.cursor !== "park" ? checkKey(frame.cursor) : null;
  const cursorKey = frame.cursor === "park" ? "park" : checkKey(frame.cursor);
  /** The current target, for the effects that measure (resize, first placement). */
  const targetRef = useRef<CursorTarget>(frame.cursor);
  useEffect(() => {
    targetRef.current = frame.cursor;
  }, [frame.cursor]);

  /** FLIP move of the live cursor: measured target, transform with a transition (0 = jump). */
  const placeCursor = useCallback((target: CursorTarget, ms: number) => {
    const cursor = cursorRef.current;
    const track = trackRef.current;
    if (!cursor || !track) return;
    const point = cursorPoint(track, target);
    if (!point) return;
    cursor.style.transition = ms > 0 ? `transform ${ms}ms var(--ease-emphasis)` : "none";
    cursor.style.transform = `translate(${point.x}px, ${point.y}px)`;
  }, []);

  // The loop: on screen ≥ 25 %, visible tab, motion welcome.
  useEffect(() => {
    const figure = figureRef.current;
    if (!figure) return;
    const reduced = window.matchMedia?.(REDUCED_MOTION);
    const engine = new EcosystemLoop(
      {
        now: () => performance.now(),
        setTimeout: (callback, ms) => window.setTimeout(callback, ms),
        clearTimeout: (id) => window.clearTimeout(id),
      },
      setLoop,
    );
    engine.setReduced(Boolean(reduced?.matches));
    // « Rejouer les animations » (L4-D): the cycle restarts at t = 0, now if on screen, else on return.
    const offReplay = onReplay(() => engine.restart());
    engine.setPageVisible(document.visibilityState !== "hidden");
    const observer =
      "IntersectionObserver" in window
        ? new IntersectionObserver(
            (entries) => {
              const entry = entries[entries.length - 1];
              if (entry) engine.setOnScreen(entry.isIntersecting && entry.intersectionRatio >= VISIBLE_SHARE - 0.001);
            },
            { threshold: [0, VISIBLE_SHARE] },
          )
        : null;
    observer?.observe(figure);
    const onVisibility = () => engine.setPageVisible(document.visibilityState !== "hidden");
    const onReduced = () => engine.setReduced(Boolean(reduced?.matches));
    document.addEventListener("visibilitychange", onVisibility);
    reduced?.addEventListener?.("change", onReduced);
    return () => {
      offReplay();
      observer?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      reduced?.removeEventListener?.("change", onReduced);
      engine.dispose();
    };
  }, []);

  // The cursor glides when its target changes; it jumps on its first placement.
  const placedRef = useRef(false);
  useEffect(() => {
    if (!motion) {
      placedRef.current = false;
      return;
    }
    placeCursor(targetRef.current, placedRef.current && loop.index !== null ? frame.cursorMs : 0);
    placedRef.current = true;
    // `cursorKey` is the trigger; the duration belongs to the move that set it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motion, cursorKey, placeCursor]);

  // Measures: converging lines (wide layouts) and the cursor, on every resize.
  useEffect(() => {
    const stage = stageRef.current;
    const track = trackRef.current;
    if (!stage || !track) return;
    const wide = window.matchMedia?.(WIDE);
    const measure = () => {
      placeCursor(targetRef.current, 0);
      const action = actionRef.current;
      if (!wide?.matches || !action) {
        setLines(null);
        return;
      }
      setLines(convergingGeometry(stage, track, action));
    };
    measure();
    const observer = "ResizeObserver" in window ? new ResizeObserver(measure) : null;
    observer?.observe(stage);
    void document.fonts?.ready.then(measure);
    return () => observer?.disconnect();
  }, [placeCursor, motion]);

  /** Carousel (< 1024 px): the dot of the block nearest to the centre of the track. */
  const onTrackScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track || window.matchMedia?.(WIDE).matches) return;
    const centre = track.scrollLeft + track.clientWidth / 2;
    let best = 0;
    let bestDistance = Infinity;
    Array.from(track.querySelectorAll<HTMLElement>("[data-block]")).forEach((card, index) => {
      const distance = Math.abs(card.offsetLeft + card.offsetWidth / 2 - centre);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    });
    setActiveDot(best);
  }, []);

  const goTo = useCallback((index: number) => {
    const track = trackRef.current;
    const card = track?.querySelectorAll<HTMLElement>("[data-block]")[index];
    if (!track || !card) return;
    const still = window.matchMedia?.(REDUCED_MOTION).matches;
    track.scrollTo({ left: card.offsetLeft - (track.clientWidth - card.offsetWidth) / 2, behavior: still ? "auto" : "smooth" });
    setActiveDot(index);
  }, []);


  return (
    <figure
      ref={figureRef}
      aria-labelledby="hero-ecosystem-title"
      className={styles.figure}
      data-testid="hero-ecosystem"
      data-loop="allowed"
      data-loop-state={loop.status}
      data-loop-cycles={loop.cycles}
      data-step={loop.index ?? "final"}
      data-cursor-mode={motion ? "live" : "still"}
    >
      <span id="hero-ecosystem-title" className="sr-only">
        {TEXTS.title}
      </span>

      <div className={styles.legend}>
        <span className="particle-veil particle-veil-tight flex w-fit items-center gap-2" data-network-quiet="" data-testid="hero-ecosystem-label">
          <SimulationBadge />
          <span className="text-xs font-medium text-ink-muted">{TEXTS.badge}</span>
        </span>
      </div>

      <div ref={stageRef} className={styles.stage}>
        <div className={styles.viewport} aria-hidden="true">
          <div ref={trackRef} className={styles.track} onScroll={onTrackScroll} data-testid="ecosystem-track">
            {/* DOM order = reading order (Acquisition, Validation humaine, Suivi); the grid places them. */}
            {BLOCKS.map((entry, index) => (
              <EcosystemBlock
                key={entry.key}
                block={entry}
                index={index}
                frame={frame}
                pressedKey={pressedKey}
                stillAt={STILL_AT === "park" ? undefined : STILL_AT}
                stillCursor={<CursorYou label={TEXTS.cursor} className={styles.cursorStill} testId="ecosystem-cursor-still" />}
              />
            ))}
            {motion ? <CursorYou ref={cursorRef} label={TEXTS.cursor} pressed={frame.pressed} className={styles.cursorLive} testId="ecosystem-cursor" /> : null}
          </div>
        </div>

        <ConvergingLines columns={lines?.columns ?? []} target={lines?.target ?? null} />

        <div className={styles.dots} role="group" aria-label={TEXTS.dots.label}>
          {BLOCKS.map((entry, index) => (
            <button
              key={entry.key}
              type="button"
              className={styles.dot}
              aria-label={TEXTS.dots.item.replace("{n}", String(index + 1)).replace("{nom}", entry.name)}
              aria-current={index === activeDot ? "step" : undefined}
              onClick={() => goTo(index)}
            >
              <span className={styles.dotMark} />
            </button>
          ))}
        </div>

        <div ref={actionRef} className={styles.action}>
          <ButtonLink href="/estimation" size="lg" arrow="forward" className={styles.actionButton}>
            {LANDING_TEXTS.actions.estimation}
          </ButtonLink>
        </div>
      </div>

      <p className={styles.guard} data-network-cover="" data-testid="ecosystem-guard">
        {TEXTS.guard.map((segment) =>
          "strong" in segment && segment.strong ? (
            <strong key={segment.text} className="font-medium text-ink">
              {segment.text}
            </strong>
          ) : (
            <span key={segment.text}>{segment.text}</span>
          ),
        )}
      </p>
      <div className={styles.notes}>
        <p className="particle-veil particle-veil-tight w-fit text-xs text-ink-subtle" data-network-quiet="">
          {TEXTS.note}
        </p>
        <p className="particle-veil particle-veil-tight w-fit text-xs text-ink-subtle" data-network-quiet="">
          {LANDING_TEXTS.hero.illustrationNote}
        </p>
      </div>

      {/* Read instead of the drawing: the final state, static, never announced during the loop. */}
      <ul className="sr-only" data-testid="ecosystem-summary">
        {TEXTS.srSummary.map((sentence) => (
          <li key={sentence}>{sentence}</li>
        ))}
      </ul>
    </figure>
  );
}
