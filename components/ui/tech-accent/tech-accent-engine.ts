/**
 * Adapted from React Bits — TechText (https://reactbits.dev)
 * Copyright (c) 2026 David Haz — MIT + Commons Clause License Condition v1.0:
 * full notice in THIRD_PARTY_NOTICES.md (keep it; never sell or redistribute
 * this component on its own).
 *
 * Drives the canvas of the `tech` accented word (docs/design-system.md
 * §2.11.8.2): the sweep (on arrival, replayed on hover), the pointer follow
 * (fine pointer), the drag and its spring (mouse, pen). A
 * `requestAnimationFrame` runs only while something moves; at rest the canvas
 * is cleared and the HTML letters are shown again (`data-tech-state="idle"` on
 * the title). Never prevents the default of any event: the page always scrolls.
 */

import {
  CLICK_SLOP_PX,
  LEAVE_MS,
  POINTER_IDLE_MS,
  REACH_EM,
  SWEEP_GLIDE_MS,
  capDrag,
  createSpecks,
  distanceToWord,
  easeEmphasis,
  letterAt,
  mixBox,
  nearestLetter,
  outlineAmount,
  speckCount,
  specksDuration,
  springAtRest,
  stepSpring,
  sweepAt,
  type LetterBox,
  type Speck,
  type Spring,
} from "./tech-accent";
import {
  frameBoxOf,
  measureLetters,
  paintFrame,
  paintLetters,
  paintSpecks,
  type LetterPaint,
  type MeasuredLetter,
  type Palette,
} from "./paint-tech-accent";

export type TechState = "idle" | "sweep" | "follow" | "drag" | "spring";
export type SweepKind = "arrival" | "replay";

const FINE_HOVER = "(hover: hover) and (pointer: fine)";
const MAX_DPR = 2;
/** The pointer wakes the canvas only inside the word box widened by this, in em. */
const WAKE_MARGIN_EM = 1;

/** Moves `value` toward `target` by at most `step`. */
function approach(value: number, target: number, step: number): number {
  if (Math.abs(target - value) <= step) return target;
  return value + Math.sign(target - value) * step;
}

function isMouseOrPen(event: PointerEvent): boolean {
  return event.pointerType === "mouse" || event.pointerType === "pen";
}

export class TechAccentEngine {
  private state: TechState = "idle";
  private context: CanvasRenderingContext2D | null;
  private painting = false;
  private letters: MeasuredLetter[] = [];
  private font = "";
  private em = 0;
  private palette: Palette = { ink: "", accent: "", surface: "", labelFont: "" };
  private outline: number[] = [];
  private frameLetter = -1;
  private frameOpacity = 0;
  private glide: { from: LetterBox; start: number } | null = null;
  /** Frame box while the sweep plays (it carries its own glide). */
  private sweepBox: LetterBox | null = null;
  private specks: { letter: number; start: number; list: Speck[] } | null = null;
  private pointer: { x: number; y: number; lastMove: number } | null = null;
  private drag: { index: number; pointerId: number; startX: number; startY: number; dx: number; dy: number; moved: boolean } | null = null;
  private spring: { index: number; value: Spring } | null = null;
  private sweep: { start: number; kind: SweepKind } | null = null;
  private raf: number | null = null;
  private lastTime = 0;
  private frames = 0;

  constructor(
    /** The `h1`/`h2`: state attributes, pointer capture. */
    private readonly title: HTMLElement,
    /** The word: its letters (`[data-letter]`), `data-painting`. */
    private readonly host: HTMLElement,
    private readonly canvas: HTMLCanvasElement,
    /** Called once when a sweep ends, played to its end or taken over by the pointer. */
    private readonly onSweepEnd: (kind: SweepKind) => void = () => {},
  ) {
    this.context = canvas.getContext("2d");
    this.setState("idle");
  }

  get current(): TechState {
    return this.state;
  }

  /** Plays the sweep from its start. False when it cannot paint (no context, no letter). */
  startSweep(kind: SweepKind): boolean {
    if (this.drag || this.spring || this.pointer) return false;
    if (!this.wake()) return false;
    this.endSweep();
    this.sweep = { start: performance.now(), kind };
    this.setState("sweep");
    return true;
  }

