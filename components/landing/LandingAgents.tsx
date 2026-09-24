import { LANDING_TEXTS } from "@/components/landing-texts";
import { Reveal } from "@/components/ui/Reveal";

import { AgentsCarousel } from "./agents/AgentsCarousel";
import { LandingHeading } from "./LandingHeading";

const TEXTS = LANDING_TEXTS.agents;

/**
 * Section « Cinq agents »: the detailed version of the hero journey (same
 * order, same names), drawn as the interface of an OS — seven modules over the
 * application each one opens (an illustrated fictitious scene). No panel of its
 * own: the system sits on the white page, only local light surfaces carry text,
 * so the living background stays visible between them.
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
