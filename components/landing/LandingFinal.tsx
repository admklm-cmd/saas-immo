import { LANDING_TEXTS } from "@/components/landing-texts";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Reveal } from "@/components/ui/Reveal";

import { LandingHeading } from "./LandingHeading";
import { ProcessCarousel } from "./process/ProcessCarousel";
import styles from "./process/final.module.css";

const TEXTS = LANDING_TEXTS.final;
const ACTIONS = LANDING_TEXTS.actions;

/**
 * Final call to action — block C (docs/design-system.md §2.11.8.5): the only
 * black panel of the page, out of the 7xl column. In order: the title centred
 * in white, WITHOUT effect (§2.11.8.2), one paragraph, the two actions of the
 * hero (light, then light outline) with the prototype note as their caption,
 * then the process carousel of the seven steps. Nothing moves on its own.
 */
export function LandingFinal() {
  return (
    <section
      aria-labelledby="final-title"
      data-living-scene="final"
      className="w-full px-2 pt-16 pb-24 sm:px-4 lg:pb-36"
    >
      <Reveal frame="still">
        <div className={styles.panel} data-network-cover="" data-testid="final-panel">
          <div className={styles.intro}>
            {/* No veil: the panel is opaque. */}
            <LandingHeading
              id="final-title"
              titleLines={TEXTS.titleLines}
              titleAccent={TEXTS.titleAccent}
              veil={false}
              tone="inverse"
              align="center"
            />
            <p className={styles.body} data-testid="final-body">
              {TEXTS.body}
            </p>
            <div className={styles.actions} data-testid="final-actions">
              <div className="flex flex-wrap justify-center gap-3">
                <ButtonLink href="/estimation" variant="light" size="lg" arrow="forward">
                  {ACTIONS.estimation}
                </ButtonLink>
                <ButtonLink href="/connexion" variant="outline-light" size="lg">
                  {ACTIONS.signIn}
                </ButtonLink>
              </div>
              <p className={styles.note}>{TEXTS.note}</p>
            </div>
          </div>
          <ProcessCarousel />
        </div>
      </Reveal>
    </section>
  );
}
