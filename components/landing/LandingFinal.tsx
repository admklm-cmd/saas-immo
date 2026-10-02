import { LANDING_TEXTS } from "@/components/landing-texts";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Reveal } from "@/components/ui/Reveal";

import { LandingHeading } from "./LandingHeading";

const TEXTS = LANDING_TEXTS.final;
const ACTIONS = LANDING_TEXTS.actions;

/**
 * Final call to action, in one column (docs/design-system.md §2.2.9, §2.11.3 bis):
 * the sentence title (focus then underline on « fictive », §2.11.2), then one
 * group — the same two actions as the hero (black then light), aligned left,
 * and the prototype note 16 px below, read as their caption. The note is the
 * last element of the panel: its padding closes the card.
 */
export function LandingFinal() {
  return (
    <section
      aria-labelledby="final-title"
      data-living-scene="final"
      className="mx-auto w-full max-w-7xl px-6 pt-16 pb-24 sm:px-8 lg:px-12 lg:pb-36"
    >
      <Reveal frame="still">
        <div
          className="grid justify-items-start gap-10 rounded-2xl border border-line bg-surface/90 p-8 shadow-raised backdrop-blur-sm lg:p-12"
          data-network-cover=""
        >
          {/* No veil: the panel is already opaque, the veil would draw a lighter box. */}
          <LandingHeading
            id="final-title"
            titleLines={TEXTS.titleLines}
            titleAccent={TEXTS.titleAccent}
            veil={false}
          />
          <div className="grid justify-items-start gap-4" data-testid="final-actions">
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/estimation" size="lg" arrow="forward">
                {ACTIONS.estimation}
              </ButtonLink>
              <ButtonLink href="/connexion" variant="secondary" size="lg">
                {ACTIONS.signIn}
              </ButtonLink>
            </div>
            <p className="text-xs text-ink-subtle">{TEXTS.note}</p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
