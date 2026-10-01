import { LANDING_TEXTS } from "@/components/landing-texts";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Reveal } from "@/components/ui/Reveal";

import { LandingHeading } from "./LandingHeading";
import { TechWordmark } from "./wordmark/TechWordmark";

const TEXTS = LANDING_TEXTS.final;
const ACTIONS = LANDING_TEXTS.actions;

/**
 * Final call to action, in one column (docs/design-system.md §2.2.9): the
 * sentence title (focus then underline on « fictive », §2.11.2), the same two
 * actions as the hero (black then light), aligned left, the prototype note,
 * then the brand wordmark (`BRAND.shortName`) signing the panel (§2.11.3, decorative). The
 * panel is an inline-size container: the wordmark is sized by it.
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
          className="@container grid justify-items-start gap-10 rounded-2xl border border-line bg-surface/90 p-8 shadow-raised backdrop-blur-sm lg:p-12"
          data-network-cover=""
        >
          {/* No veil: the panel is already opaque, the veil would draw a lighter box. */}
          <LandingHeading
            id="final-title"
            titleLines={TEXTS.titleLines}
            titleAccent={TEXTS.titleAccent}
            veil={false}
            accentEffect="focus-underline"
          />
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/estimation" size="lg" arrow="forward">
              {ACTIONS.estimation}
            </ButtonLink>
            <ButtonLink href="/connexion" variant="secondary" size="lg">
              {ACTIONS.signIn}
            </ButtonLink>
          </div>
          {/* The note stays right under the actions; the wordmark signs below it. */}
          <div className="grid justify-items-start">
            <p className="text-xs text-ink-subtle">{TEXTS.note}</p>
            <TechWordmark text={TEXTS.wordmark} className="mt-4" />
          </div>
        </div>
      </Reveal>
    </section>
  );
}
