// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { canBeMagnetic, canFollowPointer, MAGNET_MAX_PX, magnetOffset, startPointerField, watchPointerField } from "./pointer-field";

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

function mount(html: string): HTMLElement {
  document.body.innerHTML = html;
  const element = document.querySelector<HTMLElement>("[data-testid='target']");
  if (!element) throw new Error("missing target");
  return element;
}

describe("magnetOffset", () => {
  const box = { left: 0, top: 0, width: 100, height: 40 };

  it("does not pull when the pointer is at the centre", () => {
    expect(magnetOffset(box, 50, 20)).toEqual({ x: 0, y: 0 });
  });

  it("is clamped to the maximum pull (3 to 5 px)", () => {
    expect(MAGNET_MAX_PX).toBeGreaterThanOrEqual(3);
    expect(MAGNET_MAX_PX).toBeLessThanOrEqual(5);
    expect(magnetOffset(box, 1000, -1000)).toEqual({ x: MAGNET_MAX_PX, y: -MAGNET_MAX_PX });
  });

  it("ignores an empty box", () => {
    expect(magnetOffset({ left: 0, top: 0, width: 0, height: 0 }, 5, 5)).toEqual({ x: 0, y: 0 });
  });
});

describe("canBeMagnetic / canFollowPointer", () => {
  it("accepts an opted-in control", () => {
    const element = mount(`<button data-testid="target" data-pointer data-magnetic>Ok</button>`);
    expect(canBeMagnetic(element)).toBe(true);
    expect(canFollowPointer(element)).toBe(true);
  });

  it("refuses a destructive control: no pull and no halo", () => {
    const element = mount(`<button data-testid="target" data-magnetic data-destructive>Supprimer</button>`);
    expect(canBeMagnetic(element)).toBe(false);
    expect(canFollowPointer(element)).toBe(false);
  });

  it("refuses anything inside a sensitive form", () => {
    const element = mount(`<form data-sensitive><button data-testid="target" data-pointer data-magnetic>Valider</button></form>`);
    expect(canBeMagnetic(element)).toBe(false);
    expect(canFollowPointer(element)).toBe(false);
  });

  it("refuses a disabled control", () => {
    const element = mount(`<button data-testid="target" data-magnetic disabled>Ok</button>`);
    expect(canBeMagnetic(element)).toBe(false);
  });
});

describe("startPointerField", () => {
  function move(target: Element, pointerType: string) {
    const event = new MouseEvent("pointermove", { bubbles: true, clientX: 90, clientY: 20 });
    Object.defineProperty(event, "pointerType", { value: pointerType });
    target.dispatchEvent(event);
  }

  it("writes the halo position on a mouse move, in one animation frame", () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => frames.push(callback));
    const element = mount(`<button data-testid="target" data-pointer>Ok</button>`);
    const stop = startPointerField(window);
    move(element, "mouse");
    move(element, "mouse");
    expect(frames).toHaveLength(1);
    frames[0]?.(0);
    expect(element.style.getPropertyValue("--pointer-x")).toBe("90px");
    stop();
    expect(element.style.getPropertyValue("--pointer-x")).toBe("");
  });

  it("ignores touch and pen: nothing follows a finger", () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => frames.push(callback));
    const element = mount(`<button data-testid="target" data-pointer>Ok</button>`);
    const stop = startPointerField(window);
    move(element, "touch");
    expect(frames).toHaveLength(0);
    stop();
  });

  it("writes nothing inside a sensitive area", () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => frames.push(callback));
    const element = mount(`<div data-sensitive><button data-testid="target" data-pointer data-magnetic>Ok</button></div>`);
    const stop = startPointerField(window);
    move(element, "mouse");
    frames[0]?.(0);
    expect(element.style.getPropertyValue("--pointer-x")).toBe("");
    expect(element.style.getPropertyValue("--magnet-x")).toBe("");
    stop();
  });
});

describe("watchPointerField", () => {
  function media(matches: Record<string, boolean>) {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({
          matches: matches[query] ?? false,
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList,
    );
  }

  it("stays off on a touch screen", () => {
    window.matchMedia = window.matchMedia ?? (() => ({}) as MediaQueryList);
    media({ "(hover: hover) and (pointer: fine)": false });
    const add = vi.spyOn(document, "addEventListener");
    const stop = watchPointerField(window);
    expect(add).not.toHaveBeenCalledWith("pointermove", expect.anything(), expect.anything());
    stop();
  });

  it("stays off with reduced motion, even with a mouse", () => {
    window.matchMedia = window.matchMedia ?? (() => ({}) as MediaQueryList);
    media({ "(hover: hover) and (pointer: fine)": true, "(prefers-reduced-motion: reduce)": true });
    const add = vi.spyOn(document, "addEventListener");
    const stop = watchPointerField(window);
    expect(add).not.toHaveBeenCalledWith("pointermove", expect.anything(), expect.anything());
    stop();
  });

  it("starts with a mouse and full motion", () => {
    window.matchMedia = window.matchMedia ?? (() => ({}) as MediaQueryList);
    media({ "(hover: hover) and (pointer: fine)": true });
    const add = vi.spyOn(document, "addEventListener");
    const stop = watchPointerField(window);
    expect(add).toHaveBeenCalledWith("pointermove", expect.any(Function), { passive: true });
    stop();
  });
});