  pointerMove(event: PointerEvent): void {
    if (!isMouseOrPen(event)) return;
    if (this.drag && event.pointerId === this.drag.pointerId) {
      const point = this.toCanvas(event);
      const dx = point.x - this.drag.startX;
      const dy = point.y - this.drag.startY;
      if (!this.drag.moved && Math.hypot(dx, dy) > CLICK_SLOP_PX) this.drag.moved = true;
      if (this.drag.moved) {
        const offset = capDrag(dx, dy, this.em);
        this.drag.dx = offset.x;
        this.drag.dy = offset.y;
      }
      this.pointer = { ...point, lastMove: performance.now() };
      this.request();
      return;
    }
    if (!window.matchMedia?.(FINE_HOVER).matches) return;
    // Cheap test first: far from the word, nothing is measured nor painted.
    if (!this.nearWordBox(event)) {
      this.dropPointer();
      return;
    }
    if (!this.wake()) return;
    const point = this.toCanvas(event);
    const near = distanceToWord(point.x, point.y, this.letters.map((letter) => letter.ink)) <= REACH_EM * this.em;
    if (!near) {
      this.dropPointer();
      return;
    }
    // The pointer takes over: a sweep in flight stops where it is.
    if (this.sweep) {
      this.glide = this.sweepBox && this.frameOpacity > 0 ? { from: this.sweepBox, start: performance.now() } : null;
      this.endSweep();
    }
    this.pointer = { x: point.x, y: point.y, lastMove: performance.now() };
    this.request();
  }

  /** The pointer left the title: back to plain ink in 200 ms. */
  pointerLeave(event: PointerEvent): void {
    if (!isMouseOrPen(event) || this.drag) return;
    this.dropPointer();
  }

  pointerDown(event: PointerEvent): void {
    if (!isMouseOrPen(event) || event.button !== 0) return;
    if (!this.nearWordBox(event) || !this.wake()) return;
    const point = this.toCanvas(event);
    const index = letterAt(point.x, point.y, this.letters.map((letter) => letter.box));
    if (index < 0) return;
    this.title.setPointerCapture?.(event.pointerId);
    this.endSweep();
    this.spring = null;
    this.drag = { index, pointerId: event.pointerId, startX: point.x, startY: point.y, dx: 0, dy: 0, moved: false };
    this.pointer = { x: point.x, y: point.y, lastMove: performance.now() };
    this.request();
  }

  pointerUp(event: PointerEvent): void {
    if (!isMouseOrPen(event)) return;
    this.release();
  }

  /** Escape, pointer cancel, pointer up: the dragged letter springs home. */
  release(): void {
    if (!this.drag) return;
    const { index, dx, dy, moved, pointerId } = this.drag;
    if (this.title.hasPointerCapture?.(pointerId)) this.title.releasePointerCapture(pointerId);
    this.drag = null;
    if (moved) this.spring = { index, value: { x: dx, y: dy, vx: 0, vy: 0 } };
    this.request();
  }

  /** Hidden tab, unmount: everything stops, back to the HTML letters. */
  reset(): void {
    this.endSweep();
    this.pointer = null;
    this.drag = null;
    this.spring = null;
    this.specks = null;
    this.goIdle();
  }

  remeasure(): void {
    if (this.painting) this.measure();
  }

  // -------------------------------------------------------------------------

  private setState(state: TechState): void {
    this.state = state;
    this.title.dataset.techState = state;
  }

  private endSweep(): void {
    const sweep = this.sweep;
    if (!sweep) return;
    this.sweep = null;
    this.sweepBox = null;
    this.onSweepEnd(sweep.kind);
  }

  private dropPointer(): void {
    if (!this.pointer) return;
    this.pointer = null;
    this.request();
  }

  private nearWordBox(event: PointerEvent): boolean {
    const rect = this.host.getBoundingClientRect();
    const margin = WAKE_MARGIN_EM * (this.em || parseFloat(getComputedStyle(this.host).fontSize) || 0);
    return (
      event.clientX >= rect.left - margin &&
      event.clientX <= rect.right + margin &&
      event.clientY >= rect.top - margin &&
      event.clientY <= rect.bottom + margin
    );
  }

