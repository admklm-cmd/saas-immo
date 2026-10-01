import { LANDING_TEXTS } from "@/components/landing-texts";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EditorialTitle } from "@/components/ui/EditorialTitle";

import { HeroJourney } from "./HeroJourney";

const TEXTS = LANDING_TEXTS.hero;
const ACTIONS = LANDING_TEXTS.actions;

/**
 * First screen of the landing: tilted tag, editorial title revealed line by
 * line, its accented word first and sharp (pure CSS, final state without
 * JavaScript; docs/design-system.md §2.2.7), the two actions (black then
 * light), what the prototype really does, and the fictitious journey labelled
 * as a simulation. No figure, client, testimonial or price.
 */
export function LandingHero() {
  return (
    <section
      aria-labelledby="hero-title"
      data-living-scene="hero"
      className="mx-auto grid min-h-[calc(100dvh-4.5rem)] w-full max-w-7xl items-center gap-12 px-6 pt-14 pb-16 sm:px-8 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16 lg:px-12 lg:pt-20"
    >
      {/* An inline-size container: the poster title is capped by this column (§2.2.3). */}
      <div className="particle-veil @container min-w-0">
        <p
          data-testid="hero-tag"
          className="inline-block -rotate-3 rounded-full border border-ink bg-surface px-3.5 py-1.5 text-overline font-semibold text-ink uppercase shadow-subtle"
        >
          {TEXTS.tag}
        </p>

        <div className="mt-8">
          <EditorialTitle
            as="h1"
            id="hero-title"
            lines={TEXTS.titleLines}
            accent={TEXTS.titleAccent}
            size="poster"
            reveal="load"
            accentEffect="underline"
          />
        </div>

        <p className="mt-8 max-w-[52ch] text-lede text-pretty text-ink-muted">{TEXTS.subtitle}</p>

        <div className="mt-9 flex flex-wrap gap-3">
          <ButtonLink href="/estimation" size="lg" arrow="forward">
            {ACTIONS.estimation}
          </ButtonLink>
          <ButtonLink href="/connexion" variant="secondary" size="lg">
            {ACTIONS.signIn}
          </ButtonLink>
        </div>

        <div className="mt-12 border-t border-line pt-5">
          <p className="text-overline font-semibold text-ink-subtle uppercase">{TEXTS.proofLabel}</p>
          <ul className="mt-3 grid gap-x-6 gap-y-2 text-sm text-ink sm:grid-cols-2" data-testid="hero-proofs">
            {TEXTS.proofs.map((proof) => (
              <li key={proof} className="flex items-start gap-2">
                <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-ink" />
                {proof}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid gap-3">
        <HeroJourney />
        <p className="text-xs text-ink-subtle">{TEXTS.illustrationNote}</p>
      </div>
    </section>
  );
}
