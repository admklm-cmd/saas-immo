import { LANDING_TEXTS } from "@/components/landing-texts";
import { Reveal } from "@/components/ui/Reveal";

import { AgentsCarousel } from "./agents/AgentsCarousel";
import { LandingHeading } from "./LandingHeading";

const TEXTS = LANDING_TEXTS.agents;

/**
 * Section « Cinq agents »: the detailed version of the hero journey (same
 * order, same names). A carousel of the seven steps, each with an illustrated
 * fictitious scene. The cards and the panel are opaque: the living background
 * stays behind, never under the text.
 */
export function LandingAgents() {
  return (
    <section
      aria-labelledby="agents-title"
      data-living-scene="agents"
      className="mx-auto w-full max-w-7xl px-6 py-24 sm:px-8 lg:px-12 lg:py-36"
    >
      <Reveal>
        <LandingHeading id="agents-title" kicker={TEXTS.kicker} title={TEXTS.title} body={TEXTS.body} />
      </Reveal>
      <AgentsCarousel />
    </section>
  );
}