  /** Measures and shows the canvas on the first active frame. False if not paintable. */
  private wake(): boolean {
    if (!this.context) return false;
    if (!this.painting) {
      this.measure();
      if (this.letters.length === 0) return false;
      this.painting = true;
      this.host.dataset.painting = "";
    }
    this.request();
    return true;
  }

  private measure(): void {
    const context = this.context;
    if (!context) return;
    const ratio = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const spans = Array.from(this.host.querySelectorAll<HTMLElement>("[data-letter]"));
    const measured = measureLetters(context, spans, this.canvas.getBoundingClientRect());
    this.letters = measured.letters;
    this.font = measured.font;
    this.em = measured.em;
    if (this.outline.length !== this.letters.length) this.outline = this.letters.map(() => 0);
    const style = getComputedStyle(this.host);
    this.palette = {
      ink: style.getPropertyValue("--color-ink").trim() || style.color,
      accent: style.getPropertyValue("--color-accent").trim(),
      surface: style.getPropertyValue("--color-surface").trim(),
      labelFont: `500 11px ${style.getPropertyValue("--font-mono").trim() || "monospace"}`,
    };
  }

  private toCanvas(event: PointerEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  /** Asks for one frame; never while idle (nothing to paint at rest). */
  private request(): void {
    if (this.raf === null && this.painting) this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (now: number): void => {
    this.raf = null;
    const dt = this.lastTime ? Math.min(now - this.lastTime, 64) : 16;
    this.lastTime = now;
    const moving = this.update(now, dt);
    this.draw(now);
    this.setState(this.sweep ? "sweep" : this.drag ? "drag" : this.spring ? "spring" : "follow");
    if (moving) {
      this.raf = requestAnimationFrame(this.tick);
      return;
    }
    this.lastTime = 0;
    if (this.atRest()) this.goIdle();
  };

  /** Advances every effect; true while something still moves. */
  private update(now: number, dt: number): boolean {
    const centres = this.letters.map((letter) => ({ x: letter.ink.x + letter.ink.width / 2, y: letter.ink.y + letter.ink.height / 2 }));
    const reach = REACH_EM * this.em;

    if (this.sweep) {
      const sweep = sweepAt(now - this.sweep.start, this.letters.length);
      if (sweep.done) {
        this.endSweep();
        this.frameOpacity = 0;
        this.outline = this.outline.map(() => 0);
        this.frameLetter = -1;
        this.glide = null;
        // The sweep ends with its frame (≤ 1.6 s): no speck outlives it.
        this.specks = null;
        return false;
      }
      const from = Math.floor(sweep.position);
      const to = Math.min(from + 1, this.letters.length - 1);
      const a = this.letters[from];
      const b = this.letters[to];
      if (a && b) {
        const box = mixBox(frameBoxOf(a, undefined), frameBoxOf(b, undefined), sweep.position - from);
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        this.outline = centres.map((centre) => outlineAmount(Math.hypot(centre.x - cx, centre.y - cy), reach) * sweep.opacity);
        this.sweepBox = box;
      }
      if (sweep.letter !== this.frameLetter) this.startSpecks(sweep.letter, now);
      this.frameLetter = sweep.letter;
      this.frameOpacity = sweep.opacity;
      this.updateSpecks(now);
      return true;
    }

    let moving = false;
    const pointer = this.pointer;
    const targets = centres.map((centre) => (pointer ? outlineAmount(Math.hypot(centre.x - pointer.x, centre.y - pointer.y), reach) : 0));
    const step = dt / LEAVE_MS;
    this.outline = this.outline.map((value, index) => approach(value, targets[index] ?? 0, step));
    if (this.outline.some((value, index) => value !== targets[index])) moving = true;

    const boxes = this.letters.map((letter) => letter.ink);
    const wanted = this.drag?.index ?? (pointer ? nearestLetter(pointer.x, pointer.y, boxes) : -1);
    if (wanted >= 0 && wanted !== this.frameLetter) {
      const current = this.currentFrameBox(now);
      this.glide = current && this.frameOpacity > 0 ? { from: current, start: now } : null;
      if (pointer && !this.drag) this.startSpecks(wanted, now);
      this.frameLetter = wanted;
    }
    const frameTarget = wanted >= 0 ? 1 : 0;
    this.frameOpacity = approach(this.frameOpacity, frameTarget, step);
    if (this.frameOpacity !== frameTarget) moving = true;
    if (this.frameOpacity === 0 && frameTarget === 0) this.frameLetter = -1;
    if (this.glide && now - this.glide.start < SWEEP_GLIDE_MS) moving = true;
    else this.glide = null;

    if (this.spring) {
      this.spring.value = stepSpring(this.spring.value, dt);
      if (springAtRest(this.spring.value)) this.spring = null;
      else moving = true;
    }
    if (this.drag) moving = true;
    if (pointer && now - pointer.lastMove > POINTER_IDLE_MS) this.specks = null;
    if (this.updateSpecks(now)) moving = true;
    return moving;
  }

  private startSpecks(letter: number, now: number): void {
    const large = window.innerWidth >= 768 && Boolean(window.matchMedia?.(FINE_HOVER).matches);
    this.specks = { letter, start: now, list: createSpecks(speckCount(large), letter) };
  }

  private updateSpecks(now: number): boolean {
    if (this.specks && now - this.specks.start > specksDuration(this.specks.list.length)) this.specks = null;
    return this.specks !== null;
  }

  private currentFrameBox(now: number): LetterBox | null {
    const letter = this.letters[this.frameLetter];
    if (!letter) return null;
    if (this.sweep && this.sweepBox) return this.sweepBox;
    const target = frameBoxOf(letter, this.paintOf(this.frameLetter));
    if (!this.glide) return target;
    const progress = Math.min((now - this.glide.start) / SWEEP_GLIDE_MS, 1);
    return progress >= 1 ? target : mixBox(this.glide.from, target, easeEmphasis(progress));
  }

  private paintOf(index: number): LetterPaint {
    const outline = this.outline[index] ?? 0;
    if (this.drag?.index === index) return { outline, dx: this.drag.dx, dy: this.drag.dy };
    if (this.spring?.index === index) return { outline, dx: this.spring.value.x, dy: this.spring.value.y };
    return { outline, dx: 0, dy: 0 };
  }

  private draw(now: number): void {
    const context = this.context;
    if (!context) return;
    const started = performance.now();
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    paintLetters(context, this.letters, this.letters.map((_, index) => this.paintOf(index)), this.font, this.palette);
    const box = this.currentFrameBox(now);
    const framed = this.letters[this.frameLetter];
    if (box && framed) paintFrame(context, box, { letter: framed }, this.frameOpacity, this.palette);
    const speckLetter = this.specks ? this.letters[this.specks.letter] : undefined;
    if (this.specks && speckLetter) paintSpecks(context, speckLetter, this.specks.list, now - this.specks.start, this.em, this.palette);
    this.frames += 1;
    // Test hooks: painted frames, cost of the last one (ms), offset of the held letter (px).
    this.title.dataset.techFrames = String(this.frames);
    this.title.dataset.techCost = (performance.now() - started).toFixed(2);
    const held = this.drag ?? (this.spring ? { dx: this.spring.value.x, dy: this.spring.value.y } : null);
    this.title.dataset.techOffset = held ? Math.hypot(held.dx, held.dy).toFixed(2) : "0";
  }

  private atRest(): boolean {
    return (
      this.sweep === null &&
      this.pointer === null &&
      this.drag === null &&
      this.spring === null &&
      this.frameOpacity === 0 &&
      this.outline.every((value) => value === 0)
    );
  }

  private goIdle(): void {
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.lastTime = 0;
    this.frameLetter = -1;
    this.frameOpacity = 0;
    this.glide = null;
    this.sweepBox = null;
    this.outline = this.outline.map(() => 0);
    this.context?.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.painting = false;
    delete this.host.dataset.painting;
    this.setState("idle");
  }
}
