import { LANDING_TEXTS } from "@/components/landing-texts";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Reveal } from "@/components/ui/Reveal";

import { LandingHeading } from "./LandingHeading";

const TEXTS = LANDING_TEXTS.final;
const ACTIONS = LANDING_TEXTS.actions;

/**
 * Final call to action, in one column (docs/design-system.md §2.2.9): the
 * sentence title, then the same two actions as the hero (black then light),
 * aligned left, then the prototype note.
 */
export function LandingFinal() {
  return (
    <section
      aria-labelledby="final-title"
      data-living-scene="final"
      className="mx-auto w-full max-w-7xl px-6 pt-16 pb-24 sm:px-8 lg:px-12 lg:pb-36"
    >
      <Reveal frame="still">
        <div className="grid justify-items-start gap-10 rounded-2xl border border-line bg-surface/90 p-8 shadow-raised backdrop-blur-sm lg:p-12">
          {/* No veil: the panel is already opaque, the veil would draw a lighter box. */}
          <LandingHeading id="final-title" titleLines={TEXTS.titleLines} titleAccent={TEXTS.titleAccent} veil={false} />
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
      </Reveal>
    </section>
  );
}
