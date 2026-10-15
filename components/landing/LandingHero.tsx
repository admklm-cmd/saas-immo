import { LANDING_TEXTS } from "@/components/landing-texts";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EditorialTitle } from "@/components/ui/EditorialTitle";

import { HeroEcosystem } from "./ecosystem/HeroEcosystem";
import { HeroStage } from "./hero/HeroStage";
import stageStyles from "./hero/HeroStage.module.css";
import { HeroTerminal } from "./hero/HeroTerminal";

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
 * Two bands in one section: band 1 is a centred statement over the particle
 * metamorphosis (cloud, ball, apple, the two hands of « La Création d'Adam »;
 * docs/design-system.md §2.11.4 ter) with the terminal « humain ⇄ machine »
 * under the shapes (§2.11.4 bis E);
 * band 2 leaves the `max-w-7xl` column so the row of cards can use the full
 * window.
 */
export function LandingHero() {
  return (
    <section id="hero" aria-labelledby="hero-title" data-living-scene="hero" className="w-full pb-16 lg:pb-24">
      {/* Band 1, the whole width: the particle canvas behind, the content above (§2.11.4 ter F). */}
      <HeroStage>
        <div
          className="mx-auto flex w-full max-w-5xl flex-col items-center px-6 pt-5 text-center sm:px-8 sm:pt-6 lg:px-12 lg:pt-3 min-[90rem]:pt-2"
          data-testid="hero-band"
        >
          {/* An inline-size container: the poster title is capped by this column (§2.2.3).
              One veil per role of text, sized to the words (§2.11.4). */}
          <div className="@container flex w-full min-w-0 flex-col items-center">
            <div className="network-veil-title relative mx-auto mt-0 w-fit max-w-full sm:mt-4" data-network-quiet="">
              <EditorialTitle
                as="h1"
                id="hero-title"
                lines={TEXTS.titleLines}
                accent={TEXTS.titleAccent}
                size="prompt"
                reveal="load"
                accentEffect="underline"
                accentReplay
                accentFace="title"
              />
            </div>
          </div>

          <div className="mt-6 flex w-full min-w-0 flex-col items-center">
            {/* Same face as the terminal journal (U.3): Geist Mono 400, ink-muted, one sentence per line. */}
            <p className={`particle-veil ${stageStyles.subtitle} mx-auto w-fit text-pretty text-ink-muted`} data-network-quiet="">
              {TEXTS.subtitleLines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </p>

            <div className="mt-5 flex w-full max-w-full flex-col items-stretch justify-center gap-2 sm:mt-7 sm:w-fit sm:flex-row sm:flex-wrap sm:gap-3" data-network-quiet="">
              <ButtonLink href="/estimation" size="lg" arrow="forward" className="max-sm:w-full max-sm:justify-center">
                {ACTIONS.estimation}
              </ButtonLink>
              <ButtonLink href="/connexion" variant="secondary" size="lg" className="max-sm:w-full max-sm:justify-center">
                {ACTIONS.signIn}
              </ButtonLink>
            </div>

            {/* The shape zone: the ball, the apple and the two hands are centred here, behind the text (§2.11.4 ter F). */}
            <div aria-hidden="true" data-nano-stage="" className={`${stageStyles.zone} w-full`} />

            {/* The tag heads the demonstration: just above the terminal (U.1). */}
            <p
              data-testid="hero-tag"
              className="label-mono mt-6 mb-3 inline-block rounded-full border border-ink bg-surface px-2.5 py-1.25 leading-none whitespace-nowrap text-ink"
            >
              {TEXTS.tag}
            </p>

            <HeroTerminal />

            <div className="particle-veil mt-8 w-full max-w-3xl border-t border-line-strong pt-5 sm:mt-10" data-network-quiet="">
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
      </HeroStage>

      {/* Band 2: block A, the whole width of the window (§2.11.8.3). */}
      <div className="mt-14 lg:mt-16 min-[90rem]:mt-20">
        <HeroEcosystem />
      </div>
    </section>
  );
}
