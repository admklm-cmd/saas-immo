"use client";

import { useMemo, useState, type ReactNode } from "react";

import { HeroMotionContext } from "./hero-motion-context";
import { HeroNanoField } from "./HeroNanoField";

/**
 * Band 1 of the hero, the whole width of the window (docs/design-system.md
 * §2.11.4 bis B): the nanorobot layer behind, the content above. It holds
 * the pause of the hero motion, shared by the terminal (its button) and the
 * nanorobots. The content stays rendered by the server (`children`).
 */
export function HeroStage({ children }: { children: ReactNode }) {
  const [stopped, setStopped] = useState(false);
  const motion = useMemo(() => ({ stopped, setStopped }), [stopped]);
  return (
    <HeroMotionContext value={motion}>
      <div className="relative w-full" data-testid="hero-stage">
        <HeroNanoField />
        <div className="relative z-10">{children}</div>
      </div>
    </HeroMotionContext>
  );
}
