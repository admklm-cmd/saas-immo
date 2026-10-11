"use client";

import { useContext, useEffect, useRef, type CSSProperties } from "react";

import { HeroMotionContext } from "./hero-motion-context";
import { NanoFieldController } from "./nano-field-controller";
import { ENGAGED_OPACITY, REST_OPACITY, linkLength, linkOffset, resolvePair, restOffset, type NanoScreen } from "./nano-exchange";
import { AMBIENT_ROBOTS, PAIR_SEEDS, STILL_LINKED_PAIRS, type PairSeed, type Point } from "./nano-population";
import styles from "./HeroNanoField.module.css";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
/** Same query as the CSS of the layer: a phone, or a coarse pointer. */
const COMPACT = "(max-width: 767px), (pointer: coarse)";
const RESIZE_DEBOUNCE_MS = 150;
/** Share of the layer on screen below which it pauses. */
const VISIBLE_SHARE = 0.1;

/**
 * Server estimate, on a phone, of the free space above the terminal in % of
 * the layer (measured at 390 × 844): the client replaces it with the measured
 * rectangle at once. Computer and tablet anchors are exact percentages.
 */
const COMPACT_FREE_SPACE = { left: 6.15, top: 49, width: 87.7, height: 11.55 };

type StillPose = { a: Point; b: Point; linked: boolean; wire: Point; angle: number; length: number };

function stillPose(seed: PairSeed, screen: NanoScreen): StillPose {
  const geometry = resolvePair(seed, { x: 0, y: 0 }, screen, []);
  const linked = STILL_LINKED_PAIRS.includes(seed.id);
  const pose = linked ? linkOffset : restOffset;
  return { a: pose(geometry, "a"), b: pose(geometry, "b"), linked, wire: linkOffset(geometry, "a"), angle: geometry.angle, length: linkLength(geometry) };
}

const px = (value: number) => `${value.toFixed(2)}px`;

/** The static composition of the server HTML (and of reduced motion): pairs 3 and 4 linked, the others at rest. */
const PAIRS = PAIR_SEEDS.map((seed) => {
  const large = stillPose(seed, "large");
  const compact = stillPose(seed, "compact");
  const compactAnchor = seed.compactAnchor
    ? { x: COMPACT_FREE_SPACE.left + (seed.compactAnchor.x / 100) * COMPACT_FREE_SPACE.width, y: COMPACT_FREE_SPACE.top + (seed.compactAnchor.y / 100) * COMPACT_FREE_SPACE.height }
    : seed.anchor;
  return { seed, large, compact, compactAnchor };
});

/**
 * The nanorobots of the hero (docs/design-system.md §2.11.4 bis): 48 ambient
 * robots drifting slowly and 8 pairs of actors that come together, touch,
 * link for a second by a 1 px wire and pass a cobalt bit — 32 + 4 pairs on a
 * phone. Band 1 of the hero only, behind the text (veils), inert and hidden
 * from assistive technology. An illustration (fictitious example,
 * simulation): it reads no real state.
 *
 * The server HTML is the still composition (also the reduced-motion state);
 * the motion is driven by `NanoFieldController` (Anime.js, transform and
 * opacity only), paused off screen, in a hidden tab and on the pause button.
 */
