"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import { onReplay } from "../replay/replay-bus";
import { HeroMotionContext } from "./hero-motion-context";

/**
 * Holds the pause of the landing motion (docs/design-system.md T.7, WCAG 2.2.2): one state, set by the
 * button of the terminal and by the fixed « Pause » button, read by the hero canvas AND by the particle
 * field of the page (the two are siblings in the page, so the provider sits above both). « Rejouer les
 * animations » releases it. Valid for the page only (no storage).
 */
export function HeroMotionProvider({ children }: { children: ReactNode }) {
  const [stopped, setStopped] = useState(false);
  const motion = useMemo(() => ({ stopped, setStopped }), [stopped]);
  useEffect(() => onReplay(() => setStopped(false)), []);
  return <HeroMotionContext value={motion}>{children}</HeroMotionContext>;
}
