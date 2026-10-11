import styles from "./LivingBackground.module.css";

/**
 * Fixed background of the landing (docs/design-system.md §2.11.4, revised
 * §2.11.4 bis B): the two hands rendered as a monochrome point cloud, under a
 * static white atmosphere — an illustration, hidden from assistive technology
 * and never interactive. Nothing moves here: the nanorobots live in band 1 of
 * the hero only (`components/landing/hero/`). The former neural-network
 * canvas, already invisible, is gone (no frame, no timer on this layer).
 *
 * Server Component: complete without JavaScript.
 */
export function LivingBackground() {
  return (
    <>
      <div aria-hidden="true" data-testid="particle-handoff-background" className={styles.artwork} />
      <div aria-hidden="true" data-testid="network-atmosphere" className={styles.atmosphere} />
    </>
  );
}