export function HeroNanoField() {
  const fieldRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<NanoFieldController | null>(null);
  const { stopped } = useContext(HeroMotionContext);

  useEffect(() => {
    const field = fieldRef.current;
    const stage = field?.parentElement;
    if (!field || !stage) return;
    const reducedQuery = window.matchMedia?.(REDUCED_MOTION);
    const compactQuery = window.matchMedia?.(COMPACT);
    const compact = () => Boolean(compactQuery?.matches);
    const controller = new NanoFieldController(field, stage, { reduced: Boolean(reducedQuery?.matches), compact: compact() });
    controllerRef.current = controller;

    let resizeTimer: number | null = null;
    const onResize = () => {
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        resizeTimer = null;
        controller.resize(compact());
      }, RESIZE_DEBOUNCE_MS);
    };
    const onReduced = () => controller.setReduced(Boolean(reducedQuery?.matches));
    const onVisibility = () => controller.setPageVisible(document.visibilityState !== "hidden");
    const observer =
      "IntersectionObserver" in window
        ? new IntersectionObserver(
            (entries) => {
              const entry = entries[entries.length - 1];
              if (entry) controller.setOnScreen(entry.isIntersecting && entry.intersectionRatio >= VISIBLE_SHARE - 0.001);
            },
            { threshold: [0, VISIBLE_SHARE] },
          )
        : null;

    let disposed = false;
    // Measured once the fonts are there: the text rectangles are final.
    void (document.fonts?.ready ?? Promise.resolve()).then(() => {
      if (disposed) return;
      controller.init(compact());
      controller.setPageVisible(document.visibilityState !== "hidden");
      if (observer) observer.observe(field);
      else controller.setOnScreen(true);
    });
    window.addEventListener("resize", onResize);
    compactQuery?.addEventListener?.("change", onResize);
    reducedQuery?.addEventListener?.("change", onReduced);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      disposed = true;
      observer?.disconnect();
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
      compactQuery?.removeEventListener?.("change", onResize);
      reducedQuery?.removeEventListener?.("change", onReduced);
      document.removeEventListener("visibilitychange", onVisibility);
      controller.dispose();
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    controllerRef.current?.setStopped(stopped);
  }, [stopped]);

  return (
    <div
      ref={fieldRef}
      aria-hidden="true"
      data-testid="hero-nanorobots"
      data-loop="allowed"
      data-loop-state="paused"
      data-exchanges="0"
      data-exchanges-active="0"
      className={styles.field}
    >
      {AMBIENT_ROBOTS.map((robot, index) => (
        <span
          key={index}
          data-nano-robot="ambient"
          data-shape={robot.shape}
          data-compact-hidden={robot.compactHidden ? "" : undefined}
          className={styles.ambient}
          style={{ left: `${robot.left.toFixed(3)}%`, top: `${robot.top.toFixed(3)}%`, width: px(robot.size), opacity: robot.opacity }}
        />
      ))}
      {PAIRS.map(({ seed, large, compact, compactAnchor }) => {
        const vars = {
          "--ax": `${seed.anchor.x}%`,
          "--ay": `${seed.anchor.y}%`,
          "--ax-c": `${compactAnchor.x.toFixed(3)}%`,
          "--ay-c": `${compactAnchor.y.toFixed(3)}%`,
        } as CSSProperties;
        const actor = (role: "a" | "b") => {
          const vars = {
            "--tx-l": px(large[role].x),
            "--ty-l": px(large[role].y),
            "--tx-c": px(compact[role].x),
            "--ty-c": px(compact[role].y),
            opacity: large.linked ? ENGAGED_OPACITY : REST_OPACITY,
          } as CSSProperties;
          // Port of B lit in the still composition; on a phone, on one pair only (one cobalt point).
          const lit = large.linked && role === "b";
          const port = { "--po-l": lit ? 1 : 0, "--po-c": lit && seed.id === STILL_LINKED_PAIRS[0] ? 1 : 0 } as CSSProperties;
          return (
            <span data-nano-robot="actor" data-pair={seed.id} data-role={role} data-phase={large.linked ? "link" : "idle"} className={styles.actor} style={vars}>
              <span data-nano-port="" className={styles.port} style={port} />
            </span>
          );
        };
        return (
          <div key={seed.id} data-nano-pair={seed.id} data-compact-hidden={seed.compactAnchor ? undefined : ""} className={styles.pair} style={vars}>
            <span
              data-nano-wire=""
              className={styles.wire}
              style={{ transform: `translate(${px(large.wire.x)}, ${px(large.wire.y)}) rotate(${large.angle.toFixed(2)}deg)` }}
            >
              <span
                data-nano-link=""
                className={styles.link}
                style={{ width: px(large.length), transform: `scaleX(${large.linked ? 1 : 0})`, opacity: large.linked ? 1 : 0 }}
              />
              <span data-nano-bit="" className={styles.bit} />
            </span>
            {actor("a")}
            {actor("b")}
          </div>
        );
      })}
    </div>
  );
}
