"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";

import {
  approach,
  clamp,
  GLIDE_TAU_MS,
  isDragGesture,
  MOMENTUM_TAU_MS,
  releaseVelocity,
  revealOffset,
  snapStops,
  snapTarget,
  type PointerSample,
} from "./track-physics";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
/** Width kept clear of the faded edges when an item is brought into view (px). */
const EDGE_INSET = 24;
const MAX_SAMPLES = 12;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && (window.matchMedia?.(REDUCED_MOTION).matches ?? false);
}

type Drag = {
  id: number;
  startX: number;
  startY: number;
  startScroll: number;
  active: boolean;
  samples: PointerSample[];
};

/**
 * Hand-made physics of the agents track (`track-physics.ts` holds the maths).
 *
 * Touch and pen keep the NATIVE scroll with CSS scroll-snap (momentum of the
 * platform). The mouse gets a drag with inertia: past `DRAG_THRESHOLD_PX` the
 * press becomes a drag (snap suspended, pointer captured), the release
 * velocity is projected, snapped to the nearest item, and the track glides
 * there. A drag never selects: the click that follows it is swallowed.
 * Horizontal wheel and trackpad gestures stay native and snap. Reduced motion:
 * the track still follows the hand, but lands on its stop at once.
 *
 * Items are the children flagged `data-snap`; the track exposes
 * `data-at-start` / `data-at-end` (faded edges) and `data-free` while the
 * physics drives it (CSS snap off).
 */
export function useTrackPhysics(trackRef: RefObject<HTMLElement | null>) {
  const frame = useRef<number | null>(null);
  const drag = useRef<Drag | null>(null);
  const swallowClick = useRef(false);

  const updateEdges = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const max = track.scrollWidth - track.clientWidth;
    track.toggleAttribute("data-at-start", track.scrollLeft <= 1);
    track.toggleAttribute("data-at-end", track.scrollLeft >= max - 1);
  }, [trackRef]);

  const stop = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    trackRef.current?.removeAttribute("data-free");
  }, [trackRef]);

  const stops = useCallback((): number[] => {
    const track = trackRef.current;
    if (!track) return [];
    const padding = Number.parseFloat(getComputedStyle(track).scrollPaddingLeft) || 0;
    const items = Array.from(track.querySelectorAll<HTMLElement>("[data-snap]"));
    return snapStops(
      items.map((item) => item.offsetLeft - padding),
      track.scrollWidth - track.clientWidth,
    );
  }, [trackRef]);

  /** Moves the track to `target` along the exponential curve (at once under reduced motion). */
  const glide = useCallback(
    (target: number, tau: number) => {
      const track = trackRef.current;
      if (!track) return;
      stop();
      const goal = clamp(target, 0, track.scrollWidth - track.clientWidth);
      if (prefersReducedMotion() || Math.abs(goal - track.scrollLeft) < 1) {
        track.scrollLeft = goal;
        updateEdges();
        return;
      }
      track.setAttribute("data-free", "");
      let position = track.scrollLeft;
      let last = performance.now();
      const step = (now: number) => {
        position = approach(position, goal, now - last, tau);
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
    [stop, trackRef, updateEdges],
  );

  /** Brings the item `index` fully into view, moving as little as possible. */
  const reveal = useCallback(
    (index: number) => {
      const track = trackRef.current;
      const item = track?.querySelectorAll<HTMLElement>("[data-snap]")[index];
      if (!track || !item) return;
      const target = revealOffset(
        { start: item.offsetLeft, end: item.offsetLeft + item.offsetWidth },
        { position: track.scrollLeft, size: track.clientWidth },
        track.scrollWidth - track.clientWidth,
        EDGE_INSET,
      );
      glide(target, GLIDE_TAU_MS);
    },
    [glide, trackRef],
  );

  // Edges on mount and resize; a touch or a wheel takes over from a glide.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    updateEdges();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateEdges);
    observer?.observe(track);
    const interrupt = () => stop();
    track.addEventListener("touchstart", interrupt, { passive: true });
    track.addEventListener("wheel", interrupt, { passive: true });
    return () => {
      observer?.disconnect();
      track.removeEventListener("touchstart", interrupt);
      track.removeEventListener("wheel", interrupt);
      stop();
    };
  }, [stop, trackRef, updateEdges]);

  function onPointerDown(event: ReactPointerEvent<HTMLElement>) {
    const track = trackRef.current;
    swallowClick.current = false;
    if (!track || event.pointerType !== "mouse" || event.button !== 0) return;
    stop();
    drag.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startScroll: track.scrollLeft,
      active: false,
      samples: [{ t: event.timeStamp, x: track.scrollLeft }],
    };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLElement>) {
    const track = trackRef.current;
    const current = drag.current;
    if (!track || !current || current.id !== event.pointerId) return;
    const dx = event.clientX - current.startX;
    if (!current.active) {
      if (!isDragGesture(dx, event.clientY - current.startY)) return;
      current.active = true;
      track.setPointerCapture?.(event.pointerId);
      track.setAttribute("data-free", "");
      track.setAttribute("data-dragging", "");
    }
    const position = clamp(current.startScroll - dx, 0, track.scrollWidth - track.clientWidth);
    track.scrollLeft = position;
    current.samples.push({ t: event.timeStamp, x: position });
    if (current.samples.length > MAX_SAMPLES) current.samples.shift();
  }

  function endDrag(event: ReactPointerEvent<HTMLElement>, withMomentum: boolean) {
    const track = trackRef.current;
    const current = drag.current;
    if (!track || !current || current.id !== event.pointerId) return;
    drag.current = null;
    if (!current.active) return;
    swallowClick.current = true;
    track.removeAttribute("data-dragging");
    if (track.hasPointerCapture?.(event.pointerId)) track.releasePointerCapture(event.pointerId);
    const velocity = withMomentum ? releaseVelocity(current.samples, event.timeStamp) : 0;
    glide(snapTarget(stops(), track.scrollLeft, velocity), MOMENTUM_TAU_MS);
  }

  function onClickCapture(event: ReactMouseEvent<HTMLElement>) {
    if (!swallowClick.current) return;
    swallowClick.current = false;
    event.preventDefault();
    event.stopPropagation();
  }

  return {
    reveal,
    updateEdges,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: (event: ReactPointerEvent<HTMLElement>) => endDrag(event, true),
      onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => endDrag(event, false),
      onClickCapture,
      onScroll: updateEdges,
      onDragStart: (event: ReactMouseEvent<HTMLElement>) => event.preventDefault(),
    },
  };
}
