import { LANDING_TEXTS } from "@/components/landing-texts";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Reveal } from "@/components/ui/Reveal";

import { LandingHeading } from "./LandingHeading";

const TEXTS = LANDING_TEXTS.final;
const ACTIONS = LANDING_TEXTS.actions;

/** Final call to action: the same two actions as the hero, black then light. */
export function LandingFinal() {
  return (
    <section
      aria-labelledby="final-title"
      data-living-scene="final"
      className="mx-auto w-full max-w-7xl px-6 pt-16 pb-24 sm:px-8 lg:px-12 lg:pb-36"
    >
      <Reveal>
        <div className="grid gap-10 rounded-2xl border border-line bg-surface/90 p-8 shadow-raised backdrop-blur-sm md:grid-cols-[1fr_auto] md:items-end lg:p-12">
          <LandingHeading id="final-title" title={TEXTS.title} body={TEXTS.body} className="[&_h2]:mt-0" />
          <div className="flex flex-wrap gap-3 md:justify-end">
            <ButtonLink href="/estimation" size="lg" arrow="forward">
              {ACTIONS.estimation}
            </ButtonLink>
            <ButtonLink href="/connexion" variant="secondary" size="lg">
              {ACTIONS.signIn}
            </ButtonLink>
          </div>
          <p className="text-xs text-ink-subtle md:col-span-2">{TEXTS.note}</p>
        </div>
      </Reveal>
    </section>
  );
}
