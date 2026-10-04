// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { requestReplay } from "@/components/landing/replay/replay-bus";

import { Reveal } from "./Reveal";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("keeps its content visible when IntersectionObserver is unavailable", () => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
  render(<Reveal>Contenu utile</Reveal>);
  expect(screen.getByText("Contenu utile").dataset.reveal).toBe("visible");
});

it("reveals content on its first intersection", () => {
  let callback: IntersectionObserverCallback | undefined;
  const disconnect = vi.fn();
  const observe = vi.fn();
  class ObserverMock {
    constructor(nextCallback: IntersectionObserverCallback) {
      callback = nextCallback;
    }
    observe = observe;
    disconnect = disconnect;
    unobserve = vi.fn();
    takeRecords = vi.fn(() => []);
    root = null;
    rootMargin = "";
    thresholds = [];
  }

  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
  vi.stubGlobal("IntersectionObserver", ObserverMock);
  render(<Reveal>Contenu observé</Reveal>);

  const wrapper = screen.getByText("Contenu observé");
  expect(wrapper.dataset.reveal).toBe("hidden");
  act(() => {
    callback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
  });
  expect(wrapper.dataset.reveal).toBe("entering");
  expect(disconnect).toHaveBeenCalled();
});

it("goes back to hidden, then entering, on « Rejouer les animations » (§2.11.8.8 L4-D)", () => {
  const callbacks: IntersectionObserverCallback[] = [];
  class ObserverMock {
    constructor(nextCallback: IntersectionObserverCallback) {
      callbacks.push(nextCallback);
    }
    observe = vi.fn();
    disconnect = vi.fn();
    unobserve = vi.fn();
    takeRecords = vi.fn(() => []);
    root = null;
    rootMargin = "";
    thresholds = [];
  }

  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
  vi.stubGlobal("IntersectionObserver", ObserverMock);
  render(<Reveal>Contenu rejoué</Reveal>);
  const wrapper = screen.getByText("Contenu rejoué");
  act(() => {
    callbacks.at(-1)?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
  });
  expect(wrapper.dataset.reveal).toBe("entering");

  act(() => {
    requestReplay();
  });
  expect(wrapper.dataset.reveal).toBe("hidden");
  expect(callbacks).toHaveLength(2);
  act(() => {
    callbacks.at(-1)?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
  });
  expect(wrapper.dataset.reveal).toBe("entering");
});
