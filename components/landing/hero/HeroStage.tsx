"use client";

import type { ReactNode } from "react";

import { HeroParticles } from "./HeroParticles";
import styles from "./HeroStage.module.css";

/**
 * Band 1 of the hero, the whole width of the window (docs/design-system.md §2.11.4 ter F): the
 * particle canvas behind, the content above. The pause of the motion (terminal button, fixed « Pause »
 * button) lives in `HeroMotionProvider`, above this stage and the page background. The content stays
 * rendered by the server (`children`). Without JavaScript, `<noscript>` shows the final image as a
 * still poster.
 */
export function HeroStage({ children }: { children: ReactNode }) {
  return (
    <div className={`relative w-full ${styles.stage}`} data-testid="hero-stage">
      <HeroParticles />
      <noscript>
        {/* Decorative poster, only without JavaScript: next/image needs the client runtime. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/hero/hands-poster.webp" alt="" aria-hidden="true" className={styles.poster} />
      </noscript>
      <div className="relative z-10">{children}</div>
      {/* One pixel at the end of the opaque stage: the page field watches it to know when the hero stops covering the window. */}
      <div aria-hidden="true" data-hero-end="" className="pointer-events-none absolute inset-x-0 bottom-0 h-px" />
    </div>
  );
}
