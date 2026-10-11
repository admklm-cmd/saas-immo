"use client";

/**
 * anime.js side of the ROI widgets (docs/design-system.md §2.11.8.8 L4-E):
 * number counting (arrival and slider change) and one arrival timeline per
 * widget. One of the two documented modules that import `animejs` (guard test).
 * Only `transform`, `opacity` and the text of the numbers are animated.
 * anime.js 4 stops requesting frames once no animation is active: after an
 * arrival ends, nothing runs.
 */

import { animate, createTimeline, utils, type JSAnimation, type Timeline } from "animejs";

import { CHANGE_MS } from "./roi-model";

/** A number shown by a widget: its element and how to format a value. */
export type NumberSlot = { el: HTMLElement; format: (value: number) => string };

/** Last value written into each number element (a change starts from it). */
const shown = new WeakMap<HTMLElement, number>();
const tweens = new WeakMap<HTMLElement, JSAnimation>();

/** Writes a value now (start of an arrival, reduced motion, end of a count). */
export function setNumber(slot: NumberSlot, value: number): void {
  tweens.get(slot.el)?.cancel();
  tweens.delete(slot.el);
  shown.set(slot.el, value);
  slot.el.textContent = slot.format(value);
}

/**
 * A slider change: from the displayed value to the new one in 320 ms
 * (`outQuad`); a new change cancels the running one and starts from what is
 * displayed. Reduced motion: instant.
 */
export function tweenNumber(slot: NumberSlot, to: number, motion: boolean): void {
  const from = shown.get(slot.el);
  if (!motion || from === undefined || from === to) {
    setNumber(slot, to);
    return;
  }
  tweens.get(slot.el)?.cancel();
  const counter = { value: from };
  const tween = animate(counter, {
    value: to,
    duration: CHANGE_MS,
    ease: "outQuad",
    onUpdate: () => {
      shown.set(slot.el, counter.value);
      slot.el.textContent = slot.format(counter.value);
    },
    onComplete: () => {
      tweens.delete(slot.el);
      setNumber(slot, to);
    },
  });
  tweens.set(slot.el, tween);
}

export type CountStep = {
  slot: NumberSlot;
  from: number;
  to: number;
  /** Start in the timeline, ms. */
  at: number;
  duration: number;
  ease: string;
};

export type MoveStep = {
  targets: HTMLElement | readonly HTMLElement[];
  /** anime.js properties: transform shorthands and opacity only. */
  props: Record<string, [number, number]>;
  at: number;
  duration: number;
  ease: string;
  /** Delay between the targets, ms (stagger). */
  stagger?: number;
};

/** Inline styles written by a timeline, removed at its end: the CSS final state takes over. */
function clearInline(moves: readonly MoveStep[]): void {
  for (const move of moves) {
    const targets = Array.isArray(move.targets) ? move.targets : [move.targets as HTMLElement];
    for (const target of targets) {
      target.style.removeProperty("transform");
      target.style.removeProperty("opacity");
    }
  }
}

export type Arrival = {
  /** Stops at once (replay, unmount): no callback, inline styles removed. */
  stop: () => void;
  /** Jumps to the end (a slider moved during the arrival, hidden tab). */
  finishNow: () => void;
};

/**
 * One arrival timeline: counts and moves at their positions; `onDone` once at
 * the end, with every number on its final value and the inline styles gone.
 */
export function playArrival(counts: readonly CountStep[], moves: readonly MoveStep[], onDone: () => void): Arrival {
  let ended = false;
  const end = (notify: boolean) => {
    if (ended) return;
    ended = true;
    clearInline(moves);
    for (const count of counts) setNumber(count.slot, count.to);
    if (notify) onDone();
  };
  const timeline: Timeline = createTimeline({ autoplay: true, onComplete: () => end(true) });
  for (const count of counts) {
    setNumber(count.slot, count.from);
    const counter = { value: count.from };
    timeline.add(
      counter,
      {
        value: [count.from, count.to],
        duration: count.duration,
        ease: count.ease,
        onUpdate: () => {
          shown.set(count.slot.el, counter.value);
          count.slot.el.textContent = count.slot.format(counter.value);
        },
      },
      count.at,
    );
  }
  for (const move of moves) {
    const targets = Array.isArray(move.targets) ? [...move.targets] : [move.targets as HTMLElement];
    // The start values are written now (before the first frame): the CSS only hides in `armed`.
    utils.set(targets, Object.fromEntries(Object.entries(move.props).map(([key, [from]]) => [key, from])));
    targets.forEach((target, index) => {
      timeline.add(
        target,
        { ...move.props, duration: move.duration, ease: move.ease },
        move.at + (move.stagger ?? 0) * index,
      );
    });
  }
  return {
    stop: () => {
      if (ended) return;
      timeline.cancel();
      end(false);
    },
    finishNow: () => {
      if (ended) return;
      timeline.cancel();
      end(true);
    },
  };
}
