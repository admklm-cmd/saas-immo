"use client";

import { createContext } from "react";

/**
 * The pause of the hero motion (docs/design-system.md §2.11.4 bis E,
 * WCAG 2.2.2): set by the button of the terminal, read by the nanorobots.
 * Valid for the page only (no storage).
 */
export type HeroMotion = {
  readonly stopped: boolean;
  readonly setStopped: (stopped: boolean) => void;
};

export const HeroMotionContext = createContext<HeroMotion>({ stopped: false, setStopped: () => {} });
