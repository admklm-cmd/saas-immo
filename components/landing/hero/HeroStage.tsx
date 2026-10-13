"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import { onReplay } from "../replay/replay-bus";
import { HeroMotionContext } from "./hero-motion-context";
import { HeroParticles } from "./HeroParticles";
import styles from "./HeroStage.module.css";

/**
 * Band 1 of the hero, the whole width of the window (docs/design-system.md §2.11.4 ter F): the
 * particle canvas behind, the content above. It holds the pause of the hero motion, shared by
 * the terminal (its button) and the canvas; « Rejouer les animations » releases it. The content
 * stays rendered by the server (`children`). Without JavaScript, `<noscript>` shows the final
 * image as a still poster.
 */
export function HeroStage({ children }: { children: ReactNode }) {
  const [stopped, setStopped] = useState(false);
  const motion = useMemo(() => ({ stopped, setStopped }), [stopped]);
  useEffect(() => onReplay(() => setStopped(false)), []);
  return (
    <HeroMotionContext value={motion}>
      <div className={`relative w-full ${styles.stage}`} data-testid="hero-stage">
        <HeroParticles />
        <noscript>
          {/* Decorative poster, only without JavaScript: next/image needs the client runtime. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/hero/hands-poster.webp" alt="" aria-hidden="true" className={styles.poster} />
        </noscript>
        <div className="relative z-10">{children}</div>
      </div>
    </HeroMotionContext>
  );
}
