// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { REPLAY_EVENT, onReplay, replayGeneration, requestReplay } from "./replay-bus";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("replay bus (docs/design-system.md §2.11.8.8 L4-D)", () => {
  it("uses the spec event name", () => {
    expect(REPLAY_EVENT).toBe("ascend:replay-animations");
  });

  it("bumps data-replay-generation on [data-landing] and notifies every subscriber", () => {
    document.body.innerHTML = `<div data-landing=""></div>`;
    const first = vi.fn();
    const second = vi.fn();
    const offFirst = onReplay(first);
    const offSecond = onReplay(second);

    expect(replayGeneration()).toBe(0);
    expect(requestReplay()).toBe(1);
    expect(document.querySelector("[data-landing]")?.getAttribute("data-replay-generation")).toBe("1");
    expect(first).toHaveBeenCalledWith(1);
    expect(second).toHaveBeenCalledWith(1);

    offFirst();
    expect(requestReplay()).toBe(2);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenLastCalledWith(2);
    offSecond();
  });

  it("works without a landing root (nobody listens outside /)", () => {
    const callback = vi.fn();
    const off = onReplay(callback);
    expect(requestReplay()).toBe(1);
    expect(callback).toHaveBeenCalledWith(1);
    off();
  });

  it("stops notifying after unsubscribe", () => {
    document.body.innerHTML = `<div data-landing=""></div>`;
    const callback = vi.fn();
    onReplay(callback)();
    requestReplay();
    expect(callback).not.toHaveBeenCalled();
  });
});
