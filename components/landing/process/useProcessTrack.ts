"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react";

import { approach, clamp, GLIDE_TAU_MS } from "../agents/track-physics";
import { useTrackPhysics } from "../agents/useTrackPhysics";
import { nearestStep } from "./process-carousel";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
/** Quiet time after the last scroll event before the centred card is read (ms). */
const SETTLE_MS = 120;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && (window.matchMedia?.(REDUCED_MOTION).matches ?? false);
}

/**
 * The track of the process carousel, CENTRED on its active card, wrapped
 * around the physics of the agents track (`useTrackPhysics`, used as is):
 *
 * - mouse drag, inertia and snapping come from `useTrackPhysics` — its stops
 *   are `item.offsetLeft − scroll-padding-left`, so the track's
 *   scroll-padding is set in px to the side padding that centres a card
 *   (`--process-pad`): every stop then centres a card;
 * - `centre(i)` glides to the card `i` with the same exponential curve
 *   (`approach`, `GLIDE_TAU_MS`); its own `revealOffset` only brings an item
 *   into view, it never centres it;
 * - once the scroll is quiet, `onSettle` receives the card closest to the
 *   centre (drag, touch scroll, trackpad).
 *
 * No frame is requested unless the user moves the track: nothing scrolls on
 * its own. Reduced motion: the track lands at once.
 */
export function useProcessTrack(
  trackRef: RefObject<HTMLElement | null>,
  { active, onSettle }: { active: number; onSettle: (index: number) => void },
) {
  const physics = useTrackPhysics(trackRef);
  const { updateEdges } = physics;
  const frame = useRef<number | null>(null);
  const settle = useRef<number | null>(null);
  const activeRef = useRef(active);
  const onSettleRef = useRef(onSettle);

  useLayoutEffect(() => {
    activeRef.current = active;
    onSettleRef.current = onSettle;
  });

  const stepWidth = useCallback((): number => {
    const cards = trackRef.current?.querySelectorAll<HTMLElement>("[data-snap]");
    const first = cards?.[0];
    const second = cards?.[1];
    if (!first) return 0;
    return second ? second.offsetLeft - first.offsetLeft : first.offsetWidth;
  }, [trackRef]);

  const stopGlide = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);

  // Side padding that centres a card, in px (read back by useTrackPhysics as scroll-padding).
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () => {
      const card = track.querySelector<HTMLElement>("[data-snap]");
      if (!card) return;
      const pad = Math.max(0, (track.clientWidth - card.offsetWidth) / 2);
      track.style.setProperty("--process-pad", `${pad}px`);
      // A resize keeps the active card in the middle, at once.
      track.scrollLeft = activeRef.current * stepWidth();
      updateEdges();
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(track);
    return () => observer?.disconnect();
  }, [stepWidth, trackRef, updateEdges]);

  // A touch or a wheel takes over from a glide; timers die with the component.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    track.addEventListener("touchstart", stopGlide, { passive: true });
    track.addEventListener("wheel", stopGlide, { passive: true });
    return () => {
      track.removeEventListener("touchstart", stopGlide);
      track.removeEventListener("wheel", stopGlide);
      stopGlide();
      if (settle.current !== null) window.clearTimeout(settle.current);
    };
  }, [stopGlide, trackRef]);

  /** Glides so that the card `index` sits in the middle of the track. */
  const centre = useCallback(
    (index: number) => {
      const track = trackRef.current;
      const card = track?.querySelectorAll<HTMLElement>("[data-snap]")[index];
      if (!track || !card) return;
      const pad = Number.parseFloat(getComputedStyle(track).scrollPaddingLeft) || 0;
      const goal = clamp(card.offsetLeft - pad, 0, track.scrollWidth - track.clientWidth);
      stopGlide();
      // A momentum glide of the physics may still run: its own « wheel » listener stops it.
      if (track.hasAttribute("data-free") && !track.hasAttribute("data-dragging")) track.dispatchEvent(new Event("wheel"));
      if (prefersReducedMotion() || Math.abs(goal - track.scrollLeft) < 1) {
        track.scrollLeft = goal;
        updateEdges();
        return;
      }
      track.setAttribute("data-free", "");
      let position = track.scrollLeft;
      let last = performance.now();
      const step = (now: number) => {
        position = approach(position, goal, now - last, GLIDE_TAU_MS);
        last = now;
        track.scrollLeft = position;
        if (position === goal) {
          frame.current = null;
          track.removeAttribute("data-free");
          updateEdges();
          return;
        }
        frame.current = requestAnimationFrame(step);
      };
      frame.current = requestAnimationFrame(step);
    },
    [stopGlide, trackRef, updateEdges],
  );

  function onScroll() {
    physics.handlers.onScroll();
    if (settle.current !== null) window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      settle.current = null;
      const track = trackRef.current;
      if (!track || track.hasAttribute("data-dragging") || frame.current !== null) return;
      onSettleRef.current(nearestStep(track.scrollLeft, stepWidth()));
    }, SETTLE_MS);
  }

  function onPointerDown(event: ReactPointerEvent<HTMLElement>) {
    stopGlide();
    physics.handlers.onPointerDown(event);
  }

  return { centre, handlers: { ...physics.handlers, onPointerDown, onScroll } };
}
