/**
 * Adapted from React Bits — TechText (https://reactbits.dev)
 *
 * Drives the brand wordmark canvas (docs/design-system.md §2.11.3): the
 * one-time sweep, the hover outline and frame (fine pointer), the drag and
 * its spring (mouse, pen), the tap (touch). A `requestAnimationFrame` runs
 * only while something moves; at rest the canvas is cleared and the HTML
 * letters are shown again (`data-wordmark-state="idle"`). Never prevents the
 * default of any event: the page always scrolls.
 */

import {
  CLICK_SLOP_PX,
  LEAVE_MS,
  POINTER_IDLE_MS,
  REACH_EM,
  SWEEP_GLIDE_MS,
  TAP_MAX_MS,
  TAP_SHOW_MS,
  capDrag,
  createSpecks,
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
} from "./tech-wordmark";
import {
  frameBoxOf,
  measureLetters,
  paintFrame,
  paintLetters,
  paintSpecks,
  type LetterPaint,
  type MeasuredLetter,
  type Palette,
} from "./paint-wordmark";

export type WordmarkState = "idle" | "sweep" | "active";

const FINE_HOVER = "(hover: hover) and (pointer: fine)";
const MAX_DPR = 2;

/** Moves `value` toward `target` by at most `step`. */
function approach(value: number, target: number, step: number): number {
  if (Math.abs(target - value) <= step) return target;
  return value + Math.sign(target - value) * step;
}

export class WordmarkEngine {
  private state: WordmarkState = "idle";
  private context: CanvasRenderingContext2D | null;
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
  private press: { x: number; y: number; time: number } | null = null;
  private tap: { letter: number; until: number } | null = null;
  private sweepStart: number | null = null;
  private raf: number | null = null;
  private lastTime = 0;
  private frames = 0;

  constructor(
    private readonly root: HTMLElement,
    private readonly canvas: HTMLCanvasElement,
  ) {
    this.context = canvas.getContext("2d");
    this.setState("idle");
  }

  /** The one-time sweep. Skipped if the pointer is already playing with the word. */
  startSweep(): void {
    if (this.state !== "idle" || !this.wake()) return;
    this.sweepStart = performance.now();
    this.setState("sweep");
  }

  pointerMove(event: PointerEvent): void {
    const point = this.toCanvas(event);
    if (this.drag && event.pointerId === this.drag.pointerId) {
      const dx = point.x - this.drag.startX;
      const dy = point.y - this.drag.startY;
      if (!this.drag.moved && Math.hypot(dx, dy) > CLICK_SLOP_PX) this.drag.moved = true;
      if (this.drag.moved) {
        const offset = capDrag(dx, dy, this.em);
        this.drag.dx = offset.x;
        this.drag.dy = offset.y;
      }
    }
    if (event.pointerType === "touch") {
      if (this.press && Math.hypot(event.clientX - this.press.x, event.clientY - this.press.y) > CLICK_SLOP_PX) this.press = null;
      return;
    }
    if (!window.matchMedia?.(FINE_HOVER).matches && !this.drag) return;
    this.pointer = { x: point.x, y: point.y, lastMove: performance.now() };
    this.sweepStart = null;
    if (this.wake()) this.setState("active");
  }

  pointerLeave(event: PointerEvent): void {
    if (event.pointerType === "touch") return;
    this.pointer = null;
    this.request();
  }

  pointerDown(event: PointerEvent): void {
    if (event.pointerType === "touch") {
      this.press = { x: event.clientX, y: event.clientY, time: performance.now() };
      return;
    }
    if (event.button !== 0 || !this.wake()) return;
    const point = this.toCanvas(event);
    const index = letterAt(point.x, point.y, this.letters.map((letter) => letter.box));
    if (index < 0) return;
    this.root.setPointerCapture?.(event.pointerId);
    this.sweepStart = null;
    this.spring = null;
    this.drag = { index, pointerId: event.pointerId, startX: point.x, startY: point.y, dx: 0, dy: 0, moved: false };
    this.setState("active");
  }

  pointerUp(event: PointerEvent): void {
    if (event.pointerType === "touch") {
      const press = this.press;
      this.press = null;
      if (!press || event.type !== "pointerup" || performance.now() - press.time > TAP_MAX_MS) return;
      if (!this.wake()) return;
      const point = this.toCanvas(event);
      const letter = letterAt(point.x, point.y, this.letters.map((item) => item.box));
      if (letter < 0) return;
      this.sweepStart = null;
      this.tap = { letter, until: performance.now() + TAP_SHOW_MS };
      this.setState("active");
      return;
    }
    this.release();
  }

