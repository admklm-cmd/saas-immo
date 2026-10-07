import { LANDING_TEXTS } from "@/components/landing-texts";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EditorialTitle } from "@/components/ui/EditorialTitle";

import { HeroEcosystem } from "./ecosystem/HeroEcosystem";

const TEXTS = LANDING_TEXTS.hero;
const ACTIONS = LANDING_TEXTS.actions;

/**
 * First screen of the landing: tilted tag, editorial title revealed line by
 * line, its accented word first and sharp (pure CSS, final state without
 * JavaScript; docs/design-system.md §2.2.7), the two actions (black then
 * light), what the prototype really does — then, on the whole width, block A
 * (docs/design-system.md §2.11.8.3): the agents at work and « Vous » checking
 * the two human decisions, labelled as a fictitious simulation. No figure,
 * client, testimonial or price.
 *
 * Two bands in one section: band 1 is a centred statement over the point-field
 * hand-off; band 2 leaves the `max-w-7xl` column so the row of cards can use
 * the full window.
 */
export function LandingHero() {
  return (
    <section aria-labelledby="hero-title" data-living-scene="hero" className="w-full pt-10 pb-16 lg:pt-14 lg:pb-24">
      <div
        className="mx-auto flex w-full max-w-5xl flex-col items-center px-6 text-center sm:px-8 lg:px-12"
        data-testid="hero-band"
      >
        {/* An inline-size container: the poster title is capped by this column (§2.2.3).
            One veil per role of text, sized to the words (§2.11.4): the network
            stays visible around and, at 30 %, behind the title. */}
        <div className="@container flex w-full min-w-0 flex-col items-center">
          <div className="network-veil-title relative mx-auto mt-8 w-fit max-w-full" data-network-quiet="">
            <EditorialTitle
              as="h1"
              id="hero-title"
              lines={TEXTS.titleLines}
              accent={TEXTS.titleAccent}
              size="poster"
              reveal="load"
              accentEffect="underline"
              accentReplay
              accentFace="title"
            />
            <p
              data-testid="hero-tag"
              className="absolute -top-8 right-0 z-10 inline-block rotate-3 rounded-full border border-ink bg-surface px-2.5 py-1 text-[0.6rem] leading-none font-semibold tracking-[0.08em] whitespace-nowrap text-ink uppercase shadow-subtle sm:-right-8 sm:top-[0.45em] lg:-right-12"
            >
              {TEXTS.tag}
            </p>
          </div>
        </div>

        <div className="mt-6 flex w-full min-w-0 flex-col items-center">
          <p className="particle-veil mx-auto w-fit max-w-[52ch] text-lede text-pretty text-ink-muted" data-network-quiet="">
            {TEXTS.subtitle}
          </p>

          <div className="mt-7 flex w-fit max-w-full flex-wrap justify-center gap-3" data-network-quiet="">
            <ButtonLink href="/estimation" size="lg" arrow="forward">
              {ACTIONS.estimation}
            </ButtonLink>
            <ButtonLink href="/connexion" variant="secondary" size="lg">
              {ACTIONS.signIn}
            </ButtonLink>
          </div>

          {/* A deliberate visual pause lets the point-field hand-off breathe
              before the proof and the product demonstration begin. */}
          <div aria-hidden="true" className="h-[clamp(7rem,18vh,12rem)]" />

          <div className="particle-veil w-full max-w-3xl border-t border-line-strong pt-5" data-network-quiet="">
            <p className="text-overline font-semibold text-ink-subtle uppercase">{TEXTS.proofLabel}</p>
            <ul className="mt-3 grid gap-x-6 gap-y-2 text-left text-sm text-ink sm:grid-cols-2 lg:grid-cols-3" data-testid="hero-proofs">
              {TEXTS.proofs.map((proof) => (
                <li key={proof} className="flex items-start gap-2">
                  <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-ink" />
                  {proof}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Band 2: block A, the whole width of the window (§2.11.8.3). */}
      <div className="mt-14 lg:mt-16 min-[90rem]:mt-20">
        <HeroEcosystem />
      </div>
    </section>
  );
}
