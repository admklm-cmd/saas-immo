/**
 * Pointer-driven effects of the controls — docs/design-system.md §2.5.9.
 *
 * ONE delegated `pointermove` listener on the document, whatever the number of
 * controls on screen. Each move is coalesced into a single
 * `requestAnimationFrame`, which writes custom properties directly on the
 * hovered element — no React state, no render per move:
 *   * `--pointer-x` / `--pointer-y` on any `[data-pointer]` element (border
 *     halo of buttons and clickable cards, `interactions.css`);
 *   * `--magnet-x` / `--magnet-y` on a `[data-magnetic]` control, a pull of
 *     `MAGNET_MAX_PX` at most, towards the pointer.
 *
 * Never magnetic: a destructive control (`[data-destructive]`), a disabled one,
 * or anything inside a sensitive form (`[data-sensitive]`: sign-in, estimation,
 * validation or refusal of a message, stage or mandate change, kill switch).
 *
 * Active only with a precise hovering pointer and without reduced motion; it
 * detaches itself when either setting changes, and `stop()` removes every
 * listener and resets what it wrote.
 */

export const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** Maximum magnetic pull, in CSS pixels (plan: 3 to 5 px). */
export const MAGNET_MAX_PX = 4;

export type Box = { left: number; top: number; width: number; height: number };

/**
 * Pull towards the pointer, proportional to its distance from the centre and
 * clamped to `max` on each axis. Pure: unit-tested on its own.
 */
export function magnetOffset(box: Box, clientX: number, clientY: number, max = MAGNET_MAX_PX): { x: number; y: number } {
  if (box.width <= 0 || box.height <= 0) return { x: 0, y: 0 };
  const dx = (clientX - (box.left + box.width / 2)) / (box.width / 2);
  const dy = (clientY - (box.top + box.height / 2)) / (box.height / 2);
  const clamp = (value: number) => Math.max(-1, Math.min(1, value));
  const round = (value: number) => Math.round(value * 100) / 100;
  return { x: round(clamp(dx) * max), y: round(clamp(dy) * max) };
}

/**
 * True when the element may receive any pointer effect at all (halo or pull):
 * never a destructive control, never anything inside a sensitive area.
 */
export function canFollowPointer(element: Element): boolean {
  if (element.matches("[data-destructive]")) return false;
  return element.closest("[data-sensitive]") === null;
}

/** True when the control may follow the pointer (see the module comment). */
export function canBeMagnetic(element: Element): boolean {
  if (!element.matches("[data-magnetic]")) return false;
  if (element.matches("[data-destructive], :disabled, [aria-disabled='true'], [aria-busy='true']")) return false;
  return element.closest("[data-sensitive]") === null;
}

function reset(element: HTMLElement): void {
  element.style.removeProperty("--magnet-x");
  element.style.removeProperty("--magnet-y");
  element.style.removeProperty("--pointer-x");
  element.style.removeProperty("--pointer-y");
}

/** Attaches the field to a window. Returns the function that detaches it. */
export function startPointerField(win: Window): () => void {
  const doc = win.document;
  let current: HTMLElement | null = null;
  let frame = 0;
  let last: { x: number; y: number; target: EventTarget | null } | null = null;

  const apply = () => {
    frame = 0;
    if (!last) return;
    const origin = last.target instanceof Element ? last.target : null;
    const hovered = origin?.closest("[data-pointer]") ?? null;
    const target = hovered instanceof HTMLElement && canFollowPointer(hovered) ? hovered : null;

    if (current && current !== target) reset(current);
    current = target;
    if (!target) return;

    const rect = target.getBoundingClientRect();
    // The rect already includes the current pull: remove it, so the pull never
    // feeds back into itself.
    const pullX = Number.parseFloat(target.style.getPropertyValue("--magnet-x")) || 0;
    const pullY = Number.parseFloat(target.style.getPropertyValue("--magnet-y")) || 0;
    const box = { left: rect.left - pullX, top: rect.top - pullY, width: rect.width, height: rect.height };

    target.style.setProperty("--pointer-x", `${Math.round(last.x - box.left)}px`);
    target.style.setProperty("--pointer-y", `${Math.round(last.y - box.top)}px`);

    if (canBeMagnetic(target)) {
      const pull = magnetOffset(box, last.x, last.y);
      target.style.setProperty("--magnet-x", `${pull.x}px`);
      target.style.setProperty("--magnet-y", `${pull.y}px`);
    }
  };

  const onMove = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    last = { x: event.clientX, y: event.clientY, target: event.target };
    if (!frame) frame = win.requestAnimationFrame(apply);
  };

  const onLeave = (event: PointerEvent) => {
    // Leaving the window: everything goes back to rest.
    if (event.relatedTarget !== null) return;
    last = null;
    if (current) reset(current);
    current = null;
  };

  doc.addEventListener("pointermove", onMove, { passive: true });
  doc.addEventListener("pointerout", onLeave, { passive: true });

  return () => {
    doc.removeEventListener("pointermove", onMove);
    doc.removeEventListener("pointerout", onLeave);
    if (frame) win.cancelAnimationFrame(frame);
    frame = 0;
    if (current) reset(current);
    current = null;
    last = null;
  };
}

/**
 * Starts the field only while the settings allow it, and follows them live.
 * Returns the cleanup of everything (media listeners included).
 */
export function watchPointerField(win: Window): () => void {
  if (typeof win.matchMedia !== "function") return () => {};
  const fine = win.matchMedia(FINE_POINTER_QUERY);
  const reduced = win.matchMedia(REDUCED_MOTION_QUERY);
  let stop: (() => void) | null = null;

  const sync = () => {
    const allowed = fine.matches && !reduced.matches;
    if (allowed && !stop) stop = startPointerField(win);
    if (!allowed && stop) {
      stop();
      stop = null;
    }
  };

  sync();
  fine.addEventListener("change", sync);
  reduced.addEventListener("change", sync);
  return () => {
    fine.removeEventListener("change", sync);
    reduced.removeEventListener("change", sync);
    stop?.();
    stop = null;
  };
}