  /** Escape, pointer cancel, pointer up: the dragged letter springs home. */
  release(): void {
    if (!this.drag) return;
    const { index, dx, dy, moved, pointerId } = this.drag;
    if (this.root.hasPointerCapture?.(pointerId)) this.root.releasePointerCapture(pointerId);
    this.drag = null;
    if (moved) this.spring = { index, value: { x: dx, y: dy, vx: 0, vy: 0 } };
    this.request();
  }

  /** Hidden tab, unmount: everything stops, back to the HTML letters. */
  reset(): void {
    this.sweepStart = null;
    this.pointer = null;
    this.drag = null;
    this.spring = null;
    this.tap = null;
    this.press = null;
    this.specks = null;
    this.goIdle();
  }

  remeasure(): void {
    if (this.state !== "idle") this.measure();
  }

  // -------------------------------------------------------------------------

  private setState(state: WordmarkState): void {
    this.state = state;
    this.root.dataset.wordmarkState = state;
  }

  /** Measures and shows the canvas on the first active frame. False if not paintable. */
  private wake(): boolean {
    if (!this.context) return false;
    if (this.state === "idle") {
      this.measure();
      if (this.letters.length === 0) return false;
      this.root.dataset.painting = "";
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
    const spans = Array.from(this.root.querySelectorAll<HTMLElement>("[data-letter]"));
    const measured = measureLetters(context, spans, this.canvas.getBoundingClientRect());
    this.letters = measured.letters;
    this.font = measured.font;
    this.em = measured.em;
    if (this.outline.length !== this.letters.length) this.outline = this.letters.map(() => 0);
    const style = getComputedStyle(this.root);
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
    if (this.raf === null && this.root.dataset.painting !== undefined) this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (now: number): void => {
    this.raf = null;
    const dt = this.lastTime ? Math.min(now - this.lastTime, 64) : 16;
    this.lastTime = now;
    const moving = this.update(now, dt);
    this.draw(now);
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
    let moving = false;

    if (this.sweepStart !== null) {
      const sweep = sweepAt(now - this.sweepStart, this.letters.length);
      if (sweep.done) {
        this.sweepStart = null;
        this.frameOpacity = 0;
        this.outline = this.outline.map(() => 0);
        this.frameLetter = -1;
        this.glide = null;
        this.sweepBox = null;
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

    // Pointer, drag, tap.
    if (this.tap && now >= this.tap.until) this.tap = null;
    const pointer = this.pointer;
    const targets = centres.map((centre) => (pointer ? outlineAmount(Math.hypot(centre.x - pointer.x, centre.y - pointer.y), reach) : 0));
    const step = dt / LEAVE_MS;
    this.outline = this.outline.map((value, index) => approach(value, targets[index] ?? 0, step));
    if (this.outline.some((value, index) => value !== targets[index])) moving = true;

    const boxes = this.letters.map((letter) => letter.ink);
    const wanted = this.drag?.index ?? this.tap?.letter ?? (pointer ? nearestLetter(pointer.x, pointer.y, boxes) : -1);
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

    if (this.spring) {
      this.spring.value = stepSpring(this.spring.value, dt);
      if (springAtRest(this.spring.value)) this.spring = null;
      else moving = true;
    }
    if (pointer && now - pointer.lastMove > POINTER_IDLE_MS) this.specks = null;
    if (this.updateSpecks(now)) moving = true;
    if (this.tap) moving = true;
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
    if (this.sweepStart !== null && this.sweepBox) return this.sweepBox;
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
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    paintLetters(context, this.letters, this.letters.map((_, index) => this.paintOf(index)), this.font, this.palette);
    const box = this.currentFrameBox(now);
    const framed = this.letters[this.frameLetter];
    if (box && framed) paintFrame(context, box, { letter: framed }, this.frameOpacity, this.palette);
    const speckLetter = this.specks ? this.letters[this.specks.letter] : undefined;
    if (this.specks && speckLetter) paintSpecks(context, speckLetter, this.specks.list, now - this.specks.start, this.em, this.palette);
    this.frames += 1;
    this.root.dataset.wordmarkFrames = String(this.frames);
  }

  private atRest(): boolean {
    return (
      this.sweepStart === null &&
      this.pointer === null &&
      this.drag === null &&
      this.spring === null &&
      this.tap === null &&
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
    this.context?.clearRect(0, 0, this.canvas.width, this.canvas.height);
    delete this.root.dataset.painting;
    this.setState("idle");
  }
}
